import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'packages/registry/registry.json',
  'packages/registry/templates/native/chat.ts',
  'packages/registry/templates/react/chat.tsx',
  'packages/registry/templates/vue/chat.vue',
  'packages/registry/package.json',
  'packages/ai/src/metadata.ts',
  'packages/ai/src/validate.ts',
  'packages/ai/src/types.ts',
  'packages/ai/__tests__/chat-ai-metadata.spec.ts',
  'packages/registry/__tests__/registry-package.spec.ts',
]

const forbiddenPatterns = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'apiKey',
  'Authorization',
  'Bearer ',
  'fetch(',
  'XMLHttpRequest',
  'EventSource',
  'WebSocket',
  'marked',
  'markdown-it',
  'highlight.js',
  'shiki',
  'prismjs',
]

const chatTemplatePaths = [
  'packages/registry/templates/native/chat.ts',
  'packages/registry/templates/react/chat.tsx',
  'packages/registry/templates/vue/chat.vue',
]

function readText(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function assertFileExists(path: string, errors: string[]): void {
  if (!existsSync(resolve(root, path))) {
    errors.push(`Missing required file: ${path}`)
  }
}

function mustContain(path: string, contents: string[], errors: string[]): void {
  const source = readText(path)

  for (const content of contents) {
    if (!source.includes(content)) {
      errors.push(`${path} must contain ${JSON.stringify(content)}`)
    }
  }
}

function mustNotContain(
  path: string,
  contents: string[],
  errors: string[],
): void {
  const source = readText(path)

  for (const content of contents) {
    if (source.includes(content)) {
      errors.push(`${path} must not contain ${JSON.stringify(content)}`)
    }
  }
}

function checkFiles(errors: string[]): void {
  for (const file of requiredFiles) {
    assertFileExists(file, errors)
  }
}

function checkRegistry(errors: string[]): void {
  const registry = readText('packages/registry/registry.json')

  if (!registry.includes('"name": "chat"')) {
    errors.push('packages/registry/registry.json must contain "name": "chat"')
  }

  if (!registry.includes('@zeus-web/chat')) {
    errors.push('packages/registry/registry.json must reference @zeus-web/chat')
  }

  mustContain(
    'packages/registry/registry.json',
    [
      '"native"',
      '"react"',
      '"vue"',
      'templates/native/chat.ts',
      'templates/react/chat.tsx',
      'templates/vue/chat.vue',
    ],
    errors,
  )

  mustContain(
    'packages/registry/package.json',
    [
      './templates/native/chat.ts',
      './templates/react/chat.tsx',
      './templates/vue/chat.vue',
    ],
    errors,
  )
}

function checkAiMetadata(errors: string[]): void {
  mustContain(
    'packages/ai/src/metadata.ts',
    [
      "name: 'chat'",
      "packageName: '@zeus-web/chat'",
      "category: 'advanced'",
      'advancedComponents',
      '不要把它当作模型请求库',
      '业务请求逻辑应该放在应用层',
    ],
    errors,
  )

  mustContain(
    'packages/ai/src/validate.ts',
    ['advancedComponents', "category must be 'advanced'"],
    errors,
  )

  mustContain(
    'packages/ai/src/types.ts',
    ['ZeusWebAiAdvancedComponent', "category: 'advanced'"],
    errors,
  )
}

function checkTemplates(errors: string[]): void {
  mustContain(
    'packages/registry/templates/native/chat.ts',
    [
      '@zeus-web/chat/wc/auto',
      'zw-chat',
      'zw-chat-thread',
      'zw-chat-message',
      'zw-chat-composer',
    ],
    errors,
  )

  mustContain(
    'packages/registry/templates/react/chat.tsx',
    ['@zeus-web/chat/react', "import { cn } from '@/lib/cn'"],
    errors,
  )

  mustContain(
    'packages/registry/templates/vue/chat.vue',
    ['@zeus-web/chat/vue', "import { cn } from '@/lib/cn'"],
    errors,
  )
}

function checkForbiddenLogic(errors: string[]): void {
  for (const file of [...chatTemplatePaths, 'packages/ai/src/metadata.ts']) {
    if (!existsSync(resolve(root, file))) continue

    mustNotContain(file, forbiddenPatterns, errors)
  }
}

function main(): void {
  const errors: string[] = []

  checkFiles(errors)

  if (errors.length === 0) {
    checkRegistry(errors)
    checkAiMetadata(errors)
    checkTemplates(errors)
    checkForbiddenLogic(errors)
  }

  if (errors.length > 0) {
    console.error(pc.red('Chat product contract check failed:'))

    for (const error of errors) {
      console.error(`  ${pc.red('✘')} ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Chat product contract looks good.'))
}

main()
