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

  it(
    'updates far faster than copying a plain record of the same size',
    { timeout: 30_000 },
    () => {
      const size = 5000
      const updates = 100
      let map = EntityMap.empty<number>()
      let record: Record<string, number> = {}
      for (let i = 0; i < size; i += 1) {
        map = map.set(`k${i}`, i)
        record[`k${i}`] = i
      }

      // Interleaved, best of three: machine load and GC hit both sides alike.
      let persistent = Infinity
      let copying = Infinity
      for (let round = 0; round < 3; round += 1) {
        let started = performance.now()
        for (let i = 0; i < updates; i += 1) map = map.set(`k${i}`, -i - round)
        persistent = Math.min(persistent, performance.now() - started)

        started = performance.now()
        for (let i = 0; i < updates; i += 1) {
          record = { ...record, [`k${i}`]: -i - round }
        }
        copying = Math.min(copying, performance.now() - started)
      }

      expect(map.get('k1')).toBe(-3)
      expect(record.k1).toBe(-3)
      // ~40x in practice; 5x leaves room for noisy CI machines.
      expect(persistent * 5).toBeLessThan(copying)
    },
  )
})
