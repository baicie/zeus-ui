import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'examples/native-showcase/package.json',
  'examples/native-showcase/tsconfig.json',
  'examples/native-showcase/vite.config.ts',
  'examples/native-showcase/vitest.config.ts',
  'examples/native-showcase/index.html',
  'examples/native-showcase/src/main.ts',
  'examples/native-showcase/src/showcase.ts',
  'examples/native-showcase/src/styles.css',
  'examples/native-showcase/src/showcase.spec.ts',
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
        '"showcase:native"',
        '"showcase:native:build"',
        '"showcase:native:test"',
        '"check:native-showcase"',
      ],
      errors,
    )

    checkSourceContains(
      'examples/native-showcase/package.json',
      [
        '"@zeus-web/example-native-showcase"',
        '"@zeus-web/ui"',
        '"vite"',
        '"vitest"',
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/native-showcase/package.json',
      ['"react"', '"react-dom"', '"vue"', '"vue-router"'],
      errors,
    )

    checkSourceContains(
      'examples/native-showcase/src/main.ts',
      [
        "import '@zeus-web/ui'",
        "import './styles.css'",
        'renderNativeShowcase',
      ],
      errors,
    )

    checkSourceContains(
      'examples/native-showcase/src/showcase.ts',
      [
        'document.createElement',
        "'zw-button'",
        "'zw-input'",
        "import '@zeus-web/ui'",
        "import '@zeus-web/ui/button'",
        "import '@zeus-web/ui/input'",
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/native-showcase/src/showcase.ts',
      ['from "react"', "from 'react'", "from 'vue'", 'from "vue"'],
      errors,
    )

    checkSourceContains(
      'examples/native-showcase/src/showcase.spec.ts',
      [
        'renderNativeShowcase',
        "root.querySelectorAll('zw-button')",
        "root.querySelectorAll('zw-input')",
      ],
      errors,
    )
  }

  if (errors.length > 0) {
    console.error(pc.red('Native showcase check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Native showcase check passed.'))
}

main()
