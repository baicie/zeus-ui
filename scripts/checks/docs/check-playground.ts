import pc from 'picocolors'

import { checkPlaygroundContract } from './playground-contract'

function main(): void {
  const result = checkPlaygroundContract()

  if (!result.valid) {
    console.error(pc.red('Playground contract check failed:'))

    for (const error of result.errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(
    pc.green(
      `Playground contract check passed (${result.componentCount} components).`,
    ),
  )
}

main()
