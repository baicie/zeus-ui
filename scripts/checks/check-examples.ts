import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

interface RequiredFile {
  path: string
  mustContain: string[]
  mustNotContain?: string[]
}

const root = process.cwd()

const requiredFiles: RequiredFile[] = [
  {
    path: 'examples/next-app/package.json',
    mustContain: ['@zeus-web/example-next-app', '"next"', '@zeus-web/button'],
  },
  {
    path: 'examples/next-app/components.json',
    mustContain: ['"ui": "@/components/ui"', '"lib": "@/lib"'],
  },
  {
    path: 'examples/next-app/next.config.ts',
    mustContain: [
      'transpilePackages',
      '@zeus-web/button',
      '@zeus-web/checkbox',
      '@zeus-web/dialog',
      '@zeus-web/input',
      '@zeus-web/switch',
      '@zeus-web/tabs',
      '@zeus-web/themes',
    ],
  },
  {
    path: 'examples/next-app/src/app/layout.tsx',
    mustContain: ["import '@zeus-web/themes/default.css'"],
  },
  {
    path: 'examples/next-app/src/app/page.tsx',
    mustContain: ["import { Demo } from '@/components/demo'"],
  },
  {
    path: 'examples/next-app/src/components/demo.tsx',
    mustContain: [
      "'use client'",
      "from '@/components/ui/button'",
      "from '@/components/ui/checkbox'",
      "from '@/components/ui/dialog'",
      "from '@/components/ui/input'",
      "from '@/components/ui/switch'",
      "from '@/components/ui/tabs'",
    ],
  },
  {
    path: 'examples/next-app/src/components/ui/button.tsx',
    mustContain: ["'use client'", '@zeus-web/button/react'],
    mustNotContain: ['customElements.define', '@zeus-web/react'],
  },
  {
    path: 'examples/next-app/src/components/ui/input.tsx',
    mustContain: ["'use client'", '@zeus-web/input/react'],
    mustNotContain: ['customElements.define', '@zeus-web/react'],
  },
  {
    path: 'examples/next-app/src/components/ui/checkbox.tsx',
    mustContain: ["'use client'", '@zeus-web/checkbox/react'],
    mustNotContain: ['customElements.define', '@zeus-web/react'],
  },
  {
    path: 'examples/next-app/src/components/ui/switch.tsx',
    mustContain: ["'use client'", '@zeus-web/switch/react'],
    mustNotContain: ['customElements.define', '@zeus-web/react'],
  },
  {
    path: 'examples/next-app/src/components/ui/tabs.tsx',
    mustContain: ["'use client'", '@zeus-web/tabs/react'],
    mustNotContain: ['customElements.define', '@zeus-web/react'],
  },
  {
    path: 'examples/next-app/src/components/ui/dialog.tsx',
    mustContain: ["'use client'", '@zeus-web/dialog/react'],
    mustNotContain: ['customElements.define', '@zeus-web/react'],
  },
  {
    path: 'apps/docs/examples/next-app.md',
    mustContain: [
      '# Next.js App Router Example',
      '@zeus-web/example-next-app',
      '@zeus-web/button/react',
      "'use client'",
    ],
  },
]

function checkFile(file: RequiredFile): string[] {
  const absolutePath = resolve(root, file.path)

  if (!existsSync(absolutePath)) {
    return [`Missing example file: ${file.path}`]
  }

  const source = readFileSync(absolutePath, 'utf-8')
  const errors: string[] = []

  for (const text of file.mustContain) {
    if (!source.includes(text)) {
      errors.push(`${file.path} must contain "${text}"`)
    }
  }

  for (const text of file.mustNotContain ?? []) {
    if (source.includes(text)) {
      errors.push(`${file.path} must not contain "${text}"`)
    }
  }

  return errors
}

function main(): void {
  const errors = requiredFiles.flatMap(checkFile)

  if (errors.length > 0) {
    console.error(pc.red('Examples contract check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Examples contract check passed.'))
}

main()
