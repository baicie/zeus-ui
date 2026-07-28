import pc from 'picocolors'

import { checkDocsI18nContract } from './i18n-contract'

function main(): void {
  const result = checkDocsI18nContract()

  if (!result.valid) {
    console.error(pc.red('Docs i18n contract check failed:'))

    for (const error of result.errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(
    pc.green(
      `Docs i18n contract check passed (${result.generatedDocCount} generated docs).`,
    ),
  )
}

main()
