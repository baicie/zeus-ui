import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

interface RequiredDoc {
  path: string
  mustContain: string[]
}

const root = process.cwd()
const docsRoot = resolve(root, 'apps/docs')

const requiredDocs: RequiredDoc[] = [
  {
    path: 'index.md',
    mustContain: ['Zeus Web', 'pnpm dlx @zeus-web/cli init'],
  },
  {
    path: 'guide/getting-started.md',
    mustContain: [
      '# Getting Started',
      'pnpm dlx @zeus-web/cli init',
      'pnpm dlx @zeus-web/cli add button input',
    ],
  },
  {
    path: 'guide/cli.md',
    mustContain: ['# CLI', 'zweb init', 'zweb add', 'zweb ai'],
  },
  {
    path: 'guide/theming.md',
    mustContain: ['# Theming', 'default', 'slate', 'zinc', 'neutral', 'stone'],
  },
  {
    path: 'guide/registry.md',
    mustContain: ['# Registry', '@zeus-web/registry', 'registry.json'],
  },
  {
    path: 'guide/ai.md',
    mustContain: ['# AI', '@zeus-web/ai', 'zweb ai --cursor'],
  },
  {
    path: 'components/button.md',
    mustContain: ['# Button', 'zweb add button', '@/components/ui/button'],
  },
  {
    path: 'components/input.md',
    mustContain: ['# Input', 'zweb add input', '@/components/ui/input'],
  },
  {
    path: 'components/checkbox.md',
    mustContain: [
      '# Checkbox',
      'zweb add checkbox',
      '@/components/ui/checkbox',
    ],
  },
  {
    path: 'components/switch.md',
    mustContain: ['# Switch', 'zweb add switch', '@/components/ui/switch'],
  },
  {
    path: 'components/tabs.md',
    mustContain: ['# Tabs', 'zweb add tabs', '@/components/ui/tabs'],
  },
  {
    path: 'components/dialog.md',
    mustContain: ['# Dialog', 'zweb add dialog', '@/components/ui/dialog'],
  },
  {
    path: 'examples/react-vite.md',
    mustContain: ['# React Vite Example', '@zeus-web/example-react-vite'],
  },
  {
    path: 'examples/native-wc.md',
    mustContain: [
      '# Native Web Components Example',
      '@zeus-web/example-native-wc',
    ],
  },
]

const forbiddenPatterns = [
  {
    pattern: '@zeus-ui',
    message: 'old @zeus-ui package scope must not appear in docs',
  },
  {
    pattern: 'zeus-ui',
    message: 'old zeus-ui name must not appear in docs content',
  },
]

function filePath(relativePath: string): string {
  return resolve(docsRoot, relativePath)
}

function readDoc(relativePath: string): string {
  return readFileSync(filePath(relativePath), 'utf-8')
}

function checkFileExists(relativePath: string): string[] {
  if (!existsSync(filePath(relativePath))) {
    return [`Missing docs file: apps/docs/${relativePath}`]
  }

  return []
}

function checkRequiredContent(doc: RequiredDoc): string[] {
  const errors: string[] = []

  if (!existsSync(filePath(doc.path))) {
    return [`Missing docs file: apps/docs/${doc.path}`]
  }

  const source = readDoc(doc.path)

  for (const text of doc.mustContain) {
    if (!source.includes(text)) {
      errors.push(`apps/docs/${doc.path} must contain "${text}"`)
    }
  }

  for (const item of forbiddenPatterns) {
    if (source.includes(item.pattern)) {
      errors.push(`apps/docs/${doc.path}: ${item.message}`)
    }
  }

  return errors
}

function checkVitePressConfig(): string[] {
  const configPath = filePath('.vitepress/config.ts')

  if (!existsSync(configPath)) {
    return ['Missing apps/docs/.vitepress/config.ts']
  }

  const source = readFileSync(configPath, 'utf-8')
  const errors: string[] = []

  for (const text of [
    "import { sidebar, topNav } from './data/site'",
    'nav: topNav',
    'sidebar,',
    "import { defineConfig } from 'vitepress'",
  ]) {
    if (!source.includes(text)) {
      errors.push(`apps/docs/.vitepress/config.ts must contain "${text}"`)
    }
  }

  return errors
}

function checkDocsTheme(): string[] {
  return [
    '.vitepress/theme/index.ts',
    '.vitepress/theme/style.css',
    '.vitepress/data/site.ts',
  ].flatMap(checkFileExists)
}

function main(): void {
  const errors: string[] = []

  for (const doc of requiredDocs) {
    errors.push(...checkRequiredContent(doc))
  }

  errors.push(...checkVitePressConfig())
  errors.push(...checkDocsTheme())

  if (errors.length > 0) {
    console.error(pc.red('Docs contract check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Docs contract check passed.'))
}

main()
