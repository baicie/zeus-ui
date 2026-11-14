/* eslint-disable no-restricted-globals -- the workbench shell is browser code; `document` is its subject. */
/**
 * Syntax highlighting for answer code blocks.
 *
 * The AI content primitives ship a neutral code block — a `<figure>` with a
 * language label, a copy button and a `<pre><code>` holding plain text — and
 * say so: richer rendering is an application concern, registered by the app.
 * The workbench therefore does the highlighting here, after the block is in the
 * DOM, rather than teaching the primitive about languages.
 *
 * Why not a real highlighter: the reference answer is one short fenced block,
 * and a grammar engine (Shiki, highlight.js, Prism) is 30–900 kB for a surface
 * whose entire job is "show the model's code legibly". A tokenizer that colours
 * comments, strings, numbers and a language's keywords covers what a person
 * actually scans for, at no dependency cost. Comments below mark the limits
 * plainly: this is not a parser, and it does not try to be.
 *
 * Output is `<span class="wb-token wb-token-<kind>">`, so the palette lives in
 * CSS next to the rest of the code-block styling and follows the theme.
 */

type TokenKind =
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'function'
  | 'literal'

interface Rule {
  readonly kind: TokenKind
  readonly pattern: RegExp
}

/**
 * Per-language keyword sets. Deliberately small: a word that is not a control
 * keyword is still readable uncoloured, and a wrong colour is worse than none.
 * Languages absent from this map get strings, numbers and comments only, which
 * is already most of the visual structure.
 */
const KEYWORDS: Record<string, readonly string[]> = {
  javascript: [
    'const',
    'let',
    'var',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'do',
    'switch',
    'case',
    'break',
    'continue',
    'new',
    'class',
    'extends',
    'import',
    'export',
    'from',
    'default',
    'async',
    'await',
    'try',
    'catch',
    'finally',
    'throw',
    'typeof',
    'instanceof',
    'in',
    'of',
    'this',
    'super',
    'yield',
  ],
  typescript: [],
  python: [
    'def',
    'class',
    'return',
    'if',
    'elif',
    'else',
    'for',
    'while',
    'with',
    'as',
    'import',
    'from',
    'try',
    'except',
    'finally',
    'raise',
    'pass',
    'break',
    'continue',
    'lambda',
    'yield',
    'async',
    'await',
    'global',
    'nonlocal',
    'assert',
    'del',
  ],
  rust: [
    'fn',
    'let',
    'mut',
    'pub',
    'impl',
    'struct',
    'enum',
    'trait',
    'use',
    'mod',
    'match',
    'if',
    'else',
    'for',
    'while',
    'loop',
    'return',
    'self',
    'Self',
    'crate',
    'super',
    'where',
    'async',
    'await',
    'move',
    'ref',
    'const',
    'static',
  ],
  go: [
    'func',
    'var',
    'const',
    'type',
    'struct',
    'interface',
    'package',
    'import',
    'return',
    'if',
    'else',
    'for',
    'range',
    'switch',
    'case',
    'default',
    'go',
    'defer',
    'map',
    'chan',
    'select',
  ],
  sql: [
    'select',
    'from',
    'where',
    'insert',
    'into',
    'values',
    'update',
    'set',
    'delete',
    'create',
    'table',
    'alter',
    'drop',
    'join',
    'left',
    'right',
    'inner',
    'outer',
    'on',
    'group',
    'by',
    'order',
    'having',
    'limit',
    'offset',
    'as',
    'and',
    'or',
    'not',
    'null',
    'primary',
    'key',
    'foreign',
    'references',
  ],
  bash: [
    'if',
    'then',
    'else',
    'elif',
    'fi',
    'for',
    'in',
    'do',
    'done',
    'while',
    'case',
    'esac',
    'function',
    'return',
    'export',
    'local',
    'set',
    'echo',
    'cd',
    'source',
  ],
  json: [],
}

/** Aliases that mean the same grammar for the tokenizer's purposes. */
const LANG_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  rs: 'rust',
  golang: 'go',
}

/** Words that are not keywords but read as one to most people. */
const LITERALS = [
  'true',
  'false',
  'null',
  'undefined',
  'None',
  'True',
  'False',
  'nil',
]

const ESCAPED = String.raw`\\.`

function rulesFor(language: string | undefined): readonly Rule[] {
  const resolved =
    language === undefined
      ? ''
      : (LANG_ALIASES[language] ?? language).toLowerCase()
  // `typescript` inherits the JS keyword set: the extra syntax it adds is
  // types, which the tokenizer has no way to distinguish from identifiers.
  const keywords =
    resolved === 'typescript' ? KEYWORDS.javascript : (KEYWORDS[resolved] ?? [])
  const rules: Rule[] = [
    // Comments first, so a `#` or `//` inside a comment is not re-read as a
    // string delimiter.
    ...(resolved === 'python' || resolved === 'bash'
      ? [{ kind: 'comment' as const, pattern: /#[^\n]*/y }]
      : resolved === 'sql'
        ? [{ kind: 'comment' as const, pattern: /--[^\n]*/y }]
        : [
            { kind: 'comment' as const, pattern: /\/\/[^\n]*/y },
            { kind: 'comment' as const, pattern: /\/\*[\s\S]*?\*\//y },
          ]),
    {
      kind: 'string',
      pattern: new RegExp(`"(?:[^"\\\\\\n]|${ESCAPED})*"?`, 'y'),
    },
    {
      kind: 'string',
      pattern: new RegExp(`'(?:[^'\\\\\\n]|${ESCAPED})*'?`, 'y'),
    },
    { kind: 'string', pattern: /`[^`]*`?/y },
    {
      kind: 'number',
      pattern: /\b(?:0x[\da-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/iy,
    },
  ]
  if (keywords.length > 0) {
    rules.push({
      kind: 'keyword',
      pattern: new RegExp(`\\b(?:${keywords.join('|')})\\b`, 'y'),
    })
  }
  rules.push({
    kind: 'literal',
    pattern: new RegExp(`\\b(?:${LITERALS.join('|')})\\b`, 'y'),
  })
  // A call-looking identifier: colouring these gives the block the shape the
  // reference has without pretending to know a symbol table.
  rules.push({ kind: 'function', pattern: /[A-Z_$][\w$]*(?=\s*\()/iy })
  return rules
}

/** Splits `source` into coloured and plain runs. Never throws, never reorders. */
export function tokenize(
  source: string,
  language: string | undefined,
): Array<{ text: string; kind: TokenKind | undefined }> {
  const rules = rulesFor(language)
  const runs: Array<{ text: string; kind: TokenKind | undefined }> = []
  let index = 0
  let plain = ''

  while (index < source.length) {
    let matched = false
    for (const rule of rules) {
      rule.pattern.lastIndex = index
      const match = rule.pattern.exec(source)
      if (!match || match[0].length === 0) continue
      if (plain) {
        runs.push({ text: plain, kind: undefined })
        plain = ''
      }
      runs.push({ text: match[0], kind: rule.kind })
      index += match[0].length
      matched = true
      break
    }
    if (matched) continue
    plain += source[index]
    index += 1
  }
  if (plain) runs.push({ text: plain, kind: undefined })
  return runs
}

/**
 * Highlights every code block inside `root` that has not been highlighted yet.
 *
 * Idempotent by construction: a block is marked once it is processed, so a
 * streaming answer that re-renders its body does not re-colour (and does not
 * lose the reader's selection in) blocks that already have tokens.
 *
 * A streaming block is *not* left plain: partial code is exactly when colouring
 * helps most, and re-tokenizing a block whose text grew is cheap. The marker
 * therefore records the length it was highlighted at.
 */
export function highlightCodeBlocks(root: ParentNode): void {
  for (const code of root.querySelectorAll<HTMLElement>(
    'figure[data-part="code"] code',
  )) {
    const figure = code.closest<HTMLElement>('figure[data-part="code"]')
    if (!figure) continue
    const source = code.textContent ?? ''
    if (source.length === 0) continue
    const previous = Number(code.dataset.highlightedLength ?? '-1')
    if (previous === source.length) continue

    const language = figure.dataset.language
    const fragment = document.createDocumentFragment()
    for (const run of tokenize(source, language)) {
      if (run.kind === undefined) {
        fragment.append(document.createTextNode(run.text))
        continue
      }
      const span = document.createElement('span')
      span.className = `wb-token wb-token-${run.kind}`
      span.textContent = run.text
      fragment.append(span)
    }
    code.replaceChildren(fragment)
    code.dataset.highlightedLength = String(source.length)
  }
}
