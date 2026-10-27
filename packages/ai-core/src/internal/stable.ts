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
