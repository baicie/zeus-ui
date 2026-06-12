import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

interface PackageJson {
  name?: string
  description?: string
  exports?: Record<string, unknown>
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  sideEffects?: string[]
}

const root = process.cwd()
const packageRoot = resolve(root, 'packages/ui')

const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'src/css.d.ts',
  'src/index.ts',
  'src/styles.css',
  'src/button.ts',
  'src/button.css',
  'src/input.ts',
  'src/input.css',
  'scripts/copy-css.mjs',
  '__tests__/ui-package.spec.ts',
]

const requiredExports = [
  '.',
  './styles.css',
  './button',
  './button.css',
  './input',
  './input.css',
]

function read(relativePath: string): string {
  return readFileSync(resolve(packageRoot, relativePath), 'utf-8')
}

function assertFileExists(relativePath: string, errors: string[]): void {
  if (!existsSync(resolve(packageRoot, relativePath))) {
    errors.push(`Missing packages/ui/${relativePath}`)
  }
}

function checkPackageJson(errors: string[]): void {
  const packageJson = JSON.parse(read('package.json')) as PackageJson

  if (packageJson.name !== '@zeus-web/ui') {
    errors.push('packages/ui/package.json name must be @zeus-web/ui')
  }

  if (
    packageJson.description !==
    'Styled native Web Component entrypoints for Zeus Web.'
  ) {
    errors.push(
      'packages/ui/package.json description must describe styled native Web-C entrypoints',
    )
  }

  for (const exportName of requiredExports) {
    if (!packageJson.exports?.[exportName]) {
      errors.push(`packages/ui/package.json missing export ${exportName}`)
    }
  }

  for (const dep of [
    '@zeus-web/button',
    '@zeus-web/input',
    '@zeus-web/themes',
  ]) {
    if (!packageJson.dependencies?.[dep]) {
      errors.push(`packages/ui/package.json missing dependency ${dep}`)
    }
  }

  for (const script of ['build', 'check', 'test']) {
    if (!packageJson.scripts?.[script]) {
      errors.push(`packages/ui/package.json missing script ${script}`)
    }
  }

  const sideEffects = packageJson.sideEffects ?? []
  if (!sideEffects.some(item => item.includes('css'))) {
    errors.push('packages/ui/package.json must keep css files as side effects')
  }
}

function checkEntrySources(errors: string[]): void {
  const buttonEntry = read('src/button.ts')
  const inputEntry = read('src/input.ts')
  const indexEntry = read('src/index.ts')

  const buttonRequired = [
    "import '@zeus-web/themes/default.css'",
    "import './button.css'",
    "import '@zeus-web/button/wc'",
  ]

  const inputRequired = [
    "import '@zeus-web/themes/default.css'",
    "import './input.css'",
    "import '@zeus-web/input/wc'",
  ]

  for (const item of buttonRequired) {
    if (!buttonEntry.includes(item)) {
      errors.push(`packages/ui/src/button.ts must contain ${item}`)
    }
  }

  for (const item of inputRequired) {
    if (!inputEntry.includes(item)) {
      errors.push(`packages/ui/src/input.ts must contain ${item}`)
    }
  }

  if (!indexEntry.includes("import './button'")) {
    errors.push("packages/ui/src/index.ts must import './button'")
  }

  if (!indexEntry.includes("import './input'")) {
    errors.push("packages/ui/src/index.ts must import './input'")
  }
}

function checkCssSources(errors: string[]): void {
  const stylesCss = read('src/styles.css')
  const buttonCss = read('src/button.css')
  const inputCss = read('src/input.css')

  const stylesRequired = [
    "@import '@zeus-web/themes/default.css'",
    "@import './button.css'",
    "@import './input.css'",
  ]

  for (const item of stylesRequired) {
    if (!stylesCss.includes(item)) {
      errors.push(`packages/ui/src/styles.css must contain ${item}`)
    }
  }

  const buttonRequired = [
    "zw-button [data-slot='button']",
    'zw-button::part(button)',
    "zw-button[variant='primary']::part(button)",
    'hsl(var(--zw-primary))',
    'hsl(var(--zw-primary-foreground))',
    'var(--zw-radius-md)',
    'hsl(var(--zw-destructive))',
    'hsl(var(--zw-destructive-foreground))',
  ]

  const inputRequired = [
    "zw-input [data-slot='input']",
    'zw-input::part(input)',
    'hsl(var(--zw-input))',
    'hsl(var(--zw-ring))',
    'var(--zw-radius-md)',
    'hsl(var(--zw-destructive))',
  ]

  for (const item of buttonRequired) {
    if (!buttonCss.includes(item)) {
      errors.push(`packages/ui/src/button.css must contain ${item}`)
    }
  }

  for (const item of inputRequired) {
    if (!inputCss.includes(item)) {
      errors.push(`packages/ui/src/input.css must contain ${item}`)
    }
  }
}

function main(): void {
  const errors: string[] = []

  if (!existsSync(packageRoot)) {
    errors.push('Missing packages/ui package')
  } else {
    for (const file of requiredFiles) {
      assertFileExists(file, errors)
    }

    if (errors.length === 0) {
      checkPackageJson(errors)
      checkEntrySources(errors)
      checkCssSources(errors)
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('@zeus-web/ui package check failed:'))
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(pc.green('@zeus-web/ui package check passed.'))
}

main()
