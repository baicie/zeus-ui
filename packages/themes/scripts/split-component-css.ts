import { Buffer } from 'node:buffer'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Splits `src/components.css` into per-component stylesheets so consumers can
 * load only the presentation for the components they use.
 *
 * `components.css` stays the single source of truth and is NOT rewritten: the
 * per-component files are derived, and cross-component rules are duplicated
 * into every file that needs them so each file works standalone. Consumers of
 * a per-component file must also load `tokens.css` and one theme file.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = join(__dirname, '../src')
const outDir = join(srcDir, 'components')

/** Component tag -> file name (without `.css`). One file per shipped element. */
const componentFileNames: Record<string, string> = {
  'zw-button': 'button',
  'zw-input': 'input',
  'zw-textarea': 'textarea',
  'zw-select': 'select',
  'zw-checkbox': 'checkbox',
  'zw-switch': 'switch',
  'zw-radio-group': 'radio-group',
  'zw-label': 'label',
  'zw-tabs': 'tabs',
  'zw-dialog': 'dialog',
  'zw-tooltip': 'tooltip',
  'zw-accordion': 'accordion',
  'zw-collapsible': 'collapsible',
  'zw-alert': 'alert',
  'zw-avatar': 'avatar',
  'zw-badge': 'badge',
  'zw-card': 'card',
  'zw-progress': 'progress',
  'zw-separator': 'separator',
  'zw-skeleton': 'skeleton',
  'zw-agent-console': 'agent-console',
  'zw-chat': 'chat',
  'zw-data-grid': 'data-grid',
  'zw-revogrid-adapter': 'revogrid-adapter',
  'zw-virtual-list': 'virtual-list',
}

/**
 * Resolves the element tag that owns a selector (`zw-dialog-content` belongs
 * to `zw-dialog`). Unknown tags are left alone so a new element without a
 * presentation file shows up as missing rather than silently mis-filed.
 */
function ownerTag(tag: string, known: readonly string[]): string | undefined {
  let owner: string | undefined

  for (const candidate of known) {
    if (tag === candidate || tag.startsWith(`${candidate}-`)) {
      if (!owner || candidate.length > owner.length) owner = candidate
    }
  }

  return owner
}

interface CssNode {
  /** Full source text of the node, formatted exactly as in components.css. */
  text: string
  /** Component tags mentioned anywhere in the node's selectors. */
  tags: string[]
  kind: 'rule' | 'keyframes'
  name?: string
}

const source = readFileSync(join(srcDir, 'components.css'), 'utf-8')
const nodes = parseNodes(source)
const knownTags = Object.keys(componentFileNames)
const rules = nodes.filter(node => node.kind === 'rule')
const keyframes = nodes.filter(node => node.kind === 'keyframes')

/** Tags used by a `var(--zw-*)` custom property inside a node. */
function referencedVariables(text: string): string[] {
  return Array.from(text.matchAll(/var\((--zw-[a-z-]+)/g)).map(
    match => match[1],
  )
}

const output = new Map<string, string[]>()
const order = Array.from(new Set(Object.values(componentFileNames)))

for (const file of order) output.set(file, [])
output.set('base', [])

// Base reset: rules that mention two or more components (or none) belong to
// no single component file, so they go to base and are also duplicated into
// the files whose components they mention.
const baseRules: CssNode[] = []
const perComponentRules = new Map<string, CssNode[]>()

for (const rule of rules) {
  const tags = Array.from(
    new Set(
      rule.tags
        .map(tag => ownerTag(tag, knownTags))
        .filter((tag): tag is string => tag !== undefined),
    ),
  )

  if (tags.length === 0) {
    baseRules.push(rule)
    continue
  }

  for (const tag of tags) {
    const file = componentFileNames[tag]
    const list = perComponentRules.get(file) ?? []

    if (!list.includes(rule)) list.push(rule)
    perComponentRules.set(file, list)
  }

  if (new Set(tags).size > 1) baseRules.push(rule)
}

for (const file of order) {
  const sections: string[] = []
  const tag = Object.keys(componentFileNames).find(
    key => componentFileNames[key] === file,
  )
  const rulesForFile = perComponentRules.get(file) ?? []

  for (const rule of rulesForFile) sections.push(rule.text)

  // A file needs every keyframe its own rules reference, plus the skeleton
  // pulse and progress animation, which are referenced by custom properties
  // in vendor CSS rather than by name.
  const used = new Set<string>()

  for (const rule of rulesForFile) {
    for (const variable of referencedVariables(rule.text)) used.add(variable)

    for (const frame of keyframes) {
      if (rule.text.includes(frame.name as string))
        used.add(frame.name as string)
    }
  }

  if (tag === 'zw-skeleton') used.add('zw-skeleton-pulse')
  if (tag === 'zw-progress') used.add('zw-progress-indeterminate')

  for (const frame of keyframes) {
    if (used.has(frame.name as string)) sections.push(frame.text)
  }

  const body = sections.join('\n\n').trim()

  output.set(
    file,
    body
      ? [
          `/* Derived from components.css by scripts/split-component-css.ts. */`,
          `/* Requires tokens.css and one theme file (e.g. default.css). */`,
          '',
          body,
          '',
        ]
      : [],
  )
}

const baseBody = [
  ...baseRules.map(rule => rule.text),
  ...keyframes.map(frame => frame.text),
]
  .join('\n\n')
  .trim()

output.set('base', [
  `/* Derived from components.css by scripts/split-component-css.ts. */`,
  '',
  baseBody,
  '',
])

mkdirSync(outDir, { recursive: true })

for (const [file, lines] of output) {
  const target = join(outDir, `${file}.css`)
  const text = lines.join('\n')

  writeFileSync(target, text, 'utf-8')
  console.info(
    `[split-component-css] ${file}.css ${Buffer.byteLength(text)} bytes`,
  )
}

function parseNodes(css: string): CssNode[] {
  const nodes: CssNode[] = []
  let index = 0

  while (index < css.length) {
    const braceIndex = css.indexOf('{', index)

    if (braceIndex < 0) {
      const rest = css.slice(index).trim()

      if (rest) nodes.push({ text: rest, tags: [], kind: 'rule' })
      break
    }

    const header = css.slice(index, braceIndex)
    const start = trimStartIndex(css, index)

    if (header.trim().startsWith('@keyframes')) {
      const end = matchBrace(css, braceIndex)
      const name = /@keyframes\s+([\w-]+)/.exec(header)?.[1]

      nodes.push({
        text: css.slice(start, end + 1).trim(),
        tags: [],
        kind: 'keyframes',
        name,
      })
      index = end + 1
      continue
    }

    if (header.trim().startsWith('@media')) {
      const end = matchBrace(css, braceIndex)
      const block = css.slice(start, end + 1).trim()
      const inner = parseNodes(block.slice(block.indexOf('{') + 1, -1))

      // A media query keeps its wrapper but exposes the tags of its rules.
      nodes.push({
        text: block,
        tags: Array.from(new Set(inner.flatMap(node => node.tags))),
        kind: 'rule',
      })
      index = end + 1
      continue
    }

    const end = matchBrace(css, braceIndex)

    nodes.push({
      text: css.slice(start, end + 1).trim(),
      tags: extractTags(header),
      kind: 'rule',
    })
    index = end + 1
  }

  return nodes
}

function trimStartIndex(css: string, index: number): number {
  let cursor = index

  while (cursor < css.length && /\s/.test(css[cursor])) cursor += 1

  return cursor
}

function matchBrace(css: string, braceIndex: number): number {
  let depth = 0

  for (let cursor = braceIndex; cursor < css.length; cursor += 1) {
    if (css[cursor] === '{') {
      depth += 1
    } else if (css[cursor] === '}') {
      depth -= 1
      if (depth === 0) return cursor
    }
  }

  throw new Error('Unbalanced braces in components.css')
}

function extractTags(header: string): string[] {
  return Array.from(
    new Set(
      Array.from(header.matchAll(/zw-[a-z]+(?:-[a-z]+)*/g)).map(
        match => match[0],
      ),
    ),
  )
}
