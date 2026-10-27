/**
 * Deterministic structural helpers shared by snapshots, idempotency
 * fingerprints and reducer immutability checks. Internal: not re-exported.
 */

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null'
  }

  if (Array.isArray(value)) {
    return `[${value.map(entry => stableStringify(entry)).join(',')}]`
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
    .filter(key => record[key] !== undefined)
    .sort()

  return `{${keys
    .map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

export function stableEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true

  return stableStringify(left) === stableStringify(right)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Deep-copy plain data (arrays and plain objects) and freeze the copy. Used at
 * the store boundary so canonical state never aliases an object the caller
 * still holds: mutating an ingested event or a loaded snapshot afterwards can
 * not rewrite state behind the subscribers' back. Non-plain objects (only
 * reachable through `unknown` previews) are kept by reference.
 */
export function freezeClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(entry => freezeClone(entry))) as T
  }

  if (!isPlainRecord(value)) return value

  const copy: Record<string, unknown> = {}

  for (const key of Object.keys(value)) {
    copy[key] = freezeClone(value[key])
  }

  return Object.freeze(copy) as T
}
