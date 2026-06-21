import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../..')

const advancedPackages = [
  'virtual',
  'chat',
  'data-grid',
  'revogrid-adapter',
  'agent-console',
]

function read(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`[advanced-final-contract] ${message}`)
  }
}

function assertNotContains(source: string, value: string, label: string): void {
  assert(!source.includes(value), `${label} must not contain ${value}`)
}

export function checkAdvancedFinalContract(): void {
  const registry = read('packages/registry/registry.json')
  const aiTypes = read('packages/ai/src/types.ts')
  const aiMetadata = read('packages/ai/src/metadata.ts')

  for (const packageName of advancedPackages) {
    const packageJsonPath = `packages/advanced/${packageName}/package.json`
    const srcIndexPath = `packages/advanced/${packageName}/src/index.ts`
    const srcTypesPath = `packages/advanced/${packageName}/src/types.ts`

    assert(
      existsSync(resolve(workspaceRoot, packageJsonPath)),
      `${packageName} must have package.json`,
    )
    assert(
      existsSync(resolve(workspaceRoot, srcIndexPath)),
      `${packageName} must have src/index.ts`,
    )
    assert(
      existsSync(resolve(workspaceRoot, srcTypesPath)),
      `${packageName} must have src/types.ts`,
    )

    const packageJson = read(packageJsonPath)

    assert(packageJson.includes('"./wc"'), `${packageName} must export ./wc`)
    assert(
      packageJson.includes('"./wc/auto"'),
      `${packageName} must export ./wc/auto`,
    )
    assert(
      packageJson.includes('"./react"'),
      `${packageName} must export ./react`,
    )
    assert(packageJson.includes('"./vue"'), `${packageName} must export ./vue`)
  }

  for (const registryItem of [
    'chat',
    'data-grid',
    'revogrid-adapter',
    'agent-console',
  ]) {
    assert(
      registry.includes(`"name": "${registryItem}"`),
      `registry must include ${registryItem}`,
    )
  }

  for (const aiItem of [
    'chat',
    'virtual',
    'data-grid',
    'revogrid-adapter',
    'agent-console',
  ]) {
    assert(
      aiTypes.includes(`'${aiItem}'`) ||
        aiMetadata.includes(`name: '${aiItem}'`),
      `AI metadata/types must include ${aiItem}`,
    )
  }

  for (const source of [registry, aiTypes, aiMetadata]) {
    assertNotContains(source, 'OPENAI_API_KEY', 'advanced final source')
    assertNotContains(source, 'ANTHROPIC_API_KEY', 'advanced final source')
    assertNotContains(source, 'DEEPSEEK_API_KEY', 'advanced final source')
    assertNotContains(source, 'Authorization: Bearer', 'advanced final source')
  }
}

checkAdvancedFinalContract()
