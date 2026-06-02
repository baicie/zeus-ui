import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'packages/primitives/input/dist/wc/index.js',
  'packages/primitives/input/dist/wc/index.d.ts',
  'packages/primitives/input/dist/react/index.js',
  'packages/primitives/input/dist/react/index.d.ts',
  'packages/primitives/input/dist/vue/index.js',
  'packages/primitives/input/dist/vue/index.d.ts',
  'packages/primitives/input/dist/vue/global.d.ts',
  'packages/primitives/input/dist/custom-elements.json',
  'packages/primitives/input/dist/zeus.components.json',
]

const requiredDtsFiles = requiredFiles.filter(file => file.endsWith('.d.ts'))

let hasError = false

for (const file of requiredFiles) {
  const abs = join(root, file)

  if (!existsSync(abs)) {
    console.error(`[build-output] missing ${file}`)
    hasError = true
  }
}

if (!hasError) {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'tsc',
      ...requiredDtsFiles,
      '--ignoreConfig',
      '--noEmit',
      '--module',
      'ESNext',
      '--moduleResolution',
      'bundler',
      '--target',
      'ES2022',
      '--jsx',
      'preserve',
      '--skipLibCheck',
      'true',
      '--types',
      'node',
    ],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )

  if (result.status !== 0) {
    console.error('[build-output] generated dts files are invalid')
    if (result.stdout) {
      console.error(result.stdout)
    }
    if (result.stderr) {
      console.error(result.stderr)
    }
    hasError = true
  }
}

if (hasError) {
  process.exit(1)
}

console.log('Build output looks good.')
