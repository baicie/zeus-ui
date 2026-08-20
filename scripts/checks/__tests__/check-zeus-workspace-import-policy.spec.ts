import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  collectImportSpecifiers,
  collectZeusImportViolations,
  getExpectedZeusPeerRequirement,
  getZeusImportViolationMessage,
  isAllowedZeusImport,
  ZEUS_IMPORT_CHECKED_ROOTS,
} from '../check-zeus-workspace'

describe('check-zeus-workspace import policy', () => {
  const temporaryRoots: string[] = []

  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('pins prerelease Zeus peers to the exact baseline', () => {
    expect(getExpectedZeusPeerRequirement('0.1.1-beta.1')).toBe('0.1.1-beta.1')
    expect(getExpectedZeusPeerRequirement('0.1.1')).toBe('>=0.1.1 <0.2.0')
    expect(getExpectedZeusPeerRequirement('workspace:*')).toBeUndefined()
  })

  it('allows zeus-compat to import upstream Zeus runtime APIs', () => {
    expect(
      isAllowedZeusImport('packages/zeus-compat/src/index.ts', '@zeus-js/zeus'),
    ).toBe(true)

    expect(
      isAllowedZeusImport(
        'packages/zeus-compat/src/capabilities.ts',
        '@zeus-js/zeus/capabilities',
      ),
    ).toBe(true)

    expect(
      isAllowedZeusImport(
        'packages/zeus-compat/src/index.ts',
        '@zeus-js/runtime-dom',
      ),
    ).toBe(true)
  })

  it('allows zeus-compat tests to import upstream Zeus contract modules', () => {
    expect(
      isAllowedZeusImport(
        'packages/zeus-compat/__tests__/contract.spec.ts',
        '@zeus-js/zeus/capabilities',
      ),
    ).toBe(true)

    expect(
      isAllowedZeusImport(
        'packages/zeus-compat/__tests__/canary-capabilities.spec.ts',
        '@zeus-js/zeus',
      ),
    ).toBe(true)
  })

  it('allows component source to import @zeus-js/zeus only', () => {
    expect(
      isAllowedZeusImport(
        'packages/primitives/button/src/index.ts',
        '@zeus-js/zeus',
      ),
    ).toBe(true)

    expect(
      isAllowedZeusImport(
        'packages/advanced/data-grid/src/data-grid.tsx',
        '@zeus-js/zeus',
      ),
    ).toBe(true)

    expect(
      isAllowedZeusImport(
        'packages/primitives/button/src/index.ts',
        '@zeus-js/runtime-dom',
      ),
    ).toBe(false)

    expect(
      isAllowedZeusImport(
        'packages/advanced/data-grid/src/data-grid.tsx',
        '@zeus-js/component-analyzer',
      ),
    ).toBe(false)
  })

  it('allows component tests to import build-time contract tools', () => {
    expect(
      isAllowedZeusImport(
        'packages/primitives/button/__tests__/button.spec.ts',
        '@zeus-js/component-analyzer',
      ),
    ).toBe(true)

    expect(
      isAllowedZeusImport(
        'packages/primitives/radio-group/__tests__/radio-group.spec.ts',
        '@zeus-js/component-analyzer',
      ),
    ).toBe(true)

    expect(
      isAllowedZeusImport(
        'packages/advanced/data-grid/__tests__/data-grid.spec.ts',
        '@zeus-js/component-analyzer',
      ),
    ).toBe(true)

    expect(
      isAllowedZeusImport(
        'packages/advanced/data-grid/__tests__/data-grid.spec.ts',
        '@zeus-js/compiler',
      ),
    ).toBe(true)
  })

  it('limits compiler imports to the Data Grid compiler contract', () => {
    expect(
      isAllowedZeusImport(
        'packages/primitives/button/__tests__/button.spec.ts',
        '@zeus-js/compiler',
      ),
    ).toBe(false)

    expect(
      isAllowedZeusImport(
        'packages/advanced/chat/__tests__/chat-components.spec.ts',
        '@zeus-js/compiler',
      ),
    ).toBe(false)
  })

  it('does not allow component tests to import arbitrary Zeus packages', () => {
    expect(
      isAllowedZeusImport(
        'packages/primitives/button/__tests__/button.spec.ts',
        '@zeus-js/runtime-dom',
      ),
    ).toBe(false)

    expect(
      isAllowedZeusImport(
        'packages/advanced/data-grid/__tests__/data-grid.spec.ts',
        '@zeus-js/web-c-runtime',
      ),
    ).toBe(false)
  })

  it('does not allow non-compat packages to import upstream Zeus directly', () => {
    expect(
      isAllowedZeusImport('packages/utils/src/index.ts', '@zeus-js/zeus'),
    ).toBe(false)

    expect(
      isAllowedZeusImport(
        'packages/registry/src/index.ts',
        '@zeus-js/zeus/capabilities',
      ),
    ).toBe(false)
  })

  it('collects static imports, exports and dynamic imports', () => {
    const specifiers = collectImportSpecifiers(
      'packages/primitives/button/__tests__/button.spec.ts',
      `
import { analyze } from '@zeus-js/component-analyzer'
export { defineElement } from '@zeus-js/zeus'
const runtime = await import('@zeus-js/runtime-dom')
`,
    )

    expect(specifiers).toEqual([
      '@zeus-js/component-analyzer',
      '@zeus-js/zeus',
      '@zeus-js/runtime-dom',
    ])
  })

  it('prints a stable violation message', () => {
    expect(
      getZeusImportViolationMessage(
        'packages/utils/src/index.ts',
        '@zeus-js/zeus',
      ),
    ).toBe(
      'packages/utils/src/index.ts: do not import @zeus-js/zeus directly. Use @zeus-web/zeus-compat instead.',
    )
  })

  it('scans advanced packages with the shared import policy', () => {
    const root = mkdtempSync(join(tmpdir(), 'zeus-import-policy-'))
    temporaryRoots.push(root)

    const dataGridTest = join(
      root,
      'packages/advanced/data-grid/__tests__/data-grid.spec.ts',
    )
    const chatTest = join(
      root,
      'packages/advanced/chat/__tests__/chat-components.spec.ts',
    )
    mkdirSync(join(dataGridTest, '..'), { recursive: true })
    mkdirSync(join(chatTest, '..'), { recursive: true })
    writeFileSync(dataGridTest, "import '@zeus-js/compiler'\n")
    writeFileSync(chatTest, "import '@zeus-js/compiler'\n")

    expect(ZEUS_IMPORT_CHECKED_ROOTS).toContain('packages/advanced')
    expect(collectZeusImportViolations(root)).toEqual([
      'packages/advanced/chat/__tests__/chat-components.spec.ts: do not import @zeus-js/compiler directly. Use @zeus-web/zeus-compat instead.',
    ])
  })
})
