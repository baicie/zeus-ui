import type {
  Workflow,
  WorkflowStep,
} from '../../release/assert-verify-workflow-is-read-only.d.mts'
import type { VerificationDependencies } from '../../release/verify-historical-release.d.mts'
import { Buffer } from 'node:buffer'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'

import { tmpdir } from 'node:os'

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  checkVerifyWorkflow,
  findPermissionOffences,
  findPublishOffences,
  stripShellComments,
} from '../../release/assert-verify-workflow-is-read-only.mjs'
import {
  ITEMS,
  parseArgs,
  verifyHistoricalRelease,
} from '../../release/verify-historical-release.mjs'

function workflow(
  steps: WorkflowStep[],
  permissions: Record<string, unknown> = { contents: 'read' },
): Workflow {
  return { permissions, jobs: { verify: { permissions, steps } } }
}

describe('read-only guard', () => {
  it('allows a comment that describes what must not happen', () => {
    // The first version of this guard was a grep over the whole file and
    // failed on exactly this text. Prose is not a command.
    const offences = findPublishOffences(
      workflow([
        {
          name: 'documentation',
          run: '# never run npm publish here\nnode verify.mjs',
        },
      ]),
    )

    expect(offences).toEqual([])
  })

  it('allows the verification script name', () => {
    const offences = findPublishOffences(
      workflow([
        { name: 'verify', run: 'pnpm release:verify:published --version 1' },
      ]),
    )

    expect(offences).toEqual([])
  })

  it.each([
    ['npm publish', 'npm publish --access public'],
    ['pnpm publish', 'pnpm publish --tag beta'],
    ['dist-tag', 'npm dist-tag add @zeus-web/ui@1 latest'],
    ['unpublish', 'npm unpublish @zeus-web/ui@1'],
  ])('catches %s', (_label, command) => {
    const offences = findPublishOffences(
      workflow([{ name: 'x', run: command }]),
    )

    expect(offences.length).toBeGreaterThan(0)
    expect(offences[0]).toContain('publish')
  })

  it('catches a publish token even without a publish command', () => {
    const offences = findPublishOffences(
      workflow([
        {
          name: 'install',
          // Built by concatenation: the literal `${{ }}` would otherwise be
          // flagged as a template expression inside a plain string.
          env: {
            NODE_AUTH_TOKEN: ['$', '{{ secrets.NPM_PUBLISH_TOKEN }}'].join(''),
          },
          run: 'pnpm install',
        },
      ]),
    )

    expect(offences.join('\n')).toContain('NPM_PUBLISH_TOKEN')
  })

  it('rejects write permission anywhere', () => {
    // Workflow-level and job-level permissions are each checked.
    const offences = findPermissionOffences(workflow([], { contents: 'write' }))

    expect(offences).toHaveLength(2)
    expect(offences[0]).toContain('contents is write')
  })

  it('accepts the workflow in this repository', () => {
    expect(
      checkVerifyWorkflow('.github/workflows/verify-published-release.yml'),
    ).toEqual([])
  })

  it('strips only comments, not commands', () => {
    expect(stripShellComments('npm publish # trailing').trim()).toBe(
      'npm publish',
    )
    expect(stripShellComments('  # npm publish').trim()).toBe('')
  })
})

describe('historical release verification', () => {
  const target = mkdtempSync(join(tmpdir(), 'zeus-target-'))

  writeFileSync(
    join(target, 'package.json'),
    JSON.stringify({ name: 'zeus-ui-workspace', version: '0.1.0-beta.35' }),
  )

  const pkgDir = join(target, 'packages', 'button')

  mkdirSync(pkgDir, { recursive: true })

  writeFileSync(
    join(pkgDir, 'package.json'),
    JSON.stringify({
      name: '@zeus-web/button',
      version: '0.1.0-beta.35',
      dependencies: { '@zeus-js/zeus': '0.2.0-rc.5' },
    }),
  )

  const metadata = (version: string, latest: string) => ({
    status: 200,
    body: {
      'dist-tags': { beta: version, latest },
      versions: {
        [version]: {
          dist: {
            tarball: 'https://example.invalid/button.tgz',
            integrity: 'sha512-AAAA',
            attestations: {
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' },
            },
          },
        },
      },
    },
  })

  const deps = (
    overrides: VerificationDependencies = {},
  ): VerificationDependencies => ({
    fetchJson: async (url: string) => {
      if (url.includes('zeus-web%2Fbutton'))
        return metadata('0.1.0-beta.35', '0.1.0-beta.0')
      if (url.includes('zeus-js%2Fzeus'))
        return metadata('0.2.0-rc.5', '0.2.0-rc.5')
      return { status: 404, body: undefined }
    },
    downloadAndHash: async () => ({
      ok: true,
      sha512: Buffer.from('AAAA', 'base64').toString('hex'),
    }),
    ...overrides,
  })

  const baseOptions = {
    version: '0.1.0-beta.35',
    tag: 'beta',
    target,
    registry: 'https://registry.npmjs.org/',
  }

  it('reports the baseline as UNKNOWN when the original artifact is gone', async () => {
    /*
     * beta.35's publish run carries no baseline artifact — it was never
     * uploaded before this release. Deriving one from the post-release
     * registry would compare the release with itself and always pass.
     */
    const report = await verifyHistoricalRelease(
      { ...baseOptions, baselineFound: 'false' },
      deps(),
    )

    expect(report.items.HISTORICAL_LATEST_BASELINE.status).toBe('UNKNOWN')
    expect(report.baselineFound).toBe(false)
  })

  it('never returns PASS while an item is UNKNOWN', async () => {
    const report = await verifyHistoricalRelease(
      { ...baseOptions, baselineFound: 'false' },
      deps(),
    )

    expect(report.verdict).not.toBe('PASS')
    expect(report.verdict).toBe('INCOMPLETE')
  })

  it('returns PASS only when every item passes and the baseline is present', async () => {
    const report = await verifyHistoricalRelease(
      { ...baseOptions, baselineFound: 'true' },
      deps(),
    )

    expect(ITEMS.every(item => report.items[item].status === 'PASS')).toBe(true)
    expect(report.verdict).toBe('PASS')
  })

  it('fails when a tarball hash disagrees with dist.integrity', async () => {
    const report = await verifyHistoricalRelease(
      { ...baseOptions, baselineFound: 'true' },
      deps({
        downloadAndHash: async () => ({ ok: true, sha512: 'ff'.repeat(64) }),
      }),
    )

    expect(report.items.PACKAGE_INTEGRITY.status).toBe('FAIL')
    expect(report.items.PACKAGE_INTEGRITY.failures.join('\n')).toContain(
      'sha512 does not match',
    )
    expect(report.verdict).toBe('FAIL')
  })

  it('passes when the channel tag points at the verified version', async () => {
    const report = await verifyHistoricalRelease(
      { ...baseOptions, baselineFound: 'true' },
      deps({
        fetchJson: async (url: string) =>
          url.includes('zeus-web%2Fbutton')
            ? metadata('0.1.0-beta.35', '0.1.0-beta.0')
            : metadata('0.2.0-rc.5', '0.2.0-rc.5'),
      }),
    )

    expect(report.items.BETA_DIST_TAG.status).toBe('PASS')
  })

  it('fails when provenance is absent', async () => {
    const withoutProvenance = {
      status: 200,
      body: {
        'dist-tags': { beta: '0.1.0-beta.35' },
        versions: {
          '0.1.0-beta.35': {
            dist: {
              tarball: 'https://example.invalid/button.tgz',
              integrity: 'sha512-AAAA',
            },
          },
        },
      },
    }

    const report = await verifyHistoricalRelease(
      { ...baseOptions, baselineFound: 'true' },
      deps({
        fetchJson: async (url: string) =>
          url.includes('zeus-web%2Fbutton')
            ? withoutProvenance
            : metadata('0.2.0-rc.5', '0.2.0-rc.5'),
      }),
    )

    expect(report.items.PROVENANCE.status).toBe('FAIL')
  })

  it('keeps checking other items when one fails', async () => {
    // A single broken check must not hide the state of the rest.
    const report = await verifyHistoricalRelease(
      { ...baseOptions, baselineFound: 'true' },
      deps({
        downloadAndHash: async () => ({ ok: true, sha512: 'ff'.repeat(64) }),
      }),
    )

    expect(report.items.PACKAGE_INTEGRITY.status).toBe('FAIL')
    expect(report.items.VERSION_AVAILABILITY.status).toBe('PASS')
    expect(report.items.BETA_DIST_TAG.status).toBe('PASS')
  })

  it('requires an exact version and a target path', () => {
    expect(() => parseArgs(['--version', '1.0.0'])).toThrow(/Missing --tag/)
    expect(() => parseArgs([])).toThrow(/Missing --version|Usage/)
  })

  it('cleans up its fixture', () => {
    rmSync(target, { recursive: true, force: true })
    expect(true).toBe(true)
  })
})
