import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

type RegistryFramework = 'react' | 'vue' | 'native' | 'shared'
type RegistryItemType = 'component' | 'utility' | 'style'

interface RegistryFile {
  framework: RegistryFramework
  source: string
  target: string
}

interface RegistryItem {
  name: string
  type: RegistryItemType
  description: string
  frameworks: RegistryFramework[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

interface RegistryManifest {
  schemaVersion: number
  name: string
  version: string
  items: RegistryItem[]
}

const root = process.cwd()

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function readFile(path: string): string {
  return readFileSync(resolve(root, path), 'utf-8')
}

function fileExists(path: string, errors: string[]): boolean {
  if (!existsSync(resolve(root, path))) {
    errors.push(`Missing: ${path}`)
    return false
  }
  return true
}

function mustContain(file: string, contents: string[], errors: string[]): void {
  const source = readFile(file)
  for (const text of contents) {
    if (!source.includes(text)) {
      errors.push(`${file} must contain "${text}"`)
    }
  }
}

function mustNotContain(
  file: string,
  contents: string[],
  errors: string[],
): void {
  const source = readFile(file)
  for (const text of contents) {
    if (source.includes(text)) {
      errors.push(`${file} must not contain "${text}"`)
    }
  }
}

// ---------------------------------------------------------------------------
// check:registry
// ---------------------------------------------------------------------------

function checkRegistry(errors: string[]): void {
  const packageRoot = resolve(root, 'packages/registry')

  if (!fileExists(packageRoot, errors)) return

  const pkg = JSON.parse(readFile('packages/registry/package.json')) as {
    exports?: Record<string, unknown>
    scripts?: Record<string, string>
    description?: string
    sideEffects?: unknown
  }
  const manifest = JSON.parse(
    readFile('packages/registry/registry.json'),
  ) as RegistryManifest

  if (pkg.description !== 'Source component registry templates for Zeus Web.') {
    errors.push('packages/registry/package.json description is incorrect')
  }
  if (pkg.sideEffects !== false) {
    errors.push('packages/registry/package.json sideEffects must be false')
  }

  const requiredExports = [
    '.',
    './schema',
    './registry.json',
    './templates/react/button.tsx',
    './templates/react/input.tsx',
    './templates/vue/button.vue',
    './templates/vue/input.vue',
    './templates/css/globals.css',
    './templates/lib/cn.ts',
  ]
  for (const e of requiredExports) {
    if (!pkg.exports?.[e]) errors.push(`missing export ${e}`)
  }
  for (const s of ['build', 'check', 'test']) {
    if (!pkg.scripts?.[s]) errors.push(`missing script ${s}`)
  }

  if (manifest.schemaVersion !== 1) {
    errors.push('registry.json schemaVersion must be 1')
  }
  if (manifest.name !== '@zeus-web/registry') {
    errors.push('registry.json name must be @zeus-web/registry')
  }
  if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
    errors.push('registry.json must contain items')
    return
  }

  const names = new Set<string>()
  const allowedTypes = new Set(['component', 'utility', 'style'])
  const allowedFrameworks = new Set(['react', 'vue', 'native', 'shared'])

  for (const item of manifest.items) {
    if (!item.name) {
      errors.push('registry item missing name')
      continue
    }
    if (names.has(item.name)) errors.push(`duplicate: ${item.name}`)
    names.add(item.name)
    if (!allowedTypes.has(item.type)) errors.push(`${item.name}: invalid type`)
    if (!item.description) errors.push(`${item.name}: description required`)
    if (!Array.isArray(item.frameworks) || item.frameworks.length === 0) {
      errors.push(`${item.name}: frameworks must be non-empty`)
    } else {
      for (const fw of item.frameworks) {
        if (!allowedFrameworks.has(fw))
          errors.push(`${item.name}: invalid framework ${fw}`)
      }
    }
    if (!Array.isArray(item.dependencies))
      errors.push(`${item.name}: dependencies must be array`)
    if (!Array.isArray(item.registryDependencies))
      errors.push(`${item.name}: registryDependencies must be array`)
    if (!Array.isArray(item.files) || item.files.length === 0)
      errors.push(`${item.name}: files must be non-empty`)
    for (const file of item.files) {
      if (!allowedFrameworks.has(file.framework))
        errors.push(`${item.name}: invalid file framework`)
      if (!file.source.startsWith('templates/'))
        errors.push(`${item.name}: source must start templates/`)
      if (file.target.startsWith('/') || file.target.includes('..'))
        errors.push(`${item.name}: unsafe target`)
      if (!existsSync(resolve(packageRoot, file.source)))
        errors.push(`${item.name}: missing template ${file.source}`)
    }
  }

  for (const required of ['button', 'input', 'cn', 'globals']) {
    if (!names.has(required)) errors.push(`registry.json missing ${required}`)
  }

  for (const item of manifest.items) {
    for (const dep of item.registryDependencies) {
      if (!names.has(dep))
        errors.push(`${item.name}: missing registry dep ${dep}`)
    }
  }

  const button = manifest.items.find(i => i.name === 'button')
  const input = manifest.items.find(i => i.name === 'input')
  if (button) {
    if (!button.dependencies.includes('@zeus-web/button'))
      errors.push('button must depend on @zeus-web/button')
    if (!button.registryDependencies.includes('cn'))
      errors.push('button must registry-dep cn')
    if (!button.registryDependencies.includes('globals'))
      errors.push('button must registry-dep globals')
  }
  if (input) {
    if (!input.dependencies.includes('@zeus-web/input'))
      errors.push('input must depend on @zeus-web/input')
    if (!input.registryDependencies.includes('cn'))
      errors.push('input must registry-dep cn')
    if (!input.registryDependencies.includes('globals'))
      errors.push('input must registry-dep globals')
  }

  const reactButton = readFile('packages/registry/templates/react/button.tsx')
  const reactInput = readFile('packages/registry/templates/react/input.tsx')
  const vueButton = readFile('packages/registry/templates/vue/button.vue')
  const vueInput = readFile('packages/registry/templates/vue/input.vue')
  const cn = readFile('packages/registry/templates/lib/cn.ts')
  const globals = readFile('packages/registry/templates/css/globals.css')

  for (const [file, src, checks] of [
    [
      'templates/react/button.tsx',
      reactButton,
      [
        "import { Button as ButtonPrimitive } from '@zeus-web/button/react'",
        "import { cn } from '@/lib/cn'",
        'export function Button',
        '--zeus-primary',
      ],
    ],
    [
      'templates/react/input.tsx',
      reactInput,
      [
        "import { Input as InputPrimitive } from '@zeus-web/input/react'",
        "import { cn } from '@/lib/cn'",
        'export function Input',
        '--zeus-input',
      ],
    ],
    [
      'templates/vue/button.vue',
      vueButton,
      [
        "import { Button as ButtonPrimitive } from '@zeus-web/button/vue'",
        "import { cn } from '@/lib/cn'",
        '<ButtonPrimitive',
        '--zeus-primary',
      ],
    ],
    [
      'templates/vue/input.vue',
      vueInput,
      [
        "import { Input as InputPrimitive } from '@zeus-web/input/vue'",
        "import { cn } from '@/lib/cn'",
        '<InputPrimitive',
        '--zeus-input',
      ],
    ],
    ['templates/lib/cn.ts', cn, ['export function cn', 'ClassValue']],
    [
      'templates/css/globals.css',
      globals,
      [
        ':root',
        '.dark',
        '--zeus-primary',
        '--zeus-destructive',
        '--zeus-radius-md',
      ],
    ],
  ] as const) {
    for (const text of checks) {
      if (!src.includes(text)) errors.push(`${file} must contain "${text}"`)
    }
  }

  const forbiddenDeps = [
    '@radix-ui/react-dialog',
    '@radix-ui/react-checkbox',
    '@radix-ui/react-switch',
    '@radix-ui/react-tabs',
    '@radix-ui/react-toggle-group',
    '@radix-ui/themes',
  ]
  for (const item of manifest.items) {
    for (const dep of item.dependencies) {
      if (forbiddenDeps.includes(dep))
        errors.push(`${item.name}: ${dep} not used by Phase 17 templates`)
    }
  }
}

// ---------------------------------------------------------------------------
// check:cli-init
// ---------------------------------------------------------------------------

function checkCliInit(errors: string[]): void {
  const required = [
    'packages/cli/src/project.ts',
    'packages/cli/src/registry-assets.ts',
    'packages/cli/src/config.ts',
    'packages/cli/src/commands/init.ts',
    'packages/cli/__tests__/init.spec.ts',
  ]
  let allExist = true
  for (const f of required) {
    if (!fileExists(f, errors)) allExist = false
  }
  if (!allExist) return

  mustContain(
    'packages/cli/src/config.ts',
    [
      "export const zeusUiConfigFileName = 'zeus-ui.json'",
      "export const legacyComponentsConfigFileName = 'components.json'",
      "export type ComponentsFramework = 'react' | 'vue'",
      'ensureCnUtil',
      'ensureThemeCss',
      'readRegistryCnTemplate',
      'getThemeColors',
      'semanticColorTokens',
    ],
    errors,
  )
  mustContain(
    'packages/cli/src/project.ts',
    [
      'detectProject',
      "SupportedFramework = 'react' | 'vue'",
      'detectPackageManager',
      'Both React and Vue dependencies were detected',
    ],
    errors,
  )
  mustContain(
    'packages/cli/src/commands/init.ts',
    [
      '--framework',
      '--dry-run',
      'Created zeus-ui.json',
      'ensureCnUtil',
      'ensureThemeCss',
      'detectProject(options.cwd, {',
      'framework: options.framework',
    ],
    errors,
  )
  mustContain(
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

// ---------------------------------------------------------------------------
// check:cli-add
// ---------------------------------------------------------------------------

function checkCliAdd(errors: string[]): void {
  const required = [
    'packages/cli/src/commands/add.ts',
    'packages/cli/src/lock.ts',
    'packages/cli/__tests__/add.spec.ts',
  ]
  let allExist = true
  for (const f of required) {
    if (!fileExists(f, errors)) allExist = false
  }
  if (!allExist) return

  mustContain(
    'packages/cli/src/commands/add.ts',
    [
      'collectRegistryItems',
      'registryDependencies',
      'shouldIncludeFileForFramework',
      'rewriteRegistrySource',
      'resolveRegistryTarget',
      'readComponentsConfig',
      'updateComponentsLockFromPlans',
      'readRegistryAsset(params.file.source)',
      '--dry-run',
      '--overwrite',
      '--install',
    ],
    errors,
  )
  mustNotContain(
    'packages/cli/src/commands/add.ts',
    ['resolveRegistryRoot', 'resolveRegistryJsonPath', 'readFile(sourcePath'],
    errors,
  )
  mustContain(
    'packages/cli/src/lock.ts',
    [
      'zeus-ui.lock.json',
      'readComponentsLock',
      'writeComponentsLock',
      'createEmptyComponentsLock',
    ],
    errors,
  )
  mustContain(
    'packages/cli/__tests__/add.spec.ts',
    [
      'expands registry dependencies before the component',
      'filters files by React framework',
      'filters files by Vue framework',
      'dedupes shared registry dependencies',
      'marks existing files as skipped by default',
      'marks existing files as overwrite when requested',
      'writes registry files and updates lock when running add command',
    ],
    errors,
  )
}

// ---------------------------------------------------------------------------
// check:cli-update-diff
// ---------------------------------------------------------------------------

function checkCliUpdateDiff(errors: string[]): void {
  const required = [
    'packages/cli/src/commands/diff.ts',
    'packages/cli/src/commands/update.ts',
    'packages/cli/src/lock.ts',
    'packages/cli/__tests__/diff.spec.ts',
    'packages/cli/__tests__/update.spec.ts',
  ]
  let allExist = true
  for (const f of required) {
    if (!fileExists(f, errors)) allExist = false
  }
  if (!allExist) return

  mustContain(
    'packages/cli/src/commands/diff.ts',
    ['untracked-missing', 'readEffectiveComponentsLock'],
    errors,
  )
  mustNotContain(
    'packages/cli/src/commands/diff.ts',
    ['migrateLegacyLockIfNeeded'],
    errors,
  )
  mustContain(
    'packages/cli/src/commands/update.ts',
    [
      'createUpdatePlans',
      'updateComponentsLockFromPlans',
      'registry-and-local-changed',
      '--overwrite',
      '--dry-run',
      'writtenTargets',
      'untracked-missing',
      'component is not installed; run zweb add first',
    ],
    errors,
  )
  mustNotContain(
    'packages/cli/src/commands/update.ts',
    ['components.lock.json', 'readLegacyLock', 'updateLegacyLockFromPlans'],
    errors,
  )
  mustContain(
    'packages/cli/src/lock.ts',
    [
      'fileHashes',
      'registryHashes',
      'getLockedFileHash',
      'getLockedRegistryHash',
      'migrateLegacyLockIfNeeded',
      'readEffectiveComponentsLock',
      'createComponentsLockFromLegacy',
    ],
    errors,
  )
  mustContain(
    'packages/cli/__tests__/diff.spec.ts',
    ['reports untracked-missing', 'reports locally-modified'],
    errors,
  )
  mustContain(
    'packages/cli/__tests__/update.spec.ts',
    [
      'does not install untracked components through update',
      'restores tracked missing files',
      'does not overwrite local modifications without --overwrite',
      'overwrites local modifications with --overwrite',
      'dry-run does not write missing files',
    ],
    errors,
  )
}

// ---------------------------------------------------------------------------
// check:showcase-registry
// ---------------------------------------------------------------------------

function checkShowcaseRegistry(errors: string[]): void {
  const required = [
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
  let allExist = true
  for (const f of required) {
    if (!fileExists(f, errors)) allExist = false
  }
  if (!allExist) return

  mustContain(
    'scripts/examples/sync-showcase-registry.ts',
    [
      "const syncedComponents = ['button', 'input']",
      'createShowcaseConfig',
      'createShowcaseLock',
      'Showcase registry files are up to date.',
    ],
    errors,
  )
  mustContain(
    'examples/react-showcase/src/demos/p0/ButtonDemoPage.tsx',
    [
      "import { Button } from '@/components/ui/button'",
      '<span className="showcase-badge">@/components/ui/button</span>',
    ],
    errors,
  )
  mustNotContain(
    'examples/react-showcase/src/demos/p0/ButtonDemoPage.tsx',
    ['@zeus-web/button/react'],
    errors,
  )
  mustContain(
    'examples/react-showcase/src/demos/p0/InputDemoPage.tsx',
    [
      "import { Input } from '@/components/ui/input'",
      '<span className="showcase-badge">@/components/ui/input</span>',
    ],
    errors,
  )
  mustNotContain(
    'examples/react-showcase/src/demos/p0/InputDemoPage.tsx',
    ['@zeus-web/input/react'],
    errors,
  )
  mustContain(
    'examples/vue-showcase/src/demos/p0/ButtonDemoPage.vue',
    [
      "import Button from '@/components/ui/button.vue'",
      '<span class="showcase-badge">@/components/ui/button.vue</span>',
    ],
    errors,
  )
  mustNotContain(
    'examples/vue-showcase/src/demos/p0/ButtonDemoPage.vue',
    ['@zeus-web/button/vue'],
    errors,
  )
  mustContain(
    'examples/vue-showcase/src/demos/p0/InputDemoPage.vue',
    [
      "import Input from '@/components/ui/input.vue'",
      '<span class="showcase-badge">@/components/ui/input.vue</span>',
    ],
    errors,
  )
  mustNotContain(
    'examples/vue-showcase/src/demos/p0/InputDemoPage.vue',
    ['@zeus-web/input/vue'],
    errors,
  )
  mustContain(
    'examples/react-showcase/src/main.tsx',
    ["import './styles/zeus.css'"],
    errors,
  )
  mustContain(
    'examples/vue-showcase/src/main.ts',
    ["import './styles/zeus.css'"],
    errors,
  )
}

// ---------------------------------------------------------------------------
// check:native-showcase
// ---------------------------------------------------------------------------

function checkNativeShowcase(errors: string[]): void {
  const required = [
    'examples/native-showcase/package.json',
    'examples/native-showcase/tsconfig.json',
    'examples/native-showcase/vite.config.ts',
    'examples/native-showcase/vitest.config.ts',
    'examples/native-showcase/index.html',
    'examples/native-showcase/src/main.ts',
    'examples/native-showcase/src/showcase.ts',
    'examples/native-showcase/src/styles.css',
    'examples/native-showcase/src/showcase.spec.ts',
    'scripts/examples/build-showcase-deps.ts',
  ]
  let allExist = true
  for (const f of required) {
    if (!fileExists(f, errors)) allExist = false
  }
  if (!allExist) return

  mustContain(
    'examples/native-showcase/package.json',
    [
      '"@zeus-web/example-native-showcase"',
      '"@zeus-web/ui"',
      '"vite"',
      '"vitest"',
    ],
    errors,
  )
  mustNotContain(
    'examples/native-showcase/package.json',
    ['"react"', '"react-dom"', '"vue"', '"vue-router"'],
    errors,
  )
  mustContain(
    'examples/native-showcase/src/main.ts',
    ["import '@zeus-web/ui'", "import './styles.css'", 'renderNativeShowcase'],
    errors,
  )
  mustContain(
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
  mustNotContain(
    'examples/native-showcase/src/showcase.ts',
    ['from "react"', "from 'react'", "from 'vue'", 'from "vue"'],
    errors,
  )
  mustContain(
    'examples/native-showcase/src/showcase.spec.ts',
    [
      "import '@zeus-web/ui'",
      "customElements.get('zw-button')",
      "customElements.get('zw-input')",
      'renderNativeShowcase',
      "root.querySelectorAll('zw-button')",
      "root.querySelectorAll('zw-input')",
    ],
    errors,
  )
  mustNotContain(
    'examples/native-showcase/src/showcase.spec.ts',
    ['from "react"', "from 'react'", "from 'vue'", 'from "vue"'],
    errors,
  )
  mustContain(
    'scripts/examples/build-showcase-deps.ts',
    [
      "const nativeShowcasePackages = ['@zeus-web/ui']",
      'createBuildTargetNames',
    ],
    errors,
  )
}

// ---------------------------------------------------------------------------
// check:phase24-release
// ---------------------------------------------------------------------------

function checkPhase24Release(errors: string[]): void {
  const required = [
    'scripts/checks/release/check-release-readiness.ts',
    'scripts/checks/release/check-release-tarballs.ts',
    'scripts/checks/release/check-release-final.ts',
    'docs/release/release-readiness.md',
    'docs/design/zeus-ui-release-readiness.md',
    'LICENSE',
  ]
  let allExist = true
  for (const f of required) {
    if (!fileExists(f, errors)) allExist = false
  }
  if (!allExist) return

  mustContain(
    'package.json',
    ['"release:verify:strict"', '"release:verify:pack"', '"release:final"'],
    errors,
  )
  mustContain(
    'scripts/checks/release/check-release-readiness.ts',
    [
      'checkUiPackage',
      'checkRegistryPackage',
      'checkThemesPackage',
      'checkAiPackage',
      'checkExportTargets',
      'checkFilesAllowList',
      'checkPrivateExamplesAndDocs',
      'wildcardExportTargetExists',
      'Root LICENSE is required',
    ],
    errors,
  )
  mustContain(
    'scripts/checks/release/check-release-tarballs.ts',
    ['pnpm', 'pack', '--dry-run', '--json', 'tarball must include dist/ files'],
    errors,
  )
  mustNotContain(
    'scripts/checks/release/check-release-tarballs.ts',
    ['tarball must include README.md'],
    errors,
  )
  mustContain(
    'scripts/checks/release/check-release-final.ts',
    [
      'parseOptions',
      '--allow-zero',
      'release:verify:strict',
      'release:verify:pack',
      'release:dry',
      'Release final verification passed.',
    ],
    errors,
  )
  mustContain(
    'docs/release/release-readiness.md',
    [
      'pnpm release:final',
      'pnpm release:verify:strict',
      'pnpm release:verify:pack',
    ],
    errors,
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const errors: string[] = []

  checkRegistry(errors)
  checkCliInit(errors)
  checkCliAdd(errors)
  checkCliUpdateDiff(errors)
  checkShowcaseRegistry(errors)
  checkNativeShowcase(errors)
  checkPhase24Release(errors)

  if (errors.length > 0) {
    console.error(pc.red('Product contract check failed:'))
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  console.log(pc.green('Product contract check passed.'))
}

main()
