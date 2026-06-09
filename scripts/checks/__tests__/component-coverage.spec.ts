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

  it('keeps overlay components explicitly deferred for beta', () => {
    const result = checkComponentCoverage()

    expect(result.deferredNames).toEqual(['dropdown', 'popover', 'toast'])
    expect(result.registryNames).not.toContain('dropdown')
    expect(result.registryNames).not.toContain('popover')
    expect(result.registryNames).not.toContain('toast')
  })
})
