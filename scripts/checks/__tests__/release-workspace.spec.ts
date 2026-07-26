import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { runReleasePlanCli } from '@baicie/release'

import releaseConfig from '../../release.config'
import {
  countWorkspacePackages,
  expectedWorkspacePackageCounts,
  getUniqueVersions,
  listPublishablePackages,
  listWorkspacePackages,
} from '../../release/workspace'

describe('release workspace discovery', () => {
  it('discovers workspace packages', () => {
    const packages = listWorkspacePackages()
    const counts = countWorkspacePackages(packages)

    expect(counts).toEqual(expectedWorkspacePackageCounts)
    expect(new Set(packages.map(pkg => pkg.name)).size).toBe(
      expectedWorkspacePackageCounts.total,
    )
    expect(packages.some(pkg => pkg.name === '@zeus-web/cli')).toBe(true)
    expect(packages.some(pkg => pkg.name === '@zeus-web/icons')).toBe(true)
    expect(packages.some(pkg => pkg.name === '@zeus-web/button')).toBe(true)
  })

  it('discovers publishable packages', () => {
    const packages = listPublishablePackages()

    expect(packages).toHaveLength(expectedWorkspacePackageCounts.total)
    expect(packages.every(pkg => !pkg.isPrivate)).toBe(true)
    expect(packages.every(pkg => pkg.name.startsWith('@zeus-web/'))).toBe(true)
  })

  it('keeps package json paths valid', () => {
    for (const pkg of listWorkspacePackages()) {
      expect(existsSync(pkg.packageJsonPath)).toBe(true)
      expect(pkg.packageJsonPath).toBe(resolve(pkg.dir, 'package.json'))
    }
  })

  it('can read unique versions', () => {
    const versions = getUniqueVersions(listPublishablePackages())

    expect(versions.length).toBeGreaterThan(0)
  })

  it('matches the release library publishable package plan', () => {
    const originalArgv = process.argv
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    process.argv = ['node', 'release-plan', '--json']

    return runReleasePlanCli(releaseConfig)
      .then(() => {
        const jsonCall = log.mock.calls.find(
          args =>
            typeof args[0] === 'string' && args[0].startsWith('{\n  "version"'),
        )

        expect(jsonCall).toBeDefined()

        const plan = JSON.parse(String(jsonCall && jsonCall[0])) as {
          packages: Array<{ name: string }>
        }
        const expectedNames = listPublishablePackages().map(pkg => pkg.name)
        const actualNames = plan.packages.map(pkg => pkg.name).sort()

        expect(actualNames).toEqual(expectedNames.slice().sort())
        expect(actualNames).toHaveLength(expectedWorkspacePackageCounts.total)
      })
      .finally(() => {
        process.argv = originalArgv
        log.mockRestore()
      })
  })
})
