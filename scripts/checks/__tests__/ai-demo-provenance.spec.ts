import { execFile } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { afterEach, describe, expect, it } from 'vitest'

/**
 * The AI demo recording is the Workbench demo's only statement of provenance:
 * the published site replays this file and nothing else records which commits
 * produced it. The demos workflow passed the *Core* SHA here before R6, so the
 * published `uiCommit` named a commit that never built the bundle.
 *
 * Each run below boots the real reference Host over HTTP, the same code the
 * replay adapter stands in for, so the assertion is about the file a published
 * demo would ship.
 */
const run = promisify(execFile)
const root = path.resolve(import.meta.dirname, '../../..')
const script = path.join(root, 'scripts/release/ai-demo-recording.ts')
const roots: string[] = []

afterEach(() => {
  for (const directory of roots.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

const CORE_SHA = 'a'.repeat(40)
const UI_SHA = 'b'.repeat(40)

function scratch(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'zeus-ai-recording-'))
  roots.push(directory)
  return directory
}

function invoke(args: readonly string[]): Promise<{ stdout: string }> {
  return run(process.execPath, ['--import', 'tsx', script, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 180_000,
  })
}

async function failure(args: readonly string[]): Promise<string> {
  try {
    await invoke(args)
  } catch (error) {
    const failed = error as { stderr?: string; message?: string }
    return `${failed.stderr ?? ''}${failed.message ?? ''}`
  }
  throw new Error(`expected the recording to fail with ${args.join(' ')}`)
}

describe('ai demo recording provenance', () => {
  it('requires both commits and rejects a malformed SHA', async () => {
    const out = path.join(scratch(), 'recording.json')

    expect(await failure(['--out', out, '--core-commit', CORE_SHA])).toMatch(
      '--ui-commit is required',
    )
    expect(await failure(['--out', out, '--ui-commit', UI_SHA])).toMatch(
      '--core-commit is required',
    )
    expect(
      await failure([
        '--out',
        out,
        '--ui-commit',
        UI_SHA.toUpperCase(),
        '--core-commit',
        CORE_SHA,
      ]),
    ).toMatch('--ui-commit must be a full 40-character lowercase SHA')
    // The exact shape of the bug: the workflow passed the Core SHA in and the
    // recorder wrote it as the UI commit. A correct SHA is required now, but a
    // duplicate is a pairing error the manifest gate rejects; here we only own
    // the recorder's own contract.
    expect(
      await failure([
        '--out',
        out,
        '--ui-commit',
        'main',
        '--core-commit',
        CORE_SHA,
      ]),
    ).toMatch('--ui-commit must be a full 40-character lowercase SHA')
  })

  it('records the UI and Core commits in the recording it writes', async () => {
    const out = path.join(scratch(), 'recording.json')
    await invoke([
      '--out',
      out,
      '--ui-commit',
      UI_SHA,
      '--core-commit',
      CORE_SHA,
    ])

    const recording = JSON.parse(readFileSync(out, 'utf8')) as Record<
      string,
      unknown
    >
    expect(recording.schema).toBe('zeus.ai-demo/v1')
    expect(recording.uiCommit).toBe(UI_SHA)
    expect(recording.coreCommit).toBe(CORE_SHA)
    expect((recording.events as unknown[]).length).toBeGreaterThan(0)
    // Diffs are served as assets, not embedded in the stream; a recording
    // without them replays as "asset unavailable".
    expect(Object.keys(recording.assets as object).length).toBeGreaterThan(0)
  })

  it('names the same pair and the same stream every time it runs', async () => {
    // The recording is made from a live Host, so ids and timestamps are the
    // Host's own and differ per run. What must not differ is what makes the
    // file a *pairing* record: the commits, the stream identity, the sequence
    // of domain events and the diff assets that sequence implies. Requiring
    // byte equality here would mean freezing the Host's clock and UUIDs, which
    // would be testing the Host's determinism, not the demo's provenance.
    const first = path.join(scratch(), 'first.json')
    const second = path.join(scratch(), 'second.json')
    const args = ['--ui-commit', UI_SHA, '--core-commit', CORE_SHA]
    await invoke(['--out', first, ...args])
    await invoke(['--out', second, ...args])

    interface Event {
      type?: string
      payload?: unknown
    }
    const identity = (file: string) => {
      const value = JSON.parse(readFileSync(file, 'utf8')) as {
        schema?: string
        uiCommit?: string
        coreCommit?: string
        streamId?: string
        events?: Event[]
        assets?: Record<string, string>
      }
      return {
        schema: value.schema,
        uiCommit: value.uiCommit,
        coreCommit: value.coreCommit,
        streamId: value.streamId,
        eventTypes: (value.events ?? []).map(event => event.type),
        // Asset ids embed the approval id, so compare what the assets *are*.
        assetBodies: Object.values(value.assets ?? {}).sort(),
      }
    }
    expect(identity(second)).toEqual(identity(first))
  })
})
