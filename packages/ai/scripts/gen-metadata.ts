import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const distDir = resolve(root, 'dist')

async function main() {
  const { aiMetadata } = await import('../src/index.js')

  await mkdir(distDir, { recursive: true })
  await writeFile(
    resolve(distDir, 'metadata.json'),
    `${JSON.stringify(aiMetadata, null, 2)}\n`,
    'utf-8',
  )
}

main().catch(error => {
  console.error(String(error))
  throw error
})
