import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'scripts/examples/sync-showcase-registry.ts',

  'examples/react-showcase/zeus-ui.json',
  'examples/react-showcase/zeus-ui.lock.json',
  'examples/react-showcase/src/lib/cn.ts',
  'examples/react-showcase/src/styles/zeus.css',
  'examples/react-showcase/src/components/ui/button.tsx',
  'examples/react-showcase/src/components/ui/input.tsx',
  'examples/react-showcase/src/main.tsx',

  'examples/vue-showcase/zeus-ui.json',
  'examples/vue-showcase/zeus-ui.lock.json',
  'examples/vue-showcase/src/lib/cn.ts',
  'examples/vue-showcase/src/styles/zeus.css',
  'examples/vue-showcase/src/components/ui/button.vue',
  'examples/vue-showcase/src/components/ui/input.vue',
  'examples/vue-showcase/src/main.ts',
]

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf-8')
}

function checkFileExists(path: string, errors: string[]): void {
  if (!existsSync(resolve(root, path))) {
    errors.push(`Missing ${path}`)
  }
}

function checkSourceContains(
  file: string,
  contents: string[],
  errors: string[],
): void {
  const source = read(file)

  for (const content of contents) {
    if (!source.includes(content)) {
      errors.push(`${file} must contain "${content}"`)
    }
  }
}

function checkSourceNotContains(
  file: string,
  contents: string[],
  errors: string[],
): void {
  const source = read(file)

  for (const content of contents) {
    if (source.includes(content)) {
      errors.push(`${file} must not contain "${content}"`)
    }
  }
}

function main(): void {
  const errors: string[] = []

  for (const file of requiredFiles) {
    checkFileExists(file, errors)
  }

  if (errors.length === 0) {
    checkSourceContains(
      'package.json',
      [
        '"showcase:registry:sync"',
        '"showcase:registry:check"',
        '"check:showcase-registry"',
      ],
      errors,
    )

    checkSourceContains(
      'scripts/examples/sync-showcase-registry.ts',
      [
        "const syncedComponents = ['button', 'input']",
        'createShowcaseConfig',
        'createShowcaseLock',
        'Showcase registry files are up to date.',
      ],
      errors,
    )

    checkSourceContains(
      'examples/react-showcase/src/demos/p0/ButtonDemoPage.tsx',
      [
        "import { Button } from '@/components/ui/button'",
        '<span className="showcase-badge">@/components/ui/button</span>',
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/react-showcase/src/demos/p0/ButtonDemoPage.tsx',
      ['@zeus-web/button/react'],
      errors,
    )

    checkSourceContains(
      'examples/react-showcase/src/demos/p0/InputDemoPage.tsx',
      [
        "import { Input } from '@/components/ui/input'",
        '<span className="showcase-badge">@/components/ui/input</span>',
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/react-showcase/src/demos/p0/InputDemoPage.tsx',
      ['@zeus-web/input/react'],
      errors,
    )

    checkSourceContains(
      'examples/vue-showcase/src/demos/p0/ButtonDemoPage.vue',
      [
        "import Button from '@/components/ui/button.vue'",
        '<span class="showcase-badge">@/components/ui/button.vue</span>',
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/vue-showcase/src/demos/p0/ButtonDemoPage.vue',
      ['@zeus-web/button/vue'],
      errors,
    )

    checkSourceContains(
      'examples/vue-showcase/src/demos/p0/InputDemoPage.vue',
      [
        "import Input from '@/components/ui/input.vue'",
        '<span class="showcase-badge">@/components/ui/input.vue</span>',
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/vue-showcase/src/demos/p0/InputDemoPage.vue',
      ['@zeus-web/input/vue'],
      errors,
    )

    checkSourceContains(
      'examples/react-showcase/src/main.tsx',
      ["import './styles/zeus.css'"],
      errors,
    )

    checkSourceContains(
      'examples/vue-showcase/src/main.ts',
      ["import './styles/zeus.css'"],
      errors,
    )
  }

  if (errors.length > 0) {
    console.error(pc.red('Showcase registry usage check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Showcase registry usage check passed.'))
}

main()
