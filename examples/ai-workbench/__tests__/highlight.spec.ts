/* eslint-disable no-restricted-globals */
/**
 * DOM contract for the answer code highlighter.
 *
 * The tokenizer itself is unit-tested next to the code; this file pins the part
 * that only exists in a document: the spans it writes, and the idempotence that
 * makes it safe to run on a streaming answer.
 */
import { describe, expect, it } from 'vitest'

import { highlightCodeBlocks } from '../src/highlight'

describe('highlightCodeBlocks', () => {
  function codeBlock(text: string, language: string): HTMLElement {
    const figure = document.createElement('figure')
    figure.dataset.part = 'code'
    figure.dataset.language = language
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.textContent = text
    pre.append(code)
    figure.append(pre)
    return figure
  }

  it('wraps tokens in spans and keeps the code text intact', () => {
    const figure = codeBlock('return 1', 'python')
    document.body.append(figure)

    highlightCodeBlocks(document.body)

    const code = figure.querySelector('code')!
    expect(code.textContent).toBe('return 1')
    expect(code.querySelectorAll('.wb-token-keyword').length).toBe(1)
    expect(code.querySelector('.wb-token-number')?.textContent).toBe('1')
    figure.remove()
  })

  it('is idempotent: a second pass does not re-wrap', () => {
    const figure = codeBlock('print("x")', 'python')
    document.body.append(figure)

    highlightCodeBlocks(document.body)
    const first = figure.querySelector('code')!.innerHTML
    highlightCodeBlocks(document.body)

    expect(figure.querySelector('code')!.innerHTML).toBe(first)
    expect(figure.querySelectorAll('.wb-token').length).toBe(2)
    figure.remove()
  })

  it('re-highlights a streaming block whose text grew', () => {
    const figure = codeBlock('def f', 'python')
    document.body.append(figure)

    highlightCodeBlocks(document.body)
    expect(figure.querySelectorAll('.wb-token').length).toBe(1)

    figure.querySelector('code')!.textContent = 'def f(x):\n    return x'
    highlightCodeBlocks(document.body)

    const code = figure.querySelector('code')!
    expect(code.textContent).toBe('def f(x):\n    return x')
    expect(code.querySelectorAll('.wb-token-keyword').length).toBe(2)
    figure.remove()
  })

  it('ignores code blocks with no language rather than guessing', () => {
    const figure = codeBlock('plain words only', '')
    delete figure.dataset.language
    document.body.append(figure)

    highlightCodeBlocks(document.body)

    // No grammar means no keyword colouring; the block keeps its text.
    expect(figure.querySelector('code')!.textContent).toBe('plain words only')
    figure.remove()
  })
})
