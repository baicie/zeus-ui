import { describe, expect, it } from 'vitest'

import { tokenize } from '../../../examples/ai-workbench/src/highlight'

/**
 * The highlighter is the workbench's own, because the AI content primitive
 * ships a framework-neutral code block and leaves colouring to the application.
 * These tests pin the two things that matter: the tokens it produces, and the
 * property that makes it safe to run on a re-rendering stream — idempotence.
 */
function kinds(source: string, language?: string): Array<[string, string]> {
  return tokenize(source, language).map(run => [run.kind ?? 'plain', run.text])
}

describe('code tokenizer', () => {
  it('colours Python keywords, calls, comments, strings and numbers', () => {
    expect(
      kinds(
        'def hello():\n    # greet\n    print("hello")\n    return 42',
        'python',
      ),
    ).toEqual([
      ['keyword', 'def'],
      ['plain', ' '],
      ['function', 'hello'],
      ['plain', '():\n    '],
      ['comment', '# greet'],
      ['plain', '\n    '],
      ['function', 'print'],
      ['plain', '('],
      ['string', '"hello"'],
      ['plain', ')\n    '],
      ['keyword', 'return'],
      ['plain', ' '],
      ['number', '42'],
    ])
  })

  it('uses // and /* */ for JavaScript and # for Python', () => {
    expect(kinds('// note', 'javascript')).toEqual([['comment', '// note']])
    expect(kinds('/* a */', 'javascript')).toEqual([['comment', '/* a */']])
    // `#` is not a JS comment, so it must stay plain there.
    expect(kinds('# nope', 'javascript')).toEqual([['plain', '# nope']])
  })

  it('resolves aliases so `py`, `sh` and `ts` behave like their language', () => {
    expect(kinds('def f', 'py')).toEqual([
      ['keyword', 'def'],
      ['plain', ' f'],
    ])
    expect(kinds('if true', 'ts')).toEqual([
      ['keyword', 'if'],
      ['plain', ' '],
      ['literal', 'true'],
    ])
    // `echo` is in the bash keyword set, so it reads as a keyword there.
    expect(kinds('echo hi', 'sh')[0]).toEqual(['keyword', 'echo'])
  })

  it('never loses or reorders a character', () => {
    for (const [source, language] of [
      ['const x = "a\\"b" // tail', 'javascript'],
      ['select * from t where id = 1', 'sql'],
      ['let mut x = 1; // c', 'rust'],
      ['unterminated "string', 'json'],
      ['', 'python'],
    ] as const) {
      const joined = tokenize(source, language)
        .map(run => run.text)
        .join('')
      expect(joined, source).toBe(source)
    }
  })

  it('leaves an unknown language uncoloured beyond numbers', () => {
    // No grammar means no keywords; adjacent plain text is one run, not one
    // per word, so the assertion is on the kinds present, not their count.
    const kindsFound = tokenize('alpha beta 1', 'cobol').map(
      run => run.kind ?? 'plain',
    )
    expect(kindsFound).toEqual(['plain', 'number'])
  })
})
