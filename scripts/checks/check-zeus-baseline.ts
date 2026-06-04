import { readFileSync } from 'node:fs'

import pc from 'picocolors'

interface PackageJsonLike {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

const packageJson = JSON.parse(
  readFileSync('package.json', 'utf8'),
) as PackageJsonLike

const fields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
] as const

const zeusDependencies: Array<{
  field: string
  name: string
  version: string
}> = []

for (const field of fields) {
  const dependencies = packageJson[field] || {}

  for (const [name, version] of Object.entries(dependencies)) {
    if (!name.startsWith('@zeus-js/')) continue

    zeusDependencies.push({
      field,
      name,
      version,
    })
  }
}

let hasError = false

for (const dependency of zeusDependencies) {
  if (/-canary(?:[.-]|$)/.test(dependency.version)) {
    hasError = true
    console.error(
      pc.red(
        `${dependency.field}.${dependency.name} must not use a canary version: ${dependency.version}`,
      ),
    )
  }
}

const versions = new Set(zeusDependencies.map(item => item.version))

if (versions.size > 1) {
  hasError = true
  console.error(
    pc.red(
      `Root @zeus-js/* dependencies must use one synchronized baseline version: ${[
        ...versions,
      ].join(', ')}`,
    ),
  )
}

if (hasError) {
  console.error(
    pc.yellow(
      'Use a published beta/stable version in the repository. Canary versions are installed only inside zeus-canary-compat.yml.',
    ),
  )
  process.exit(1)
}

console.log(pc.green('Zeus baseline dependency check passed.'))
