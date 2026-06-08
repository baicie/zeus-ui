import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

import { generateComponentDocs } from '../docs/component-docs'
import { formatGeneratedDocs } from '../docs/format-generated-docs'

async function main(): Promise<void> {
  const errors: string[] = []
  const docs = await formatGeneratedDocs(generateComponentDocs())

  for (const doc of docs) {
    const file = resolve(process.cwd(), doc.path)

    if (!existsSync(file)) {
      errors.push(`Missing generated doc: ${doc.path}`)
      continue
    }

    const current = readFileSync(file, 'utf-8')

    if (current !== doc.content) {
      errors.push(`Generated doc is out of date: ${doc.path}`)
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('Generated docs check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    console.error('')
    console.error('Run:')
    console.error('  pnpm docs:generate')
    process.exit(1)
  }

  console.log(pc.green('Generated docs check passed.'))
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
