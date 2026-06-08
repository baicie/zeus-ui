import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

interface RequiredFile {
  path: string
  mustContain: string[]
  mustNotContain?: string[]
}

const root = process.cwd()

const requiredFiles: RequiredFile[] = [
  {
    path: 'apps/docs/playground/index.md',
    mustContain: [
      '# Interactive Playground',
      '<ZeusPlayground />',
      '@zeus-web/<component>/wc imports',
    ],
  },
  {
    path: 'apps/docs/.vitepress/theme/index.ts',
    mustContain: [
      "import ZeusPlayground from './components/ZeusPlayground.vue'",
      "app.component('ZeusPlayground', ZeusPlayground)",
    ],
  },
  {
    path: 'apps/docs/.vitepress/theme/components/ZeusPlayground.vue',
    mustContain: [
      "import '@zeus-web/button/wc'",
      "import '@zeus-web/checkbox/wc'",
      "import '@zeus-web/dialog/wc'",
      "import '@zeus-web/input/wc'",
      "import '@zeus-web/switch/wc'",
      "import '@zeus-web/tabs/wc'",
      '<zw-button',
      '<zw-input',
      '<zw-checkbox',
      '<zw-switch',
      '<zw-tabs',
      '<zw-dialog',
      '@press="handlePress"',
      '@value-change="handleValueChange"',
      '@checked-change="handleCheckedChange"',
      '@open-change="handleOpenChange"',
    ],
    mustNotContain: [
      '@zeus-web/react',
      '@zeus-web/button/react',
      '@zeus-web/input/react',
      'customElements.define',
    ],
  },
  {
    path: 'apps/docs/.vitepress/data/site.ts',
    mustContain: [
      "text: 'Playground'",
      "link: '/playground/'",
      'playgroundItems',
    ],
  },
  {
    path: 'apps/docs/.vitepress/theme/style.css',
    mustContain: [
      '.zeus-playground',
      '.zeus-playground--dark',
      '.zeus-playground__grid',
      '.zeus-playground__logs',
    ],
  },
]

function checkFile(file: RequiredFile): string[] {
  const absolutePath = resolve(root, file.path)

  if (!existsSync(absolutePath)) {
    return [`Missing playground file: ${file.path}`]
  }

  const source = readFileSync(absolutePath, 'utf-8')
  const errors: string[] = []

  for (const text of file.mustContain) {
    if (!source.includes(text)) {
      errors.push(`${file.path} must contain "${text}"`)
    }
  }

  for (const text of file.mustNotContain ?? []) {
    if (source.includes(text)) {
      errors.push(`${file.path} must not contain "${text}"`)
    }
  }

  return errors
}

function main(): void {
  const errors = requiredFiles.flatMap(checkFile)

  if (errors.length > 0) {
    console.error(pc.red('Playground contract check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Playground contract check passed.'))
}

main()
