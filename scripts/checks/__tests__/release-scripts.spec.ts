import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('release script contract', () => {
  it('wires phase 15 release scripts in root package.json', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'),
    ) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts.release).toBe('tsx scripts/commands/release.ts')
    expect(packageJson.scripts['release:dry']).toBe(
      'tsx scripts/commands/release.ts --dry-run',
    )
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

  it('keeps ci workflow aligned with release scripts', () => {
    const ci = readFileSync(
      resolve(process.cwd(), '.github/workflows/ci.yml'),
      'utf-8',
    )
    const release = readFileSync(
      resolve(process.cwd(), '.github/workflows/release.yml'),
      'utf-8',
    )

    expect(ci).toContain('pnpm release:verify --allow-zero')
    expect(release).toContain('pnpm version:packages')
    expect(release).toContain('pnpm release:verify --strict')
    expect(release).toContain('pnpm release:plan')
    expect(release).toContain('pnpm ci-publish')
  })

  it('documents the phase 15 release workflow', () => {
    const docs = readFileSync(
      resolve(process.cwd(), 'docs/internal/release.md'),
      'utf-8',
    )

    expect(docs).toContain('pnpm version:packages')
    expect(docs).toContain('pnpm release:plan')
    expect(docs).toContain('pnpm release:verify --strict')
    expect(docs).toContain('pnpm ci-publish')
  })
})
