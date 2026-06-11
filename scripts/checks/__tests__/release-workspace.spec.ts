import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  getUniqueVersions,
  listPublishablePackages,
  listWorkspacePackages,
} from '../../release/workspace'

describe('release workspace discovery', () => {
  it('discovers workspace packages', () => {
    const packages = listWorkspacePackages()

    expect(packages.length).toBeGreaterThan(0)
    expect(packages.some(pkg => pkg.name === '@zeus-web/cli')).toBe(true)
    expect(packages.some(pkg => pkg.name === '@zeus-web/icons')).toBe(true)
    expect(packages.some(pkg => pkg.name === '@zeus-web/button')).toBe(true)
  })

  it('discovers publishable packages', () => {
    const packages = listPublishablePackages()

    expect(packages.length).toBeGreaterThan(0)
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
})
