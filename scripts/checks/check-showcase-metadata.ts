import pc from 'picocolors'

import { validateShowcaseMetadata } from '../../examples/showcase-shared/src'

const result = validateShowcaseMetadata()

for (const warning of result.warnings) {
  console.log(pc.yellow(`warning: ${warning}`))
}

if (!result.valid) {
  for (const error of result.errors) {
    console.error(pc.red(`error: ${error}`))
  }

  process.exit(1)
}

console.log(pc.green('Showcase metadata check passed.'))
