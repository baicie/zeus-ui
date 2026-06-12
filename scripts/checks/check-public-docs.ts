import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'README.md',
  'apps/docs/index.md',
  'apps/docs/guide/getting-started.md',
  'apps/docs/guide/usage-modes.md',
  'apps/docs/guide/cli.md',
  'apps/docs/guide/registry.md',
  'apps/docs/guide/theming.md',
  'apps/docs/examples/native-wc.md',
  'apps/docs/.vitepress/data/site.ts',
]

const requiredContent: Record<string, string[]> = {
  'README.md': [
    'CLI registry source',
    'Native styled Web Components',
    'Advanced primitives',
    'zeus-ui.json',
    '@zeus-web/ui',
    '@zeus-web/button/react',
    'pnpm showcase:native',
  ],
  'apps/docs/index.md': [
    'CLI registry source',
    'Native styled Web Components',
    '@zeus-web/ui',
    'zeus-ui.json',
  ],
  'apps/docs/guide/getting-started.md': [
    'zeus-ui.json',
    'src/lib/cn.ts',
    'src/styles/zeus.css',
    "import '@zeus-web/ui'",
    '@zeus-web/button/react',
  ],
  'apps/docs/guide/usage-modes.md': [
    'CLI registry source',
    'Native styled Web Components',
    'Advanced primitives',
    '@zeus-web/ui',
    '@/components/ui/button.vue',
  ],
  'apps/docs/guide/cli.md': [
    'zeus-ui.json',
    'zeus-ui.lock.json',
    'src/lib/cn.ts',
    'src/styles/zeus.css',
    '--framework <name>',
    '--install',
  ],
  'apps/docs/guide/registry.md': [
    'registryDependencies',
    'templates/react/button.tsx',
    'templates/vue/button.vue',
    'zeus-ui.json',
    'cn',
    'globals',
  ],
  'apps/docs/guide/theming.md': [
    '--zeus-*',
    '--zw-*',
    'src/styles/zeus.css',
    "import '@zeus-web/ui'",
  ],
  'apps/docs/examples/native-wc.md': [
    '@zeus-web/ui',
    'pnpm showcase:native',
    "import '@zeus-web/ui'",
    '<zw-button variant="primary">Save</zw-button>',
  ],
  'apps/docs/.vitepress/data/site.ts': [
    "text: 'Usage Modes'",
    "link: '/guide/usage-modes'",
  ],
}

const forbiddenContent: Record<string, string[]> = {
  'README.md': [
    '@zeus-web/react',
    '@zeus-web/vue',
    '@zeus-web/headless',
    'components.json',
    'src/styles/globals.css',
    'src/lib/utils.ts',
  ],
  'apps/docs/index.md': ['components.json'],
  'apps/docs/guide/getting-started.md': [
    'components.json',
    'src/styles/globals.css',
    'src/lib/utils.ts',
  ],
  'apps/docs/guide/cli.md': ['components.json', 'src/styles/globals.css'],
  'apps/docs/guide/registry.md': [
    'registry:ui',
    '"path":',
    'components.json',
    '@/lib/utils',
  ],
  'apps/docs/guide/theming.md': [
    "@import '@zeus-web/themes/slate.css'",
    'components.css provides the default',
  ],
}

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf-8')
}

function main(): void {
  const errors: string[] = []

  for (const file of requiredFiles) {
    if (!existsSync(resolve(root, file))) {
      errors.push(`Missing public docs file: ${file}`)
    }
  }

  for (const [file, contents] of Object.entries(requiredContent)) {
    if (!existsSync(resolve(root, file))) continue

    const source = read(file)

    for (const content of contents) {
      if (!source.includes(content)) {
        errors.push(`${file} must contain "${content}"`)
      }
    }
  }

  for (const [file, contents] of Object.entries(forbiddenContent)) {
    if (!existsSync(resolve(root, file))) continue

    const source = read(file)

    for (const content of contents) {
      if (source.includes(content)) {
        errors.push(`${file} must not contain stale content "${content}"`)
      }
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('Public docs check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Public docs check passed.'))
}

main()
