import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

interface RegistryFile {
  framework: string
  source: string
  target: string
}

interface RegistryItem {
  name: string
  type: string
  frameworks: string[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

interface RegistryManifest {
  schemaVersion: number
  name: string
  items: RegistryItem[]
}

const root = process.cwd()

const requiredFiles = [
  'packages/registry/registry.json',
  'packages/registry/templates/native/chat.ts',
  'packages/registry/templates/react/chat.tsx',
  'packages/registry/templates/vue/chat.vue',
  'packages/registry/package.json',
  'packages/registry/__tests__/registry-package.spec.ts',
  'packages/ai/src/metadata.ts',
  'packages/ai/src/render.ts',
  'packages/ai/src/validate.ts',
  'packages/ai/src/types.ts',
  'packages/ai/__tests__/ai.spec.ts',
  'packages/ai/__tests__/chat-ai-metadata.spec.ts',
  'scripts/checks/contract/__tests__/check-chat-product-contract.spec.ts',
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

const chatProductFiles = [
  'packages/registry/templates/native/chat.ts',
  'packages/registry/templates/react/chat.tsx',
  'packages/registry/templates/vue/chat.vue',
]

const nativeTemplatePath = 'packages/registry/templates/native/chat.ts'

const nativeTemplateForbiddenWrappers = ['String.raw', 'chatNativeSource']

const nativeTemplateMustContain = [
  "import '@zeus-web/chat/wc/auto'",
  "from '@zeus-web/chat'",
  'mountChatDemo',
  'zw-chat',
  'zw-chat-thread',
  'zw-chat-message',
  'zw-chat-composer',
  'scrollToBottom',
]

function readText(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T
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

function findChatItem(registry: RegistryManifest): RegistryItem | undefined {
  return registry.items.find(item => item.name === 'chat')
}

function checkFiles(errors: string[]): void {
  for (const file of requiredFiles) {
    assertFileExists(file, errors)
  }
}

function checkRegistry(errors: string[]): void {
  const registry = readJson<RegistryManifest>('packages/registry/registry.json')
  const chat = findChatItem(registry)

  if (!chat) {
    errors.push('packages/registry/registry.json must contain chat item')
    return
  }

  if (chat.type !== 'component') {
    errors.push('chat registry item type must be component')
  }

  for (const framework of ['native', 'react', 'vue']) {
    if (!chat.frameworks.includes(framework)) {
      errors.push(`chat registry item must support ${framework}`)
    }
  }

  if (!chat.dependencies.includes('@zeus-web/chat')) {
    errors.push('chat registry item must depend on @zeus-web/chat')
  }

  for (const dependency of ['cn', 'globals']) {
    if (!chat.registryDependencies.includes(dependency)) {
      errors.push(
        `chat registry item must depend on registry item ${dependency}`,
      )
    }
  }

  const requiredFilesByFramework: RegistryFile[] = [
    {
      framework: 'native',
      source: 'templates/native/chat.ts',
      target: 'components/chat.ts',
    },
    {
      framework: 'react',
      source: 'templates/react/chat.tsx',
      target: 'components/ui/chat.tsx',
    },
    {
      framework: 'vue',
      source: 'templates/vue/chat.vue',
      target: 'components/ui/chat.vue',
    },
  ]

  for (const expected of requiredFilesByFramework) {
    const matched = chat.files.some(
      file =>
        file.framework === expected.framework &&
        file.source === expected.source &&
        file.target === expected.target,
    )

    if (!matched) {
      errors.push(
        `chat registry item must include ${expected.framework} template ${expected.source} -> ${expected.target}`,
      )
    }
  }

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
      'zw-chat',
      'zw-chat-thread',
      'zw-chat-message',
      'zw-chat-composer',
      'zw-chat-code-block',
      'zw-chat-tool-call',
      'zw-chat-artifact',
      'zw-chat-typing',
      '不要把它当作模型请求库',
      '业务请求逻辑应该放在应用层',
    ],
    errors,
  )

  mustContain(
    'packages/ai/src/render.ts',
    ['renderAdvancedComponent', '# Advanced components'],
    errors,
  )

  mustContain(
    'packages/ai/src/validate.ts',
    [
      'advancedComponents',
      "category must be 'advanced'",
      '不要把它当作模型请求库',
      '业务请求逻辑应该放在应用层',
    ],
    errors,
  )

  mustContain(
    'packages/ai/src/types.ts',
    ['ZeusWebAiAdvancedComponent', "category: 'advanced'", "'chat'"],
    errors,
  )
}

function checkTemplates(errors: string[]): void {
  mustContain(nativeTemplatePath, nativeTemplateMustContain, errors)

  mustNotContain(nativeTemplatePath, nativeTemplateForbiddenWrappers, errors)

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
  for (const file of chatProductFiles) {
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
