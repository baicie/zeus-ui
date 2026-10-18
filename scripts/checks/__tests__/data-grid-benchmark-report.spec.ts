import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('data-grid benchmark report contract', () => {
  it('accepts benchmark JSON lines as a report source', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zeus-data-grid-report-'))
    const input = join(directory, 'results.log')
    const output = join(directory, 'report.json')
    await writeFile(
      input,
      [
        '[data-grid:benchmark] {"kind":"render","result":{"name":"10k rows x 20 columns","firstRenderMs":12,"dom":{"renderedCells":21,"totalElements":30}}}',
        'unrelated vitest output',
      ].join('\n'),
    )

    const command = `${process.execPath} --import tsx scripts/checks/data-grid/report-benchmark.ts ${input} ${output}`
    const { execa } = await import('execa')
    await execa(command, { shell: true, cwd: process.cwd() })

    const report = JSON.parse(await readFile(output, 'utf8'))
    expect(report.schemaVersion).toBe(1)
    expect(report.runCount).toBe(1)
    expect(report.runs[0]).toEqual({
      kind: 'render',
      scenario: '10k rows x 20 columns',
      metrics: {
        firstRenderMs: 12,
        renderedCells: 21,
        totalElements: 30,
      },
    })

    await rm(directory, { recursive: true, force: true })
  })
})
