import type { Registry } from '@zeus-web/registry'

import { createAddPlan, listAvailableComponents } from '../src/commands/add'

const registry: Registry = {
  $schema: 'https://zeus-web.dev/schema/registry.json',
  name: '@zeus-web/registry',
  homepage: 'https://zeus-web.dev',
  items: [
    {
      name: 'input',
      type: 'registry:ui',
      description: 'Text input styled component.',
      dependencies: [
        '@zeus-web/input',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
      files: [
        {
          path: 'default/lib/utils.ts',
          target: 'lib/utils.ts',
          type: 'registry:lib',
        },
        {
          path: 'default/input.tsx',
          target: 'components/ui/input.tsx',
          type: 'registry:ui',
        },
      ],
    },
    {
      name: 'button',
      type: 'registry:ui',
      description: 'Button styled component.',
      dependencies: [
        '@zeus-web/button',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
      files: [
        {
          path: 'default/lib/utils.ts',
          target: 'lib/utils.ts',
          type: 'registry:lib',
        },
        {
          path: 'default/button.tsx',
          target: 'components/ui/button.tsx',
          type: 'registry:ui',
        },
      ],
    },
    {
      name: 'dialog',
      type: 'registry:ui',
      description: 'Dialog styled component.',
      dependencies: [
        '@zeus-web/dialog',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
      files: [
        {
          path: 'default/lib/utils.ts',
          target: 'lib/utils.ts',
          type: 'registry:lib',
        },
        {
          path: 'default/dialog.tsx',
          target: 'components/ui/dialog.tsx',
          type: 'registry:ui',
        },
      ],
    },
  ],
}

describe('@zeus-web/cli add plan', () => {
  it('lists registry ui components', () => {
    expect(listAvailableComponents(registry)).toEqual([
      'input',
      'button',
      'dialog',
    ])
  })

  it('creates add plan for one component from registry', () => {
    const [plan] = createAddPlan(['button'], registry)

    expect(plan).toEqual({
      component: 'button',
      dependencies: [
        '@zeus-web/button',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
      devDependencies: [],
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

  it('creates add plan for multiple components from registry', () => {
    const plans = createAddPlan(['input', 'dialog'], registry)

    expect(plans.map(plan => plan.component)).toEqual(['input', 'dialog'])
    expect(plans[0].dependencies).toContain('@zeus-web/input')
    expect(plans[1].dependencies).toContain('@zeus-web/dialog')
  })

  it('throws on unknown component', () => {
    expect(() => createAddPlan(['unknown'], registry)).toThrow(
      'Unknown component: unknown',
    )
  })

  it('throws when registry is invalid', () => {
    const invalidRegistry: Registry = {
      name: 'bad-registry',
      items: [],
    }

    expect(() => listAvailableComponents(invalidRegistry)).toThrow(
      'Invalid @zeus-web/registry/registry.json',
    )
  })
})
