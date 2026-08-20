import pc from 'picocolors'

import { collectZeusImportViolations } from './check-zeus-workspace'

const errors = collectZeusImportViolations()

for (const error of errors) {
  console.error(pc.red(error))
}

if (errors.length > 0) process.exit(1)

console.log(pc.green('Zeus import boundary check passed.'))
