import { createAddPlan, listAvailableComponents } from '../src/commands/add'

describe('@zeus-web/cli add plan', () => {
  it('lists MVP components', () => {
    expect(listAvailableComponents()).toEqual([
      'input',
      'button',
      'checkbox',
      'switch',
      'tabs',
      'dialog',
    ])
  })

  it('creates add plan for one component', () => {
    const [plan] = createAddPlan(['button'])

    expect(plan).toMatchObject({
      component: 'button',
      dependencies: [
        '@zeus-web/button',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
      files: [
        {
          source: 'default/lib/utils.ts',
          target: 'lib/utils.ts',
          type: 'registry:lib',
        },
        {
          source: 'default/button.tsx',
          target: 'components/ui/button.tsx',
          type: 'registry:ui',
        },
      ],
    })
  })

  it('creates add plan for multiple components', () => {
    const plans = createAddPlan(['input', 'dialog'])

    expect(plans.map(plan => plan.component)).toEqual(['input', 'dialog'])
    expect(plans[0].dependencies).toContain('@zeus-web/input')
    expect(plans[1].dependencies).toContain('@zeus-web/dialog')
  })

  it('throws on unknown component', () => {
    expect(() => createAddPlan(['unknown'])).toThrow(
      'Unknown component: unknown',
    )
  })
})
