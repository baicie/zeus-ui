import pc from 'picocolors'

const primitiveDeps: Record<string, string[]> = {
  input: [
    '@zeus-web/input',
    'clsx',
    'tailwind-merge',
    'class-variance-authority',
  ],
}

export async function add(args: string[]) {
  const components = args.filter(Boolean)

  if (components.length === 0) {
    console.error(pc.red('Please provide at least one component.'))
    console.log('Example: zweb add input')
    process.exit(1)
  }

  for (const component of components) {
    const deps = primitiveDeps[component]

    if (!deps) {
      console.error(pc.red(`Unknown component: ${component}`))
      process.exitCode = 1
      continue
    }

    console.log(pc.green(`Add ${component}`))
    console.log(`Dependencies: ${deps.join(', ')}`)
    // Phase 5/6 implementation plan:
    // 1. Read registry from @zeus-ui/registry/registry.json
    // 2. Resolve component dependencies and install packages via pnpm
    // 3. Copy styled source files from registry to user project
    // 4. Merge theme CSS variables into user's global stylesheet
    // 5. Generate or update components.json
  }
}
