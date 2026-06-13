import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(root, '..')
const sourceDir = resolve(packageRoot, 'src')
const distDir = resolve(packageRoot, 'dist')

const cssFiles = ['styles.css', 'button.css', 'input.css']

await mkdir(distDir, {
  recursive: true,
})

await Promise.all(
  cssFiles.map(file =>
    copyFile(resolve(sourceDir, file), resolve(distDir, file)),
  ),
)

await writeFile(
  resolve(distDir, 'index.js'),
  `// Aggregate entry: import '@zeus-web/ui/button' and '@zeus-web/ui/input' directly
// This file exists to satisfy the '.' export; all actual registration is in button.js and input.js
`,
)

await writeFile(resolve(distDir, 'index.d.ts'), 'export {}\n')
