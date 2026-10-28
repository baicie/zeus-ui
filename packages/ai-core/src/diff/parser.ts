/**
 * Unified diff parser and hunk index (AI2-402).
 *
 * Diffs are untrusted text from the host or a tool. The parser produces
 * plain data — line kinds, numbers and raw text — that renderers must emit as
 * text, never as HTML. Hunk headers are checked against the lines they
 * claim, paths go through the same safety rule as change-set paths, and
 * oversized input is truncated with an explicit flag instead of being
 * rendered in full.
 *
 * Hunk ids are content hashes of path + header + lines, so a review anchor
 * stays attached to the same hunk across reloads and becomes "outdated" as
 * soon as a new change-set revision changes that hunk.
 */

import { isSafeRelativePath } from '../protocol/validation'

export type DiffLineKind = 'context' | 'add' | 'delete' | 'note'

export interface DiffLine {
  kind: DiffLineKind
  /** Line text without the leading marker. */
  text: string
  oldLine?: number
  newLine?: number
}

export interface DiffHunk {
  id: string
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  /** Trailing context after `@@ … @@`, usually a function name. */
  section?: string
  lines: readonly DiffLine[]
}

export interface FileDiff {
  path: string
  oldPath?: string
  binary: boolean
  hunks: readonly DiffHunk[]
  /** The input exceeded `maxLines`; later hunks were dropped. */
  truncated: boolean
}

export interface ParseDiffOptions {
  /** Path to use when the text has no `---/+++` headers. */
  path?: string
  /** Stop after this many diff lines. Default 20 000. */
  maxLines?: number
}

export type ParseDiffResult =
  | { ok: true; files: readonly FileDiff[] }
  | { ok: false; code: 'invalid-hunk' | 'unsafe-path'; message: string }

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

/** FNV-1a, enough to give hunks stable, comparable ids. Not a security hash. */
function hash(text: string): string {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619) >>> 0
  }
  return `00000000${value.toString(16)}`.slice(-8)
}

function stripPrefix(path: string): string | undefined {
  if (path === '/dev/null') return undefined
  const trimmed = path.split('\t')[0]
  return trimmed.replace(/^[ab]\//, '')
}

export function parseUnifiedDiff(
  text: string,
  options: ParseDiffOptions = {},
): ParseDiffResult {
  const maxLines = options.maxLines ?? 20_000
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  if (lines[lines.length - 1] === '') lines.pop()

  const files: FileDiff[] = []
  let file: (FileDiff & { hunks: DiffHunk[] }) | undefined
  let hunk: (DiffHunk & { lines: DiffLine[] }) | undefined
  let oldLine = 0
  let newLine = 0
  let consumed = 0

  function startFile(
    path: string | undefined,
    oldPath?: string,
  ): ParseDiffResult | null {
    const target = path ?? oldPath ?? options.path
    if (target === undefined) {
      return {
        ok: false,
        code: 'unsafe-path',
        message: 'diff has no file path',
      }
    }
    for (const candidate of [target, oldPath]) {
      if (candidate !== undefined && !isSafeRelativePath(candidate)) {
        return {
          ok: false,
          code: 'unsafe-path',
          message: `diff path ${JSON.stringify(candidate)} is not a safe relative path`,
        }
      }
    }
    file = {
      path: target,
      oldPath:
        oldPath !== undefined && oldPath !== target ? oldPath : undefined,
      binary: false,
      hunks: [],
      truncated: false,
    }
    files.push(file)
    return null
  }

  function closeHunk(): ParseDiffResult | null {
    if (!hunk || !file) return null
    const olds = hunk.lines.filter(
      line => line.kind !== 'add' && line.kind !== 'note',
    ).length
    const news = hunk.lines.filter(
      line => line.kind !== 'delete' && line.kind !== 'note',
    ).length

    if (olds !== hunk.oldLines || news !== hunk.newLines) {
      return {
        ok: false,
        code: 'invalid-hunk',
        message: `${file.path} ${hunk.header} claims -${hunk.oldLines} +${hunk.newLines} but has -${olds} +${news}`,
      }
    }

    hunk.id = `h-${hash(`${file.path}\n${hunk.header}\n${hunk.lines.map(line => `${line.kind}:${line.text}`).join('\n')}`)}`
    file.hunks.push(hunk)
    hunk = undefined
    return null
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (consumed >= maxLines) {
      if (file) file.truncated = true
      hunk = undefined
      break
    }

    if (line.startsWith('diff --git ')) {
      const failure = closeHunk()
      if (failure) return failure
      file = undefined
      continue
    }

    if (line.startsWith('--- ') && lines[index + 1]?.startsWith('+++ ')) {
      const failure =
        closeHunk() ??
        startFile(
          stripPrefix(lines[index + 1].slice(4)),
          stripPrefix(line.slice(4)),
        )
      if (failure) return failure
      index += 1
      continue
    }

    if (line.startsWith('Binary files ')) {
      if (!file) {
        const failure = startFile(options.path)
        if (failure) return failure
      }
      if (file) file.binary = true
      continue
    }

    const header = HUNK_HEADER.exec(line)
    if (header) {
      const failure = closeHunk() ?? (file ? null : startFile(options.path))
      if (failure) return failure
      oldLine = Number(header[1])
      newLine = Number(header[3])
      hunk = {
        id: '',
        header: line.slice(0, line.indexOf('@@', 2) + 2),
        oldStart: oldLine,
        oldLines: header[2] === undefined ? 1 : Number(header[2]),
        newStart: newLine,
        newLines: header[4] === undefined ? 1 : Number(header[4]),
        section: header[5].trim() || undefined,
        lines: [],
      }
      continue
    }

    if (!hunk) continue
    consumed += 1

    const marker = line[0]
    const body = line.slice(1)

    if (marker === '+') {
      hunk.lines.push({ kind: 'add', text: body, newLine: newLine++ })
    } else if (marker === '-') {
      hunk.lines.push({ kind: 'delete', text: body, oldLine: oldLine++ })
    } else if (marker === ' ' || line === '') {
      hunk.lines.push({
        kind: 'context',
        text: body,
        oldLine: oldLine++,
        newLine: newLine++,
      })
    } else if (marker === '\\') {
      hunk.lines.push({ kind: 'note', text: line.slice(2) })
    } else {
      return {
        ok: false,
        code: 'invalid-hunk',
        message: `unexpected diff line ${JSON.stringify(line.slice(0, 40))}`,
      }
    }
  }

  const failure = closeHunk()
  if (failure) return failure

  return { ok: true, files }
}

/** Split a large hunk list into pages a renderer can mount lazily. */
export function pageHunks(
  hunks: readonly DiffHunk[],
  linesPerPage: number,
): DiffHunk[][] {
  const pages: DiffHunk[][] = []
  let page: DiffHunk[] = []
  let size = 0

  for (const hunk of hunks) {
    if (page.length > 0 && size + hunk.lines.length > linesPerPage) {
      pages.push(page)
      page = []
      size = 0
    }
    page.push(hunk)
    size += hunk.lines.length
  }
  if (page.length > 0) pages.push(page)

  return pages
}

export interface SideBySideRow {
  left?: DiffLine
  right?: DiffLine
}

/** Pair deletions with additions for a side-by-side view. */
export function toSideBySide(hunk: DiffHunk): SideBySideRow[] {
  const rows: SideBySideRow[] = []
  let deletes: DiffLine[] = []
  let adds: DiffLine[] = []

  function flush(): void {
    const count = Math.max(deletes.length, adds.length)
    for (let index = 0; index < count; index += 1) {
      rows.push({ left: deletes[index], right: adds[index] })
    }
    deletes = []
    adds = []
  }

  for (const line of hunk.lines) {
    if (line.kind === 'delete') {
      deletes.push(line)
    } else if (line.kind === 'add') {
      adds.push(line)
    } else {
      flush()
      rows.push(
        line.kind === 'note' ? { left: line } : { left: line, right: line },
      )
    }
  }
  flush()

  return rows
}
