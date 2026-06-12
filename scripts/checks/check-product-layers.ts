import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

interface RequiredDoc {
  path: string
  mustContain: string[]
}

const root = process.cwd()

const docs: RequiredDoc[] = [
  {
    path: 'docs/internal/design/zeus-ui-product-layers.md',
    mustContain: [
      '# Zeus-UI Product Layers',
      'Zeus-UI primitives',
      'Zeus-UI themes',
      'Zeus-UI native styled Web-C',
      'Zeus-UI registry',
      'Zeus-UI CLI',
      '@zeus-web/ui',
      '@zeus-web/registry',
      'Keep primitives headless',
      'Do not make primitive packages the default styled user experience',
    ],
  },
  {
    path: 'docs/internal/design/zeus-ui-usage-model.md',
    mustContain: [
      '# Zeus-UI Usage Model',
      'React / Vue application usage',
      'Native Web Component usage',
      'Advanced primitive usage',
      'pnpm dlx zeus-web init',
      'pnpm dlx zeus-web add button input dialog',
      "import '@zeus-web/ui/styles.css'",
      "import '@zeus-web/ui/button'",
      "import { Button } from '@/components/ui/button'",
      "import { Button } from '@zeus-web/button/react'",
      "import '@zeus-web/button/wc'",
    ],
  },
  {
    path: 'docs/internal/design/zeus-ui-package-boundaries.md',
    mustContain: [
      '# Zeus-UI Package Boundaries',
      '@zeus-web/<primitive>',
      '@zeus-web/themes',
      '@zeus-web/ui',
      '@zeus-web/registry',
      'zeus-web',
      'Primitive packages should avoid depending on `@zeus-web/ui`, `@zeus-web/registry` or CLI packages.',
      'Forbidden direction',
      'primitives -> ui',
      'primitives -> registry',
      'primitives -> cli',
    ],
  },
  {
    path: 'docs/internal/examples/showcase-roadmap.md',
    mustContain: [
      '| Phase 15 | Done',
      '| Phase 16 | Done',
      '| Phase 17 | Done',
      '| Phase 18 | Done',
      '| Phase 19 | Done',
      '| Phase 20 | Done',
      'The showcase has thirteen layers of checks:',
      'Product layer checks validate Zeus-UI package boundaries and usage entry decisions.',
      'Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.',
      'Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.',
      'CLI init checks validate zeus-ui.json initialization, project detection and base file generation.',
      'CLI add checks validate registry dependency expansion, framework-specific template filtering and lockfile tracking.',
      'Showcase registry checks validate React and Vue demos consume registry-synced local styled components.',
      'pnpm check:product-layers',
      'pnpm check:ui-package',
      'pnpm check:registry',
      'pnpm check:cli-init',
      'pnpm check:cli-add',
      'pnpm check:showcase-registry',
      'pnpm showcase:registry:check',
      'Phase 21: Add native showcase for @zeus-web/ui.',
    ],
  },
]

const forbiddenDocsPatterns = [
  {
    pattern: 'Delete headless primitives',
    message: 'docs must not suggest deleting headless primitives',
  },
  {
    pattern: 'Primitive packages own final product styles',
    message: 'primitive packages must not own final product styles',
  },
  {
    pattern: 'React users should import primitive wrappers by default',
    message:
      'React default usage must be CLI registry output, not primitive wrappers',
  },
  {
    pattern: 'Vue users should import primitive wrappers by default',
    message:
      'Vue default usage must be CLI registry output, not primitive wrappers',
  },
]

function filePath(relativePath: string): string {
  return resolve(root, relativePath)
}

function readRequiredFile(
  relativePath: string,
  errors: string[],
): string | null {
  const absolutePath = filePath(relativePath)

  if (!existsSync(absolutePath)) {
    errors.push(`Missing required product layer document: ${relativePath}`)
    return null
  }

  return readFileSync(absolutePath, 'utf-8')
}

function checkMustContain(doc: RequiredDoc, source: string): string[] {
  const errors: string[] = []

  for (const text of doc.mustContain) {
    if (!source.includes(text)) {
      errors.push(`${doc.path} must contain "${text}"`)
    }
  }

  return errors
}

function checkForbiddenPatterns(path: string, source: string): string[] {
  const errors: string[] = []

  for (const item of forbiddenDocsPatterns) {
    if (source.includes(item.pattern)) {
      errors.push(`${path}: ${item.message}`)
    }
  }

  return errors
}

function checkPhaseOrder(source: string): string[] {
  const errors: string[] = []
  const phase15Index = source.indexOf('| Phase 15 |')
  const phase16Index = source.indexOf('| Phase 16 |')
  const phase17Index = source.indexOf('| Phase 17 |')
  const phase18Index = source.indexOf('| Phase 18 |')
  const phase19Index = source.indexOf('| Phase 19 |')
  const phase20Index = source.indexOf('| Phase 20 |')
  const phase21Index = source.indexOf('Phase 21:')

  if (phase15Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 15 status row')
  }

  if (phase16Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 16 status row')
  }

  if (phase17Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 17 status row')
  }

  if (phase18Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 18 status row')
  }

  if (phase19Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 19 status row')
  }

  if (phase20Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 20 status row')
  }

  if (phase21Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 21 next work')
  }

  if (phase15Index >= 0 && phase16Index >= 0 && phase16Index < phase15Index) {
    errors.push('Phase 16 status must appear after Phase 15 status')
  }

  if (phase16Index >= 0 && phase17Index >= 0 && phase17Index < phase16Index) {
    errors.push('Phase 17 status must appear after Phase 16 status')
  }

  if (phase17Index >= 0 && phase18Index >= 0 && phase18Index < phase17Index) {
    errors.push('Phase 18 status must appear after Phase 17 status')
  }

  if (phase18Index >= 0 && phase19Index >= 0 && phase19Index < phase18Index) {
    errors.push('Phase 19 status must appear after Phase 18 status')
  }

  if (phase19Index >= 0 && phase20Index >= 0 && phase20Index < phase19Index) {
    errors.push('Phase 20 status must appear after Phase 19 status')
  }

  if (phase20Index >= 0 && phase21Index >= 0 && phase21Index < phase20Index) {
    errors.push('Phase 21 next work must appear after Phase 20 status')
  }

  return errors
}

function main(): void {
  const errors: string[] = []

  for (const doc of docs) {
    const source = readRequiredFile(doc.path, errors)
    if (!source) continue

    errors.push(...checkMustContain(doc, source))
    errors.push(...checkForbiddenPatterns(doc.path, source))

    if (doc.path === 'docs/internal/examples/showcase-roadmap.md') {
      errors.push(...checkPhaseOrder(source))
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('Product layer contract check failed:'))
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
  }

  console.log(pc.green('Product layer contract check passed.'))
}

main()
