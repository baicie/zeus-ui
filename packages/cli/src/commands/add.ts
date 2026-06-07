import pc from 'picocolors'

export interface RegistryFilePlan {
  source: string
  target: string
  type: 'registry:ui' | 'registry:lib' | 'registry:style'
}

export interface AddPlan {
  component: string
  dependencies: string[]
  files: RegistryFilePlan[]
}

const registryItems: Record<string, AddPlan> = {
  input: {
    component: 'input',
    dependencies: [
      '@zeus-web/input',
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
        source: 'default/input.tsx',
        target: 'components/ui/input.tsx',
        type: 'registry:ui',
      },
    ],
  },
  button: {
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
  },
  checkbox: {
    component: 'checkbox',
    dependencies: [
      '@zeus-web/checkbox',
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
        source: 'default/checkbox.tsx',
        target: 'components/ui/checkbox.tsx',
        type: 'registry:ui',
      },
    ],
  },
  switch: {
    component: 'switch',
    dependencies: [
      '@zeus-web/switch',
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
        source: 'default/switch.tsx',
        target: 'components/ui/switch.tsx',
        type: 'registry:ui',
      },
    ],
  },
  tabs: {
    component: 'tabs',
    dependencies: [
      '@zeus-web/tabs',
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
        source: 'default/tabs.tsx',
        target: 'components/ui/tabs.tsx',
        type: 'registry:ui',
      },
    ],
  },
  dialog: {
    component: 'dialog',
    dependencies: [
      '@zeus-web/dialog',
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
        source: 'default/dialog.tsx',
        target: 'components/ui/dialog.tsx',
        type: 'registry:ui',
      },
    ],
  },
}

export function listAvailableComponents(): string[] {
  return Object.keys(registryItems)
}

export function createAddPlan(components: string[]): AddPlan[] {
  return components.map(component => {
    const item = registryItems[component]

    if (!item) {
      throw new Error(`Unknown component: ${component}`)
    }

    return item
  })
}

export async function add(args: string[]) {
  const components = args.filter(Boolean)

  if (components.length === 0) {
    console.error(pc.red('Please provide at least one component.'))
    console.log(`Example: zweb add ${listAvailableComponents().join(' ')}`)
    process.exit(1)
  }

  try {
    const plans = createAddPlan(components)

    for (const plan of plans) {
      console.log(pc.green(`Add ${plan.component}`))
      console.log(`Dependencies: ${plan.dependencies.join(', ')}`)
      console.log('Files:')

      for (const file of plan.files) {
        console.log(`  ${file.source} -> ${file.target}`)
      }
    }

    console.log(
      pc.gray(
        'Phase 5 only prints add plan. Phase 6 will copy files and install dependencies.',
      ),
    )
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
