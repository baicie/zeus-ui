import { checkComponentCoverage } from '../check-component-coverage'

describe('component coverage contract', () => {
  it('keeps registry, primitives, and AI metadata aligned', () => {
    const result = checkComponentCoverage()

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)

    expect(result.registryNames).toEqual(
      expect.arrayContaining([
        'button',
        'input',
        'checkbox',
        'switch',
        'tabs',
        'dialog',
        'label',
        'textarea',
        'radio-group',
        'select',
        'card',
        'badge',
        'separator',
        'skeleton',
        'alert',
        'collapsible',
        'accordion',
        'tooltip',
        'progress',
        'avatar',
      ]),
    )

    expect(result.aiNames).toEqual(expect.arrayContaining(result.registryNames))
  })

  it('keeps component names unique', () => {
    const result = checkComponentCoverage()

    expect(new Set(result.primitiveNames).size).toBe(
      result.primitiveNames.length,
    )
    expect(new Set(result.registryNames).size).toBe(result.registryNames.length)
    expect(new Set(result.aiNames).size).toBe(result.aiNames.length)
  })

  it('keeps overlay components explicitly deferred for beta', () => {
    const result = checkComponentCoverage()

    expect(result.deferredNames).toEqual(['dropdown', 'popover', 'toast'])

    for (const name of result.deferredNames) {
      expect(result.primitiveNames).not.toContain(name)
      expect(result.registryNames).not.toContain(name)
      expect(result.aiNames).not.toContain(name)
    }
  })
})
