import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(root, '..')
const sourceDir = resolve(packageRoot, 'src')
const distDir = resolve(packageRoot, 'dist')

const files = ['styles.css', 'button.css', 'input.css']

await mkdir(distDir, {
  recursive: true,
})

await Promise.all(
  files.map(file => copyFile(resolve(sourceDir, file), resolve(distDir, file))),
)
