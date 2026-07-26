import { execa } from 'execa'

import { createSteps, parseOptions } from '../release/check-release-final'

describe('release final command', () => {
  it('requires one non-zero semver version', () => {
    expect(() => parseOptions([])).toThrow(
      'Usage: pnpm release:final <version> [--allow-zero]',
    )
    expect(() => parseOptions(['0.0.0'])).toThrow(
      'Release version must not be 0.0.0',
    )

    for (const version of [
      '1.0',
      'v1.0.0',
      '01.0.0',
      '1.0.0-',
      '1.0.0-..',
      '1.0.0-beta.01',
    ]) {
      expect(() => parseOptions([version])).toThrow(
        `Invalid semver version: ${version}`,
      )
    }
  })

  it('rejects unknown, duplicate and extra arguments', () => {
    expect(() => parseOptions(['0.1.0', '--dry-run'])).toThrow(
      'Unknown option: --dry-run',
    )
    expect(() =>
      parseOptions(['0.1.0', '--allow-zero', '--allow-zero']),
    ).toThrow('Duplicate option: --allow-zero')
    expect(() => parseOptions(['0.1.0', '0.2.0'])).toThrow(
      'Unexpected argument: 0.2.0',
    )
  })

  it('forwards version and allow-zero to their intended steps', () => {
    const steps = createSteps(parseOptions(['--allow-zero', '0.1.0-beta.0']))
    const readiness = steps.find(
      step => step.name === 'Release readiness strict',
    )
    const release = steps.find(step => step.name === 'Release dry-run')

    expect(readiness && readiness.args).toEqual([
      'release:verify:strict',
      '--allow-zero',
    ])
    expect(release && release.args).toEqual(['release:dry', '0.1.0-beta.0'])
    expect(readiness && readiness.args).not.toContain('0.1.0-beta.0')
    expect(release && release.args).not.toContain('--allow-zero')
    expect(
      steps.map(step => ({
        name: step.name,
        command: step.command,
        args: step.args,
      })),
    ).toEqual([
      {
        name: 'TypeScript workspace check',
        command: 'pnpm',
        args: ['check'],
      },
      {
        name: 'Build packages and examples',
        command: 'pnpm',
        args: ['build'],
      },
      {
        name: 'Site check',
        command: 'pnpm',
        args: ['site:check'],
      },
      {
        name: 'Showcase CI',
        command: 'pnpm',
        args: ['showcase:ci'],
      },
      {
        name: 'Release readiness strict',
        command: 'pnpm',
        args: ['release:verify:strict', '--allow-zero'],
      },
      {
        name: 'Release tarball dry-run',
        command: 'pnpm',
        args: ['release:verify:pack'],
      },
      {
        name: 'Release dry-run',
        command: 'pnpm',
        args: ['release:dry', '0.1.0-beta.0'],
      },
    ])
  })

  it('does not relax readiness without allow-zero', () => {
    const steps = createSteps(parseOptions(['0.1.0']))
    const readiness = steps.find(
      step => step.name === 'Release readiness strict',
    )

    expect(readiness && readiness.args).toEqual(['release:verify:strict'])
  })

  it('does not execute the command when imported as a module', () => {
    return execa(
      'pnpm',
      [
        'exec',
        'tsx',
        '-e',
        "import('./scripts/checks/release/check-release-final.ts')",
      ],
      { reject: false },
    ).then(result => {
      expect(result.exitCode).toBe(0)
      expect(result.stdout).not.toContain('Release final verification')
      expect(result.stderr).not.toContain('Release final verification')
    })
  }, 15_000)

  it('validates arguments when executed as the direct CLI entry', () => {
    return execa(
      'pnpm',
      ['exec', 'tsx', 'scripts/checks/release/check-release-final.ts'],
      { reject: false },
    ).then(result => {
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Release final verification failed.')
      expect(result.stderr).toContain(
        'Usage: pnpm release:final <version> [--allow-zero]',
      )
    })
  }, 15_000)
})
