import { describe, expect, it } from 'vitest'

import { collectSelectors } from '../build/check-ui-tarball-baseline'

describe('ui tarball baseline: component css selector extraction', () => {
  it('collects every selector of a plain rule and drops comments', () => {
    const css = `
      /* zw-input { color: red; } inside a comment */
      zw-input [part='root'],
      zw-select [part='root'] {
        color: red;
      }
    `

    expect(collectSelectors(css)).toEqual([
      "zw-input [part='root']",
      "zw-select [part='root']",
    ])
  })

  it('keeps rules inside @media while ignoring the at-rule prelude', () => {
    const css = `
      @media (prefers-reduced-motion: reduce) {
        zw-progress [part='indicator'] {
          animation: none;
        }
      }
    `

    expect(collectSelectors(css)).toEqual(["zw-progress [part='indicator']"])
  })

  it('skips keyframe steps so 50% / from / to are not read as selectors', () => {
    const css = `
      @keyframes zw-spin {
        0% { transform: rotate(0deg); }
        50% { transform: rotate(180deg); }
        100% { transform: rotate(360deg); }
      }
      zw-skeleton [part='root'] {
        animation: zw-spin 1s linear infinite;
      }
    `

    expect(collectSelectors(css)).toEqual(["zw-skeleton [part='root']"])
  })

  it('ignores nested @supports preludes but keeps their rules', () => {
    const css = `
      @supports (animation-timeline: scroll()) {
        zw-data-grid [part='body'] {
          animation-timeline: scroll();
        }
      }
    `

    expect(collectSelectors(css)).toEqual(["zw-data-grid [part='body']"])
  })

  it('reports nothing for an empty stylesheet', () => {
    expect(collectSelectors('')).toEqual([])
  })
})
