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
  const file = filePath(relativePath)

  if (!existsSync(file)) {
    return [`Missing docs file: apps/docs/${relativePath}`]
  }

  return []
}

function checkRequiredContent(doc: RequiredDoc): string[] {
  const errors: string[] = []
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
  const siteDataPath = filePath('.vitepress/data/site.ts')

  const errors: string[] = []

  if (!existsSync(configPath)) {
    return ['Missing apps/docs/.vitepress/config.ts']
  }

  const configSource = readFileSync(configPath, 'utf-8')

  for (const text of [
    "import { defineConfig } from 'vitepress'",
    "import { sidebar, topNav } from './data/site'",
    'nav: topNav',
  ]) {
    if (!configSource.includes(text)) {
      errors.push(`VitePress config must contain "${text}"`)
    }
  }

  if (existsSync(siteDataPath)) {
    const siteSource = readFileSync(siteDataPath, 'utf-8')

    for (const route of [
      '/guide/getting-started',
      '/components/button',
      '/examples/react-vite',
    ]) {
      if (!siteSource.includes(route)) {
        errors.push(`data/site.ts must contain route "${route}"`)
      }
    }
  }

  return errors
}

function checkDocsTheme(): string[] {
  const files = [
    '.vitepress/theme/index.ts',
    '.vitepress/theme/style.css',
    '.vitepress/data/site.ts',
  ]

  return files.flatMap(file => checkFileExists(file))
}

function main(): void {
  const errors: string[] = []

  for (const doc of requiredDocs) {
    errors.push(...checkFileExists(doc.path))

    if (existsSync(filePath(doc.path))) {
      errors.push(...checkRequiredContent(doc))
    }
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
