import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(root, '..')
const distDir = resolve(packageRoot, 'dist')
const packageTemplatesDir = resolve(packageRoot, 'templates')
const distTemplatesDir = resolve(distDir, 'templates')
const registryPath = resolve(packageRoot, 'registry.json')

function isPathInside(rootPath, targetPath) {
  const relativePath = relative(rootPath, targetPath)

  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  )
}

function readRegistrySources(source) {
  const registry = JSON.parse(source)
  const sources = new Set()

  for (const item of registry.items) {
    for (const file of item.files) {
      sources.add(file.source)
    }
  }

  return Array.from(sources)
}

function copyRegistrySource(relativePath) {
  const source = resolve(packageRoot, relativePath)
  const target = resolve(distDir, relativePath)

  if (
    !isPathInside(packageTemplatesDir, source) ||
    !isPathInside(distTemplatesDir, target)
  ) {
    throw new Error(
      `Registry template path escapes templates/: ${relativePath}`,
    )
  }

  return mkdir(dirname(target), {
    recursive: true,
  }).then(() => copyFile(source, target))
}

rm(distTemplatesDir, {
  recursive: true,
  force: true,
})
  .then(() =>
    mkdir(distDir, {
      recursive: true,
    }),
  )
  .then(() => readFile(registryPath, 'utf8'))
  .then(source => {
    const copies = [copyFile(registryPath, resolve(distDir, 'registry.json'))]

    for (const relativePath of readRegistrySources(source)) {
      copies.push(copyRegistrySource(relativePath))
    }

    return Promise.all(copies)
  })
