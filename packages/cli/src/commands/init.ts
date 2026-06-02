import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import pc from 'picocolors'

export async function init(_args: string[]) {
  const file = 'components.json'

  if (existsSync(file)) {
    console.log(pc.yellow('components.json already exists.'))
    return
  }

  await writeFile(
    file,
    `${JSON.stringify(
      {
        $schema: 'https://zeus-web.dev/schema/components.json',
        framework: 'react',
        style: 'default',
        tailwind: {
          css: 'src/styles/globals.css',
          cssVariables: true,
        },
        aliases: {
          components: '@/components',
          ui: '@/components/ui',
          lib: '@/lib',
        },
      },
      null,
      2,
    )}\n`,
  )

  console.log(pc.green('Created components.json'))
}
