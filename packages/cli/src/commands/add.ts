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
    console.log(
      pc.gray('Phase 0 only prints plan. Phase 5/6 will copy registry files.'),
    )
  }
}
