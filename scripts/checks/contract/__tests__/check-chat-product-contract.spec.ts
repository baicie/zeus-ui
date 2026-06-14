import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('chat product contract files', () => {
  it('registry declares chat with native/react/vue templates', () => {
    const registry = read('packages/registry/registry.json')

    expect(registry).toContain('"name": "chat"')
    expect(registry).toContain('@zeus-web/chat')
    expect(registry).toContain('"native"')
    expect(registry).toContain('"react"')
    expect(registry).toContain('"vue"')
    expect(registry).toContain('templates/native/chat.ts')
    expect(registry).toContain('templates/react/chat.tsx')
    expect(registry).toContain('templates/vue/chat.vue')
  })

  it('registry package.json exports chat templates', () => {
    const packageJson = read('packages/registry/package.json')

    expect(packageJson).toContain('./templates/native/chat.ts')
    expect(packageJson).toContain('./templates/react/chat.tsx')
    expect(packageJson).toContain('./templates/vue/chat.vue')
  })

  it('ai metadata registers chat under advancedComponents', () => {
    const source = read('packages/ai/src/metadata.ts')

    expect(source).toContain("name: 'chat'")
    expect(source).toContain("packageName: '@zeus-web/chat'")
    expect(source).toContain("category: 'advanced'")
    expect(source).toContain('advancedComponents')
    expect(source).toContain('不要把它当作模型请求库')
    expect(source).toContain('业务请求逻辑应该放在应用层')
  })

  it('ai validator enforces advanced component rules', () => {
    const source = read('packages/ai/src/validate.ts')

    expect(source).toContain('advancedComponents')
    expect(source).toContain("category must be 'advanced'")
    expect(source).toContain('不要把它当作模型请求库')
    expect(source).toContain('业务请求逻辑应该放在应用层')
  })

  it('ai types define ZeusWebAiAdvancedComponent', () => {
    const source = read('packages/ai/src/types.ts')

    expect(source).toContain('ZeusWebAiAdvancedComponent')
    expect(source).toContain("category: 'advanced'")
    expect(source).toContain("| 'chat'")
  })

  it('native template uses auto entry and zw-chat components', () => {
    const source = read('packages/registry/templates/native/chat.ts')

    expect(source).toContain('@zeus-web/chat/wc/auto')
    expect(source).toContain('zw-chat')
    expect(source).toContain('zw-chat-thread')
    expect(source).toContain('zw-chat-message')
    expect(source).toContain('zw-chat-composer')
  })

  it('react template uses React wrapper and cn utility', () => {
    const source = read('packages/registry/templates/react/chat.tsx')

    expect(source).toContain('@zeus-web/chat/react')
    expect(source).toContain("import { cn } from '@/lib/cn'")
  })

  it('vue template uses Vue wrapper and cn utility', () => {
    const source = read('packages/registry/templates/vue/chat.vue')

    expect(source).toContain('@zeus-web/chat/vue')
    expect(source).toContain("import { cn } from '@/lib/cn'")
  })

  it('forbids provider request logic in chat product assets', () => {
    const sources = [
      read('packages/registry/templates/native/chat.ts'),
      read('packages/registry/templates/react/chat.tsx'),
      read('packages/registry/templates/vue/chat.vue'),
      read('packages/ai/src/metadata.ts'),
    ].join('\n')

    expect(sources).not.toContain('OPENAI_API_KEY')
    expect(sources).not.toContain('ANTHROPIC_API_KEY')
    expect(sources).not.toContain('DEEPSEEK_API_KEY')
    expect(sources).not.toContain('Authorization')
    expect(sources).not.toContain('Bearer ')
    expect(sources).not.toContain('fetch(')
    expect(sources).not.toContain('apiKey')
  })
})
