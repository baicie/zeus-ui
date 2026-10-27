/**
 * Persistent entity map for canonical collections (AI2-107 / AI2-508).
 *
 * Copying a plain object with thousands of keys costs milliseconds in V8,
 * so "replace one entity" must not mean "copy the whole collection". An
 * `EntityMap` spreads entries over 64 hash buckets; `set` copies the bucket
 * table and one bucket and shares everything else, keeping per-event cost
 * roughly flat as a conversation grows.
 *
 * Maps are immutable: `set` returns a new map, and buckets are frozen.
 * Iteration (`keys`, `values`, `entries`) follows insertion order and is
 * cached per instance. `toJSON` produces a plain record, so snapshots,
 * checksums and the wire format are unchanged.
 */

/* eslint-disable e18e/prefer-object-has-own -- `Object.hasOwn` is ES2022; the repo targets ES2016. */

import type { EntityId } from '../domain/types'

const BUCKET_COUNT = 64

interface Slot<T> {
  readonly value: T
  /** Insertion order; preserved when an existing key is replaced. */
  readonly ordinal: number
}

type Bucket<T> = Readonly<Record<EntityId, Slot<T>>>

function bucketOf(id: string): number {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash % BUCKET_COUNT
}

interface OrderCache<T> {
  keys: readonly EntityId[]
  values: readonly T[]
}

const orderCache = new WeakMap<object, OrderCache<unknown>>()
const EMPTY_BUCKETS = Object.freeze(
  Array.from({ length: BUCKET_COUNT }).fill(undefined),
) as readonly (Bucket<never> | undefined)[]

export class EntityMap<T> {
  private readonly buckets: readonly (Bucket<T> | undefined)[]
  readonly size: number
  private readonly nextOrdinal: number

  private constructor(
    buckets: readonly (Bucket<T> | undefined)[],
    size: number,
    nextOrdinal: number,
  ) {
    this.buckets = buckets
    this.size = size
    this.nextOrdinal = nextOrdinal
    Object.freeze(this)
  }

  static empty<T>(): EntityMap<T> {
    return new EntityMap<T>(
      EMPTY_BUCKETS as readonly (Bucket<T> | undefined)[],
      0,
      0,
    )
  }

  /** Build from a plain record; record key order becomes insertion order. */
  static fromRecord<T>(record: Readonly<Record<EntityId, T>>): EntityMap<T> {
    const buckets: Record<EntityId, Slot<T>>[] = []
    let size = 0
    for (const id of Object.keys(record)) {
      const index = bucketOf(id)
      const bucket = (buckets[index] ??= {})
      if (!(id in bucket)) size += 1
      bucket[id] = Object.freeze({ value: record[id], ordinal: size })
    }
    const frozen = Array.from({ length: BUCKET_COUNT }, (_, index) =>
      buckets[index] ? Object.freeze(buckets[index]) : undefined,
    )
    return new EntityMap<T>(Object.freeze(frozen), size, size + 1)
  }

  get(id: EntityId): T | undefined {
    const bucket = this.buckets[bucketOf(id)]
    return bucket && Object.prototype.hasOwnProperty.call(bucket, id)
      ? bucket[id].value
      : undefined
  }

  has(id: EntityId): boolean {
    const bucket = this.buckets[bucketOf(id)]
    return (
      bucket !== undefined && Object.prototype.hasOwnProperty.call(bucket, id)
    )
  }

  /** A new map with `id` set; untouched buckets are shared. */
  set(id: EntityId, value: T): EntityMap<T> {
    const index = bucketOf(id)
    const bucket = this.buckets[index]
    const existing =
      bucket && Object.prototype.hasOwnProperty.call(bucket, id)
        ? bucket[id]
        : undefined
    if (existing && existing.value === value) return this

    const nextBucket = Object.freeze({
      ...bucket,
      [id]: Object.freeze({
        value,
        ordinal: existing ? existing.ordinal : this.nextOrdinal,
      }),
    })
    const buckets = this.buckets.slice()
    buckets[index] = nextBucket

    return new EntityMap<T>(
      Object.freeze(buckets),
      existing ? this.size : this.size + 1,
      existing ? this.nextOrdinal : this.nextOrdinal + 1,
    )
  }

  private order(): OrderCache<T> {
    const cached = orderCache.get(this) as OrderCache<T> | undefined
    if (cached) return cached

    const slots: [EntityId, Slot<T>][] = []
    for (const bucket of this.buckets) {
      if (!bucket) continue
      for (const id of Object.keys(bucket)) slots.push([id, bucket[id]])
    }
    slots.sort((left, right) => left[1].ordinal - right[1].ordinal)

    const order: OrderCache<T> = {
      keys: Object.freeze(slots.map(([id]) => id)),
      values: Object.freeze(slots.map(([, slot]) => slot.value)),
    }
    orderCache.set(this, order as OrderCache<unknown>)
    return order
  }

  keys(): readonly EntityId[] {
    return this.order().keys
  }

  values(): readonly T[] {
    return this.order().values
  }

  entries(): [EntityId, T][] {
    const { keys, values } = this.order()
    return keys.map((id, index) => [id, values[index]])
  }

  /** Plain record in insertion order (snapshots, checksums, the wire). */
  toJSON(): Record<EntityId, T> {
    const record: Record<EntityId, T> = {}
    const { keys, values } = this.order()
    keys.forEach((id, index) => {
      record[id] = values[index]
    })
    return record
  }
}

/** Accept a live map or a plain record (parsed snapshot JSON). */
export function toEntityMap<T>(value: unknown): EntityMap<T> {
  if (value instanceof EntityMap) return value as EntityMap<T>
  return EntityMap.fromRecord((value ?? {}) as Record<EntityId, T>)
}
