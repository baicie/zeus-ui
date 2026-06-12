import { copyFile, cp, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(root, '..')
const distDir = resolve(packageRoot, 'dist')

await mkdir(distDir, {
  recursive: true,
})

await copyFile(
  resolve(packageRoot, 'registry.json'),
  resolve(distDir, 'registry.json'),
)

await cp(resolve(packageRoot, 'templates'), resolve(distDir, 'templates'), {
  recursive: true,
})
