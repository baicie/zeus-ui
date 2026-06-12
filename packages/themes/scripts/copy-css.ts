import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const srcDir = join(__dirname, '../src')
const distDir = join(__dirname, '../dist')
const cssFiles = [
  'tokens.css',
  'default.css',
  'slate.css',
  'zinc.css',
  'neutral.css',
  'stone.css',
  'components.css',
]

for (const cssFile of cssFiles) {
  const src = join(srcDir, cssFile)
  const dest = join(distDir, cssFile)

  if (!existsSync(src)) {
    console.warn(`[copy-css] Source not found: ${cssFile}`)
    continue
  }

  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  console.info(`[copy-css] Copied ${cssFile}`)
}
