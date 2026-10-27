/**
 * Safe Markdown → AST (AI2-209 / AI2-504).
 *
 * Model output is untrusted (01-ARCHITECTURE §12, §13.1-2). This parser
 * never produces HTML: it returns a small AST that each adapter renders with
 * text nodes and a fixed set of elements. Raw HTML in the source stays
 * literal text, link targets pass a protocol allowlist (`http`, `https`,
 * `mailto`, in-page `#anchors`), and images are not auto-loaded unless the
 * host opts in, so a model cannot exfiltrate data through image URLs.
 *
 * Streaming-friendly: an unclosed code fence is kept as an open code block
 * (`closed: false`) so the renderer can show readable code without
 * re-mounting on every token.
 *
 * The grammar is a pragmatic CommonMark subset: ATX headings, paragraphs,
 * hard breaks, emphasis / strong, inline code, links, autolinks, images,
 * fenced code, block quotes, ordered / unordered (nested) lists and
 * thematic breaks.
 */

export type MdInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: MdInline[] }
  | { type: 'emphasis'; children: MdInline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; title?: string; children: MdInline[] }
  | { type: 'image'; src: string; alt: string }
  | { type: 'break' }

export type MdBlock =
  | { type: 'paragraph'; children: MdInline[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: MdInline[] }
  | { type: 'code'; lang?: string; text: string; closed: boolean }
  | { type: 'list'; ordered: boolean; start?: number; items: MdBlock[][] }
  | { type: 'blockquote'; children: MdBlock[] }
  | { type: 'hr' }

export interface MarkdownOptions {
  /** Protocols allowed in links. Default http, https, mailto. */
  linkProtocols?: readonly string[]
  /** Max input characters parsed; the rest is kept as plain text. */
  maxLength?: number
}

const DEFAULT_PROTOCOLS = ['http:', 'https:', 'mailto:']

/** A link target the renderer may use, or undefined to render text only. */
export function sanitizeHref(
  href: string,
  protocols: readonly string[] = DEFAULT_PROTOCOLS,
): string | undefined {
  const trimmed = href.trim()
  // Control characters and whitespace inside a URL are how `java\tscript:`
  // style tricks get past naive checks; refuse them outright.
  // eslint-disable-next-line no-control-regex
  if (!trimmed || /[\u0000-\u001F\u007F\s]/.test(trimmed)) return undefined
  if (trimmed.startsWith('#')) return trimmed

  const match = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)
  if (!match) return undefined

  return protocols.includes(`${match[1].toLowerCase()}:`) ? trimmed : undefined
}

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

function parseInline(source: string, protocols: readonly string[]): MdInline[] {
  const nodes: MdInline[] = []
  let text = ''
  let index = 0

  const flush = (): void => {
    if (text) nodes.push({ type: 'text', text })
    text = ''
  }

  while (index < source.length) {
    const char = source[index]
    const rest = source.slice(index)

    // Backslash escapes and hard breaks.
    if (char === '\\') {
      if (source[index + 1] === '\n') {
        flush()
        nodes.push({ type: 'break' })
        index += 2
        continue
      }
      if (/[\\`*_[\]()#+\-.!<>]/.test(source[index + 1] ?? '')) {
        text += source[index + 1]
        index += 2
        continue
      }
    }

    if (char === '\n') {
      if (text.endsWith('  ')) {
        text = text.replace(/ +$/, '')
        flush()
        nodes.push({ type: 'break' })
      } else {
        text += ' '
      }
      index += 1
      continue
    }

    if (char === '`') {
      const run = /^`+/.exec(rest)![0]
      const close = source.indexOf(run, index + run.length)
      if (close > 0) {
        flush()
        nodes.push({
          type: 'code',
          text: source
            .slice(index + run.length, close)
            .replace(/^ (.+) $/, '$1'),
        })
        index = close + run.length
        continue
      }
      text += run
      index += run.length
      continue
    }

    const autolink = /^<((?:https?|mailto):[^\s<>]+)>/i.exec(rest)
    if (autolink) {
      const href = sanitizeHref(autolink[1], protocols)
      flush()
      nodes.push(
        href
          ? {
              type: 'link',
              href,
              children: [{ type: 'text', text: autolink[1] }],
            }
          : { type: 'text', text: autolink[0] },
      )
      index += autolink[0].length
      continue
    }

    const image = /^!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+"[^"]*")?\s*\)/.exec(rest)
    if (image) {
      const src = sanitizeHref(image[2], protocols)
      flush()
      nodes.push(
        src
          ? { type: 'image', src, alt: image[1] }
          : { type: 'text', text: image[1] },
      )
      index += image[0].length
      continue
    }

    if (char === '[') {
      const link =
        /^\[((?:[^[\]]|\[[^\]]*\])*)\]\(\s*([^\s)]+)(?:\s+"([^"]*)")?\s*\)/.exec(
          rest,
        )
      if (link) {
        const href = sanitizeHref(link[2], protocols)
        const children = parseInline(link[1], protocols)
        flush()
        if (href) {
          nodes.push({ type: 'link', href, title: link[3], children })
        } else {
          nodes.push(...children)
        }
        index += link[0].length
        continue
      }
    }

    if (char === '*' || char === '_') {
      const strong = rest.startsWith(char + char)
      const marker = strong ? char + char : char
      const close = source.indexOf(marker, index + marker.length)
      const inner = close > 0 ? source.slice(index + marker.length, close) : ''
      // Intra-word underscores (snake_case) are not emphasis.
      const intraword =
        char === '_' &&
        /\w/.test(source[index - 1] ?? '') &&
        /\w/.test(source[close + marker.length] ?? '')

      if (
        close > 0 &&
        inner.trim() === inner &&
        inner.length > 0 &&
        !intraword
      ) {
        flush()
        nodes.push({
          type: strong ? 'strong' : 'emphasis',
          children: parseInline(inner, protocols),
        })
        index = close + marker.length
        continue
      }
    }

    text += char
    index += 1
  }

  flush()
  return nodes
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/
// Linear-time patterns only: these run on untrusted text.
const HEADING = /^ {0,3}(#{1,6})(?=[ \t]|$)/
const HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/
const BULLET = /^( {0,3})([-*+])[ \t](.*)$/
const ORDERED = /^( {0,3})(\d{1,9})[.)][ \t](.*)$/
const QUOTE = /^ {0,3}>\s?(.*)$/

/** Heading text without the optional closing `#` sequence. */
function headingText(rest: string): string {
  const text = rest.trim()
  const closing = /(?:^|[ \t])#+$/.exec(text)
  return closing ? text.slice(0, closing.index).trim() : text
}

function parseBlocks(lines: string[], protocols: readonly string[]): MdBlock[] {
  const blocks: MdBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.trim() === '') {
      index += 1
      continue
    }

    const fence = FENCE.exec(line)
    if (fence) {
      const marker = fence[1]
      const body: string[] = []
      index += 1
      let closed = false
      while (index < lines.length) {
        if (lines[index].trim().startsWith(marker[0].repeat(marker.length))) {
          closed = true
          index += 1
          break
        }
        body.push(lines[index])
        index += 1
      }
      blocks.push({
        type: 'code',
        lang: fence[2] || undefined,
        text: body.join('\n'),
        closed,
      })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(
          headingText(line.slice(heading[0].length)),
          protocols,
        ),
      })
      index += 1
      continue
    }

    if (HR.test(line)) {
      blocks.push({ type: 'hr' })
      index += 1
      continue
    }

    if (QUOTE.test(line)) {
      const body: string[] = []
      while (index < lines.length && QUOTE.test(lines[index])) {
        body.push(QUOTE.exec(lines[index])![1])
        index += 1
      }
      blocks.push({
        type: 'blockquote',
        children: parseBlocks(body, protocols),
      })
      continue
    }

    const bullet = BULLET.exec(line)
    const ordered = ORDERED.exec(line)
    if (bullet || ordered) {
      const isOrdered = !bullet
      const pattern = isOrdered ? ORDERED : BULLET
      const baseIndent = (bullet ?? ordered)![1].length
      const items: MdBlock[][] = []
      let current: string[] = []

      while (index < lines.length) {
        const entry = lines[index]
        const item = pattern.exec(entry)
        // Only items at this list's indent are siblings; deeper ones nest.
        if (item && item[1].length <= baseIndent + 1) {
          if (current.length > 0) items.push(parseBlocks(current, protocols))
          current = [item[3].trimStart()]
          index += 1
          continue
        }
        // Indented lines continue (or nest inside) the current item.
        if (entry.trim() !== '' && /^\s{2,}/.test(entry)) {
          current.push(entry.replace(/^\s{2,4}/, ''))
          index += 1
          continue
        }
        if (entry.trim() === '' && /^\s{2,}\S/.test(lines[index + 1] ?? '')) {
          current.push('')
          index += 1
          continue
        }
        break
      }
      if (current.length > 0) items.push(parseBlocks(current, protocols))

      blocks.push({
        type: 'list',
        ordered: isOrdered,
        start: isOrdered ? Number(ordered![2]) : undefined,
        items,
      })
      continue
    }

    const paragraph: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !FENCE.test(lines[index]) &&
      !HEADING.test(lines[index]) &&
      !HR.test(lines[index]) &&
      !QUOTE.test(lines[index]) &&
      !(
        paragraph.length > 0 &&
        (BULLET.test(lines[index]) || ORDERED.test(lines[index]))
      )
    ) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push({
      type: 'paragraph',
      children: parseInline(paragraph.join('\n'), protocols),
    })
  }

  return blocks
}

export function parseMarkdown(
  source: string,
  options: MarkdownOptions = {},
): MdBlock[] {
  const protocols = options.linkProtocols ?? DEFAULT_PROTOCOLS
  const max = options.maxLength ?? 200_000
  const head = source.length > max ? source.slice(0, max) : source
  const blocks = parseBlocks(
    head.replace(/\r\n?/g, '\n').split('\n'),
    protocols,
  )

  if (source.length > max) {
    blocks.push({
      type: 'paragraph',
      children: [{ type: 'text', text: source.slice(max) }],
    })
  }

  return blocks
}

/** Plain text of an AST, e.g. for copy or an accessible summary. */
export function markdownToPlainText(blocks: readonly MdBlock[]): string {
  const inline = (nodes: readonly MdInline[]): string =>
    nodes
      .map(node => {
        switch (node.type) {
          case 'text':
          case 'code':
            return node.text
          case 'break':
            return '\n'
          case 'image':
            return node.alt
          default:
            return inline(node.children)
        }
      })
      .join('')

  return blocks
    .map(block => {
      switch (block.type) {
        case 'paragraph':
        case 'heading':
          return inline(block.children)
        case 'code':
          return block.text
        case 'blockquote':
          return markdownToPlainText(block.children)
        case 'list':
          return block.items.map(item => markdownToPlainText(item)).join('\n')
        default:
          return ''
      }
    })
    .join('\n\n')
}
