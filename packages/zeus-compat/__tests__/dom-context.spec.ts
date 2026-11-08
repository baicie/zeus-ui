import type { DOMContext } from '../src'

import { afterEach, describe, expect, it } from 'vitest'

import {
  createContext,
  createRoot,
  defineElement,
  provideDOMContext,
  resolveDOMContext,
  useContext,
} from '../src'

function createTree(): {
  outer: HTMLElement
  inner: HTMLElement
  leaf: HTMLElement
} {
  const outer = globalThis.document.createElement('div')
  const inner = globalThis.document.createElement('div')
  const leaf = globalThis.document.createElement('span')

  inner.append(leaf)
  outer.append(inner)
  globalThis.document.body.append(outer)

  return { outer, inner, leaf }
}

afterEach(() => {
  globalThis.document.body.replaceChildren()
})

describe('@zeus-web/zeus-compat DOM context', () => {
  it('resolves the nearest provider and stops at it', () => {
    const context = createContext<string>()
    const { outer, inner, leaf } = createTree()
    let outerRequests = 0

    outer.addEventListener('zeus:context-request', () => {
      outerRequests += 1
    })

    createRoot(dispose => {
      provideDOMContext(outer, context, 'outer')
      provideDOMContext(inner, context, 'inner')

      expect(resolveDOMContext(leaf, context)).toEqual({
        found: true,
        value: 'inner',
      })
      expect(outerRequests).toBe(0)
      dispose()
    })
  })

  it('distinguishes a missing provider from a provided undefined value', () => {
    const context = createContext<string | undefined>()
    const other = createContext<string>()
    const { outer, leaf } = createTree()

    expect(resolveDOMContext(leaf, context)).toEqual({
      found: false,
      value: undefined,
    })

    createRoot(dispose => {
      provideDOMContext(outer, context, undefined)
      provideDOMContext(outer, other, 'other')

      expect(resolveDOMContext(leaf, context)).toEqual({
        found: true,
        value: undefined,
      })
      expect(resolveDOMContext(leaf, other)).toEqual({
        found: true,
        value: 'other',
      })
      dispose()
    })
  })

  it('removes the provider listener when its owner scope is disposed', () => {
    const context = createContext<number>()
    const { outer, leaf } = createTree()

    createRoot(dispose => {
      provideDOMContext(outer, context, 1)
      expect(resolveDOMContext(leaf, context).found).toBe(true)
      dispose()
    })

    expect(resolveDOMContext(leaf, context)).toEqual({
      found: false,
      value: undefined,
    })
  })

  it('matches lazy-entry contexts by Symbol.for identity', () => {
    const provided = {
      id: Symbol.for('@zeus-web/zeus-compat/test-context'),
    } as DOMContext<string>
    const consumed = {
      id: Symbol.for('@zeus-web/zeus-compat/test-context'),
    } as DOMContext<string>
    const { outer, leaf } = createTree()

    createRoot(dispose => {
      provideDOMContext(outer, provided, 'shared')
      expect(resolveDOMContext(leaf, consumed)).toEqual({
        found: true,
        value: 'shared',
      })
      dispose()
    })
  })

  it('answers the requests made by defineElement consumes', () => {
    const context = createContext('fallback')
    const seen: string[] = []

    defineElement(
      'zw-compat-context-consumer',
      { shadow: false, consumes: [context] },
      () => {
        seen.push(useContext(context))
        return null
      },
    )

    const { outer } = createTree()

    createRoot(dispose => {
      provideDOMContext(outer, context, 'from-compat')
      outer.append(
        globalThis.document.createElement('zw-compat-context-consumer'),
      )
      dispose()
    })

    expect(seen).toEqual(['from-compat'])
  })

  it('reads values provided by Context.Bridge', () => {
    const context = createContext<string>()
    const leaf = globalThis.document.createElement('span')

    createRoot(dispose => {
      const boundary = context.Bridge({
        value: 'bridged',
        children: leaf,
      }) as Element

      globalThis.document.body.append(boundary)
      expect(resolveDOMContext(leaf, context)).toEqual({
        found: true,
        value: 'bridged',
      })
      dispose()
    })
  })
})
