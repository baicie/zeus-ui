import type {
  PublishedPackageLatestBaseline,
  RegistryFetch,
} from './check-published-packages'
import { writeFileSync } from 'node:fs'

import { pathToFileURL } from 'node:url'

import pc from 'picocolors'
import { listPublishablePackages } from '../../release/workspace'
import { capturePublishedPackageLatestBaseline } from './check-published-packages'

interface CapturePublishedLatestOptions {
  output: string
  registry: string
  root: string
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'

export function parseCapturePublishedLatestOptions(
  args: string[],
  root = process.cwd(),
): CapturePublishedLatestOptions {
  let output = ''
  let registry = DEFAULT_REGISTRY

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const value = args[index + 1]

    if (arg === '--output' && value) {
      output = value
      index += 1
      continue
    }

    if (arg === '--registry' && value) {
      registry = value
      index += 1
      continue
    }

    throw new Error(`Unknown or incomplete option: ${arg}`)
  }

  if (!output) {
    throw new Error('Expected --output with a baseline file path')
  }

  return {
    output,
    registry: registry.endsWith('/') ? registry : `${registry}/`,
    root,
  }
}

export function writePublishedPackageLatestBaseline(
  output: string,
  baseline: PublishedPackageLatestBaseline,
): void {
  writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
}

export function runCapturePublishedLatest(
  args: string[],
  root = process.cwd(),
  fetcher?: RegistryFetch,
): Promise<number> {
  const options = parseCapturePublishedLatestOptions(args, root)
  const packageNames = listPublishablePackages(options.root).map(
    pkg => pkg.name,
  )

  return capturePublishedPackageLatestBaseline(
    packageNames,
    options.registry,
    fetcher,
  ).then(baseline => {
    writePublishedPackageLatestBaseline(options.output, baseline)

    return packageNames.length
  })
}

function main(): Promise<void> {
  return Promise.resolve()
    .then(() => runCapturePublishedLatest(process.argv.slice(2)))
    .then(packageCount => {
      console.info(
        pc.green(`Captured latest baseline for ${packageCount} packages.`),
      )
    })
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error((error as Error).message)
    process.exit(1)
  })
}
