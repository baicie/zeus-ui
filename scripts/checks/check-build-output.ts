import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execa } from 'execa'

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

async function main() {
  let hasError = false

  for (const file of requiredFiles) {
    const abs = join(root, file)

    if (!existsSync(abs)) {
      console.error(`[build-output] missing ${file}`)
      hasError = true
    }
  }

  if (!hasError) {
    const result = await execa(
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
        'ES2016',
        '--jsx',
        'preserve',
        '--skipLibCheck',
        'true',
        '--types',
        'node',
      ],
      {
        cwd: root,
      },
    )

    if (result.exitCode !== 0) {
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
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
