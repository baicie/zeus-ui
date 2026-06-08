import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import pc from 'picocolors'

import { generateComponentDocs } from '../docs/component-docs'
import { formatGeneratedDocs } from '../docs/format-generated-docs'

async function main(): Promise<void> {
  const docs = await formatGeneratedDocs(generateComponentDocs())

  for (const doc of docs) {
    const file = resolve(process.cwd(), doc.path)

    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, doc.content, 'utf-8')

    console.log(pc.green(`Generated ${doc.path}`))
  }
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
