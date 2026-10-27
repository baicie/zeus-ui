import { describe, expect, it } from 'vitest'
import { EntityMap, toEntityMap } from '../src/store/entity-map'

describe('entity map', () => {
  it('is persistent and shares untouched buckets', () => {
    const empty = EntityMap.empty<{ n: number }>()
    const one = empty.set('a', { n: 1 })
    const two = one.set('b', { n: 2 })

    expect(empty.size).toBe(0)
    expect(one.get('b')).toBeUndefined()
    expect(two.get('a')).toBe(one.get('a'))
    expect(two.set('a', two.get('a')!)).toBe(two)
    expect(Object.isFrozen(two)).toBe(true)
  })

  it('iterates in insertion order and keeps the slot of a replaced key', () => {
    let map = EntityMap.empty<number>()
    for (const key of ['z', 'a', 'm']) map = map.set(key, 1)
    map = map.set('a', 2)

    expect(map.keys()).toEqual(['z', 'a', 'm'])
    expect(map.values()).toEqual([1, 2, 1])
    expect(map.toJSON()).toEqual({ z: 1, a: 2, m: 1 })
    expect(JSON.parse(JSON.stringify(map))).toEqual({ z: 1, a: 2, m: 1 })
  })

  it('round-trips plain records', () => {
    const map = toEntityMap<number>({ b: 2, a: 1 })
    expect(map.keys()).toEqual(['b', 'a'])
    expect(toEntityMap(map)).toBe(map)
  })

  it('keeps per-update cost flat as the map grows', () => {
    let map = EntityMap.empty<number>()
    for (let i = 0; i < 20_000; i += 1) map = map.set(`k${i}`, i)
    const started = performance.now()
    for (let i = 0; i < 2000; i += 1) map = map.set(`k${i}`, -i)
    // ~2 ms per update with plain-object copies at this size.
    expect((performance.now() - started) / 2000).toBeLessThan(0.5)
  })
})
