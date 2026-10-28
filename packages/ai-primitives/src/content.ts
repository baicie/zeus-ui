/**
 * Content parts and the renderer registry (AI2-209 / AI2-504).
 *
 * `describePart` turns any `ContentPart` into a neutral block that every
 * adapter can render safely by default: Markdown AST, code, JSON, an image
 * or file reference, a citation or artifact pointer. Applications register
 * richer renderers (syntax highlighting, charts, Monaco…) per framework
 * through `createRendererRegistry`; when none matches, the default block is
 * used, so a missing renderer degrades instead of breaking the message.
 *
 * `TNode` is the framework's node type (ReactNode, VNode, DOM Node); it is
 * never shared across frameworks (01-ARCHITECTURE §12).
 */

import type { AssetRef, ContentPart } from '@zeus-web/ai-core'
import type { MarkdownOptions, MdBlock } from './markdown'

import { markdownToPlainText, parseMarkdown } from './markdown'

export type ContentBlock =
  | { kind: 'markdown'; partId: string; blocks: MdBlock[] }
  | { kind: 'text'; partId: string; text: string }
  | { kind: 'image'; partId: string; asset: AssetRef; alt: string }
  | { kind: 'file'; partId: string; asset: AssetRef; name: string }
  | { kind: 'reference'; partId: string; sourceId: string; label: string }
  | { kind: 'artifact'; partId: string; artifactId: string }
  | {
      kind: 'json'
      partId: string
      schema: string
      text: string
      truncated: boolean
    }

export interface DescribeOptions extends MarkdownOptions {
  /** Max characters of pretty-printed structured values. Default 20 000. */
  maxJsonChars?: number
}

/** Pretty JSON for display: cycles, functions and huge values are tamed. */
export function formatJson(
  value: unknown,
  maxChars = 20_000,
): { text: string; truncated: boolean } {
  const seen = new WeakSet<object>()
  let text: string

  try {
    text =
      JSON.stringify(
        value,
        (_key, entry: unknown) => {
          if (typeof entry === 'bigint') return `${entry.toString()}n`
          if (typeof entry === 'function' || typeof entry === 'symbol')
            return undefined
          if (typeof entry === 'object' && entry !== null) {
            if (seen.has(entry)) return '[Circular]'
            seen.add(entry)
          }
          return entry
        },
        2,
      ) ?? 'undefined'
  } catch {
    text = String(value)
  }

  return text.length > maxChars
    ? { text: `${text.slice(0, maxChars)}\n…`, truncated: true }
    : { text, truncated: false }
}

export function describePart(
  part: ContentPart,
  options: DescribeOptions = {},
): ContentBlock {
  switch (part.kind) {
    case 'text':
      return part.format === 'markdown'
        ? {
            kind: 'markdown',
            partId: part.id,
            blocks: parseMarkdown(part.text, options),
          }
        : { kind: 'text', partId: part.id, text: part.text }
    case 'image':
      return {
        kind: 'image',
        partId: part.id,
        asset: part.asset,
        alt: part.alt ?? '',
      }
    case 'file':
      return {
        kind: 'file',
        partId: part.id,
        asset: part.asset,
        name: part.name,
      }
    case 'reference':
      return {
        kind: 'reference',
        partId: part.id,
        sourceId: part.sourceId,
        label: part.label ?? part.sourceId,
      }
    case 'artifact-ref':
      return { kind: 'artifact', partId: part.id, artifactId: part.artifactId }
    case 'structured': {
      const json = formatJson(part.value, options.maxJsonChars)
      return { kind: 'json', partId: part.id, schema: part.schema, ...json }
    }
  }
}

/** Plain text of a message, as a user would expect from "copy". */
export function partsToPlainText(parts: readonly ContentPart[]): string {
  return parts
    .map(part => {
      if (part.kind !== 'text') return ''
      return part.format === 'markdown'
        ? markdownToPlainText(parseMarkdown(part.text))
        : part.text
    })
    .filter(Boolean)
    .join('\n\n')
}

export interface ContentRendererContext {
  part: ContentPart
  block: ContentBlock
  resolveAsset: (
    asset: AssetRef,
  ) => Promise<Blob | Uint8Array | ReadableStream<Uint8Array>>
  capability: ReadonlySet<string>
}

export interface ContentRenderer<TNode> {
  id: string
  canRender: (part: ContentPart, block: ContentBlock) => boolean
  render: (context: ContentRendererContext) => TNode
  dispose?: (node: TNode) => void
}

export interface RendererRegistry<TNode> {
  /** First registered renderer that accepts the part, or undefined. */
  resolve: (
    part: ContentPart,
    block: ContentBlock,
  ) => ContentRenderer<TNode> | undefined
  register: (renderer: ContentRenderer<TNode>) => () => void
  list: () => readonly ContentRenderer<TNode>[]
}

export function createRendererRegistry<TNode>(
  initial: readonly ContentRenderer<TNode>[] = [],
): RendererRegistry<TNode> {
  let renderers = [...initial]

  return {
    resolve(part, block): ContentRenderer<TNode> | undefined {
      for (const renderer of renderers) {
        try {
          if (renderer.canRender(part, block)) return renderer
        } catch {
          // A faulty renderer must not take the message down; skip it.
        }
      }
      return undefined
    },
    register(renderer): () => void {
      renderers = [
        ...renderers.filter(entry => entry.id !== renderer.id),
        renderer,
      ]
      return () => {
        renderers = renderers.filter(entry => entry !== renderer)
      }
    },
    list: () => renderers,
  }
}

/** Code block model: copy keeps the exact code; the language is a label only. */
export interface CodeBlockModel {
  language?: string
  lines: readonly string[]
  copyText: string
  /** The fence is still open while streaming. */
  streaming: boolean
}

export function describeCode(
  text: string,
  lang?: string,
  closed = true,
): CodeBlockModel {
  return {
    language: lang && /^[\w+#.-]{1,32}$/.test(lang) ? lang : undefined,
    lines: text.split('\n'),
    copyText: text,
    streaming: !closed,
  }
}
