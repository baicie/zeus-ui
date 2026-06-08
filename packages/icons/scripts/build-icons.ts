import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'

import icons from '@zeus-js/output-icons'

import { iconsManifest, iconSources } from '../src/icons'

interface IconVirtualModule {
  fileName: string
  code: string
}

interface IconOutputAsset {
  type: 'asset'
  fileName: string
  source: string | Uint8Array
}

const root = process.cwd()
const outDir = resolve(root, 'dist')

function normalizeOutputPath(fileName: string): string {
  return fileName.replace(/^\.\//, '')
}

function resolveSafeOutputPath(fileName: string): string {
  const normalized = normalizeOutputPath(fileName)
  const target = resolve(outDir, normalized)
  const relativeTarget = relative(outDir, target).replace(/\\/g, '/')

  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith('../') ||
    isAbsolute(relativeTarget)
  ) {
    throw new Error(`Refusing to write icon output outside dist: ${fileName}`)
  }

  return target
}

async function writeOutput(fileName: string, source: string | Uint8Array) {
  const target = resolveSafeOutputPath(fileName)

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, source)
}

async function writeVirtualModules(modules: IconVirtualModule[]) {
  for (const module of modules) {
    await writeOutput(module.fileName, module.code)
  }
}

async function writeOutputFiles(files: IconOutputAsset[]) {
  for (const file of files) {
    if (file.type !== 'asset') continue

    await writeOutput(file.fileName, file.source)
  }
}

async function main() {
  const plugin = icons({
    icons: [...iconSources],
    outDir: '.',
    react: {
      outDir: 'react',
    },
    vue: {
      outDir: 'vue',
    },
    wc: {
      outDir: 'wc',
      tagPrefix: 'zw-icon-',
    },
    svg: true,
    dts: true,
  })

  const getModules =
    plugin.virtualModules as unknown as () => IconVirtualModule[]
  const getFiles = plugin.generateBundle as unknown as () => IconOutputAsset[]

  const modules = getModules()
  const files = getFiles()

  await writeVirtualModules(modules)
  await writeOutputFiles(files)

  await writeOutput(
    'manifest.json',
    `${JSON.stringify(iconsManifest, null, 2)}\n`,
  )
}

main().catch(error => {
  console.error(String(error))
  process.exit(1)
})
