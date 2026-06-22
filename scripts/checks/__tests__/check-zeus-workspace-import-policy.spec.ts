import { describe, expect, it } from 'vitest'

import {
  collectImportSpecifiers,
  getZeusImportViolationMessage,
  isAllowedZeusImport,
} from '../check-zeus-workspace'

describe('check-zeus-workspace import policy', () => {
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

  it('allows component tests to import component analyzer', () => {
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
})
