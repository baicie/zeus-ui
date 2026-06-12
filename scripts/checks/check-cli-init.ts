import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'packages/cli/src/project.ts',
  'packages/cli/src/registry-assets.ts',
  'packages/cli/src/config.ts',
  'packages/cli/src/commands/init.ts',
  'packages/cli/__tests__/init.spec.ts',
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

function main(): void {
  const errors: string[] = []

  for (const file of requiredFiles) {
    checkFileExists(file, errors)
  }

  if (errors.length === 0) {
    checkSourceContains(
      'packages/cli/src/config.ts',
      [
        "export const zeusUiConfigFileName = 'zeus-ui.json'",
        "export const legacyComponentsConfigFileName = 'components.json'",
        "export type ComponentsFramework = 'react' | 'vue'",
        'ensureCnUtil',
        'ensureThemeCss',
        'readRegistryCnTemplate',
        'readRegistryGlobalsTemplate',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/src/project.ts',
      [
        'detectProject',
        "SupportedFramework = 'react' | 'vue'",
        'detectPackageManager',
        'Both React and Vue dependencies were detected',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/src/commands/init.ts',
      [
        '--framework',
        '--dry-run',
        'Created zeus-ui.json',
        'ensureCnUtil',
        'ensureThemeCss',
        'detectProject',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/__tests__/init.spec.ts',
      [
        'detects react projects',
        'detects vue projects',
        'writes zeus-ui.json and reads it back',
        'keeps legacy components.json readable',
        'creates cn utility from registry template',
      ],
      errors,
    )
  }

  if (errors.length > 0) {
    console.error(pc.red('CLI init check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('CLI init check passed.'))
}

main()
