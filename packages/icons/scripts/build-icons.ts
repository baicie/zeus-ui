import type { ZeusOutputFile, ZeusVirtualModule } from '@zeus-js/bundler-plugin'

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import icons from '@zeus-js/output-icons'

import { iconsManifest, iconSources } from '../src/icons'

const root = process.cwd()
const outDir = resolve(root, 'dist')

function normalizeOutputPath(fileName: string): string {
  return fileName.replace(/^\.\//, '')
}

async function writeOutput(fileName: string, source: string | Uint8Array) {
  const target = resolve(outDir, normalizeOutputPath(fileName))

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, source)
}

async function writeVirtualModules(modules: ZeusVirtualModule[]) {
  for (const module of modules) {
    await writeOutput(module.fileName, module.code)
  }
}

async function writeOutputFiles(files: ZeusOutputFile[]) {
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

  const modules = plugin.virtualModules?.() ?? []
  const files = plugin.generateBundle?.() ?? []

  await writeVirtualModules(modules)
  await writeOutputFiles(files)

  await writeOutput(
    'manifest.json',
    `${JSON.stringify(iconsManifest, null, 2)}\n`,
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
