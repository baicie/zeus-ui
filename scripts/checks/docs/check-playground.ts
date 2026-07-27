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
    path: 'apps/docs/playground/data-grid/index.md',
    mustContain: [
      '# High-performance Data Grid',
      '<DataGridPlayground />',
      '100,000 rows',
      '1,000 columns',
    ],
  },
  {
    path: 'apps/docs/.vitepress/config.ts',
    mustContain: ['isCustomElement', "tag.startsWith('zw-')"],
  },
  {
    path: 'apps/docs/.vitepress/theme/index.ts',
    mustContain: [
      "import DataGridPlayground from './components/DataGridPlayground.vue'",
      "import ZeusPlayground from './components/ZeusPlayground.vue'",
      "app.component('DataGridPlayground', DataGridPlayground)",
      "app.component('ZeusPlayground', ZeusPlayground)",
    ],
  },
  {
    path: 'apps/docs/.vitepress/theme/components/ZeusPlayground.vue',
    mustContain: [
      'onMounted',
      "import('@zeus-web/button/wc/auto')",
      "import('@zeus-web/checkbox/wc/auto')",
      "import('@zeus-web/dialog/wc/auto')",
      "import('@zeus-web/input/wc/auto')",
      "import('@zeus-web/switch/wc/auto')",
      "import('@zeus-web/tabs/wc/auto')",
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
      "import '@zeus-web/button/wc'",
      "import '@zeus-web/checkbox/wc'",
      "import '@zeus-web/dialog/wc'",
      "import '@zeus-web/input/wc'",
      "import '@zeus-web/switch/wc'",
      "import '@zeus-web/tabs/wc'",
      "import('@zeus-web/button/wc')",
      "import('@zeus-web/checkbox/wc')",
      "import('@zeus-web/dialog/wc')",
      "import('@zeus-web/input/wc')",
      "import('@zeus-web/switch/wc')",
      "import('@zeus-web/tabs/wc')",
      '@zeus-web/react',
      '@zeus-web/button/react',
      '@zeus-web/input/react',
      'customElements.define',
    ],
  },
  {
    path: 'apps/docs/.vitepress/theme/components/DataGridPlayground.vue',
    mustContain: [
      "import('@zeus-web/data-grid/wc/auto')",
      '<zw-data-grid',
      'scrollToIndex',
      'scrollToColumn',
      'data-grid-playground__metrics',
      'data-row-count',
      'data-column-count',
    ],
    mustNotContain: [
      "import '@zeus-web/data-grid/wc'",
      "import('@zeus-web/data-grid/wc')",
      'customElements.define',
      'virtual = false',
    ],
  },
  {
    path: 'apps/docs/.vitepress/data/site.ts',
    mustContain: [
      "text: 'Playground'",
      "link: '/playground/'",
      "text: 'Data Grid'",
      "link: '/playground/data-grid/'",
      'playgroundItems',
    ],
  },
  {
    path: 'apps/docs/package.json',
    mustContain: ['"@zeus-web/data-grid": "workspace:*"'],
  },
  {
    path: 'apps/docs/.vitepress/theme/style.css',
    mustContain: [
      '.zeus-playground',
      '.zeus-playground--dark',
      '.zeus-playground__grid',
      '.zeus-playground__logs',
      '.zeus-playground__loading',
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
