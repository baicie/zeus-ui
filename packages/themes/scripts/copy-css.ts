import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = join(__dirname, '../src')
const distDir = join(__dirname, '../dist')
const srcComponentsDir = join(srcDir, 'components')

const themeFiles = [
  'tokens.css',
  'default.css',
  'slate.css',
  'zinc.css',
  'neutral.css',
  'stone.css',
  'components.css',
]

for (const cssFile of themeFiles) {
  const src = join(srcDir, cssFile)

  mkdirSync(distDir, { recursive: true })
  writeFileSync(join(distDir, cssFile), readFileSync(src, 'utf-8'), 'utf-8')
  console.info(`[copy-css] Copied ${cssFile}`)
}

// Per-component stylesheets live under `dist/components/<name>.css` so the
// package can expose `@zeus-web/themes/components/<name>.css`.
const distComponentsDir = join(distDir, 'components')

mkdirSync(distComponentsDir, { recursive: true })

for (const file of readdirSync(srcComponentsDir)) {
  if (!file.endsWith('.css')) continue

  writeFileSync(
    join(distComponentsDir, file),
    readFileSync(join(srcComponentsDir, file), 'utf-8'),
    'utf-8',
  )
  console.info(`[copy-css] Copied components/${file}`)
}
