import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('release script contract', () => {
  it('wires release scripts in root package.json', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'),
    ) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts.release).toBe('tsx scripts/commands/release.ts')
    expect(packageJson.scripts['release:plan']).toBe(
      'tsx scripts/commands/release-plan.ts',
    )
    expect(packageJson.scripts['release:verify']).toBe(
      'tsx scripts/checks/check-release-readiness.ts',
    )
    expect(packageJson.scripts['version:packages']).toBe(
      'tsx scripts/commands/version-packages.ts',
    )
    expect(packageJson.scripts['ci-publish']).toBe(
      'tsx scripts/commands/publish.ts',
    )
  })

  it('wires release config file', () => {
    const config = readFileSync(
      resolve(process.cwd(), 'scripts/release.config.ts'),
      'utf-8',
    )

    expect(config).toContain('defineReleaseConfig')
    expect(config).toContain('@baicie/release')
    expect(config).toContain('workspace-fixed')
    expect(config).toContain('publishable')
    expect(config).toContain('precheck')
  })

  it('keeps release workflow aligned with release scripts', () => {
    const release = readFileSync(
      resolve(process.cwd(), '.github/workflows/release.yml'),
      'utf-8',
    )

    expect(release).toContain('pnpm release')
    expect(release).toContain('--dry')
    expect(release).toContain('workflow_dispatch')
    expect(release).toContain('default@')
  })

  it('keeps publish workflow aligned with tag convention', () => {
    const publish = readFileSync(
      resolve(process.cwd(), '.github/workflows/publish.yml'),
      'utf-8',
    )

    expect(publish).toContain("'default@*'")
    expect(publish).toContain('--tag latest')
    expect(publish).toContain('ci-publish')
  })
})
