import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { createBuiltinThemeFileCss, themeNames, themePalettes } from '../src'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = join(__dirname, '../src')
const checkOnly = process.argv.includes('--check')

let failed = false

for (const theme of themeNames) {
  const expected = createBuiltinThemeFileCss(theme, themePalettes[theme])
  const file = join(srcDir, `${theme}.css`)
  const actual = readFileSync(file, 'utf-8')

  if (actual === expected) continue

  if (checkOnly) {
    failed = true
    console.error(`[emit-theme-css] ${theme}.css is out of date`)
    continue
  }

  writeFileSync(file, expected, 'utf-8')
  console.info(`[emit-theme-css] Wrote ${theme}.css`)
}

if (failed) process.exitCode = 1
