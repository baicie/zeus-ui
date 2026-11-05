export interface DiffFile {
  readonly path: string
  readonly previous: string
  readonly next: string
}

/**
 * Produces a bounded unified diff for host-side review. Paths are always
 * relative display paths; absolute workspace roots never leave the host.
 */
export function createUnifiedDiff(file: DiffFile): string {
  const before = splitLines(file.previous)
  const after = splitLines(file.next)
  const hunks = diffHunks(before, after)
  if (hunks.length === 0) return ''
  const header = [`--- a/${file.path}`, `+++ b/${file.path}`]
  return `${header.join('\n')}\n${hunks.join('\n')}\n`
}

export function countDiffLines(diff: string): {
  readonly additions: number
  readonly deletions: number
} {
  let additions = 0
  let deletions = 0
  for (const line of diff.split('\n')) {
    if (
      line.startsWith('+++') ||
      line.startsWith('---') ||
      line.startsWith('@@')
    ) {
      continue
    }
    if (line.startsWith('+')) additions += 1
    else if (line.startsWith('-')) deletions += 1
  }
  return { additions, deletions }
}

function diffHunks(
  before: readonly string[],
  after: readonly string[],
): string[] {
  const edits = simpleEdits(before, after)
  if (edits.length === 0) return []
  return [renderHunk(edits, before.length, after.length)]
}

interface Edit {
  readonly kind: 'equal' | 'insert' | 'delete'
  readonly line: string
}

function simpleEdits(
  before: readonly string[],
  after: readonly string[],
): Edit[] {
  const prefix = commonPrefix(before, after)
  const suffix = commonSuffix(before, after, prefix)
  const edits: Edit[] = []
  for (let index = 0; index < prefix; index += 1) {
    edits.push({ kind: 'equal', line: before[index]! })
  }
  for (let index = prefix; index < before.length - suffix; index += 1) {
    edits.push({ kind: 'delete', line: before[index]! })
  }
  for (let index = prefix; index < after.length - suffix; index += 1) {
    edits.push({ kind: 'insert', line: after[index]! })
  }
  for (let index = after.length - suffix; index < after.length; index += 1) {
    edits.push({ kind: 'equal', line: after[index]! })
  }
  return edits
}

function commonPrefix(
  left: readonly string[],
  right: readonly string[],
): number {
  let index = 0
  while (
    index < left.length &&
    index < right.length &&
    left[index] === right[index]
  ) {
    index += 1
  }
  return index
}

function commonSuffix(
  left: readonly string[],
  right: readonly string[],
  prefix: number,
): number {
  let count = 0
  while (
    count < left.length - prefix &&
    count < right.length - prefix &&
    left[left.length - 1 - count] === right[right.length - 1 - count]
  ) {
    count += 1
  }
  return count
}

function renderHunk(
  edits: readonly Edit[],
  beforeLength: number,
  afterLength: number,
): string {
  const lines = edits.map(edit => `${prefixFor(edit.kind)}${edit.line}`)
  return [`@@ -1,${beforeLength} +1,${afterLength} @@`, ...lines].join('\n')
}

function prefixFor(kind: Edit['kind']): string {
  return kind === 'insert' ? '+' : kind === 'delete' ? '-' : ' '
}

function splitLines(value: string): string[] {
  if (value.length === 0) return []
  return value.replace(/\r\n/g, '\n').split('\n').slice(0, -1)
}
