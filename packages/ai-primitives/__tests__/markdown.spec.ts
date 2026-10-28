import type { MdBlock, MdInline } from '../src/markdown'

import { describe, expect, it } from 'vitest'
import { describePart, formatJson, partsToPlainText } from '../src/content'
import { parseMarkdown, sanitizeHref } from '../src/markdown'

function collect(blocks: readonly MdBlock[]): MdInline[] {
  const out: MdInline[] = []
  const inline = (nodes: readonly MdInline[]): void => {
    for (const node of nodes) {
      out.push(node)
      if ('children' in node) inline(node.children)
    }
  }
  for (const block of blocks) {
    if (block.type === 'paragraph' || block.type === 'heading')
      inline(block.children)
    if (block.type === 'blockquote') out.push(...collect(block.children))
    if (block.type === 'list') {
      for (const item of block.items) out.push(...collect(item))
    }
  }
  return out
}

describe('markdown structure', () => {
  it('parses the supported block set', () => {
    const blocks = parseMarkdown(
      '# Title\n\nSome **bold** and *em* and `code`.\n\n- a\n- b\n  - nested\n\n1. one\n2. two\n\n> quote\n\n---\n\n```ts\nconst x = 1\n```',
    )
    expect(blocks.map(block => block.type)).toEqual([
      'heading',
      'paragraph',
      'list',
      'list',
      'blockquote',
      'hr',
      'code',
    ])
    expect(blocks[2]).toMatchObject({
      ordered: false,
      items: [
        [{ type: 'paragraph' }],
        [{ type: 'paragraph' }, { type: 'list' }],
      ],
    })
    expect(blocks[6]).toEqual({
      type: 'code',
      lang: 'ts',
      text: 'const x = 1',
      closed: true,
    })
  })

  it('keeps an unclosed fence readable while streaming', () => {
    expect(parseMarkdown('```py\nprint(1)\nprint(2')).toEqual([
      { type: 'code', lang: 'py', text: 'print(1)\nprint(2', closed: false },
    ])
  })

  it('does not treat snake_case as emphasis', () => {
    const [paragraph] = parseMarkdown('use snake_case_name here')
    expect(paragraph).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', text: 'use snake_case_name here' }],
    })
  })
})

describe('markdown safety (threat T1-1)', () => {
  const hostile = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '[click](javascript:alert(1))',
    '[click](JaVaScRiPt:alert(1))',
    '[click](java\tscript:alert(1))',
    '[x](data:text/html;base64,PHNjcmlwdD4=)',
    '[x](vbscript:msgbox(1))',
    '![x](javascript:alert(1))',
    '<javascript:alert(1)>',
    '<svg onload=alert(1)>',
  ]

  it.each(hostile)(
    'never yields an executable link or markup for %s',
    source => {
      const nodes = collect(parseMarkdown(source))
      for (const node of nodes) {
        if (node.type === 'link')
          expect(node.href).toMatch(/^(https?:|mailto:|#)/)
        if (node.type === 'image') expect(node.src).toMatch(/^https?:/)
      }
      // Raw HTML stays text: the AST has no element nodes for it.
      expect(JSON.stringify(nodes)).not.toMatch(/"type":"(html|raw)"/)
    },
  )

  it('parses pathological input in linear time (no ReDoS)', () => {
    const inputs = [
      `#${' '.repeat(50_000)}x${' '.repeat(50_000)}#`,
      `-${' \t'.repeat(50_000)}x`,
      `${'*'.repeat(20_000)}a`,
      `${'['.repeat(20_000)}x](`,
      `${'`'.repeat(20_000)}`,
    ]
    for (const input of inputs) {
      const started = performance.now()
      parseMarkdown(input)
      // Linear parsing takes milliseconds; a quadratic regression takes minutes.
      expect(performance.now() - started).toBeLessThan(5000)
    }
  })

  it('keeps raw HTML as literal text', () => {
    expect(parseMarkdown('<b>hi</b>')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: '<b>hi</b>' }] },
    ])
  })

  it('allows only http(s), mailto and in-page anchors', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com')
    expect(sanitizeHref('mailto:a@b.c')).toBe('mailto:a@b.c')
    expect(sanitizeHref('#section')).toBe('#section')
    expect(sanitizeHref('/relative')).toBeUndefined()
    expect(sanitizeHref('file:///etc/passwd')).toBeUndefined()
  })
})

describe('content parts', () => {
  it('describes each part kind with a safe default block', () => {
    expect(
      describePart({
        id: 'p',
        kind: 'text',
        revision: 1,
        text: 'hi',
        format: 'plain',
      }),
    ).toEqual({
      kind: 'text',
      partId: 'p',
      text: 'hi',
    })
    expect(
      describePart({
        id: 's',
        kind: 'structured',
        schema: 'x',
        value: { a: 1 },
      }),
    ).toMatchObject({ kind: 'json', text: '{\n  "a": 1\n}' })
  })

  it('formats cyclic and huge structured values without throwing', () => {
    const cyclic: Record<string, unknown> = { a: 1 }
    cyclic.self = cyclic
    expect(formatJson(cyclic).text).toContain('[Circular]')
    expect(formatJson('x'.repeat(50), 10)).toMatchObject({ truncated: true })
  })

  it('copies the visible text including code', () => {
    expect(
      partsToPlainText([
        {
          id: 'a',
          kind: 'text',
          revision: 1,
          format: 'markdown',
          text: '**Hi**\n\n```js\nx()\n```',
        },
        { id: 'b', kind: 'reference', sourceId: 'doc' },
      ]),
    ).toBe('Hi\n\nx()')
  })
})
