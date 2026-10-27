import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import * as api from '../src'

const SRC_ROOT = join(process.cwd(), 'packages/ai-core/src')

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap(entry => {
    const fullPath = join(directory, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) return listSourceFiles(fullPath)
    if (entry.endsWith('.ts')) return [fullPath]

    return []
  })
}

describe('pure Node environment (AI2-101)', () => {
  it('imports only relative modules from source', () => {
    const offenders: string[] = []

    for (const file of listSourceFiles(SRC_ROOT)) {
      const text = readFileSync(file, 'utf8')
      const matches = text.matchAll(/from\s+['"]([^'"]+)['"]/g)

      for (const match of matches) {
        const specifier = match[1]
        if (!specifier.startsWith('.'))
          offenders.push(`${file} -> ${specifier}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('does not reference DOM globals in source', () => {
    const offenders: string[] = []

    for (const file of listSourceFiles(SRC_ROOT)) {
      const text = readFileSync(file, 'utf8')

      for (const pattern of [/\bdocument\./, /\bwindow\./, /\bHTMLElement\b/]) {
        if (pattern.test(text)) offenders.push(`${file} -> ${String(pattern)}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('declares no runtime dependencies', () => {
    const packageJson = JSON.parse(
      readFileSync(
        join(process.cwd(), 'packages/ai-core/package.json'),
        'utf8',
      ),
    ) as Record<string, unknown>

    expect(packageJson.dependencies).toBeUndefined()
    expect(packageJson.peerDependencies).toBeUndefined()
    expect(packageJson.type).toBe('module')
  })

  it('exports the domain, protocol, store and host surface', () => {
    expect(typeof api.createAiStore).toBe('function')
    expect(typeof api.createCommand).toBe('function')
    expect(typeof api.validateDomainEvent).toBe('function')
    expect(typeof api.reduceEvent).toBe('function')
    expect(typeof api.createMockHost).toBe('function')
    expect(typeof api.createReplayHost).toBe('function')
    expect(typeof api.createS1ChatScenario).toBe('function')
    expect(api.DOMAIN_EVENT_SCHEMA_VERSION).toBe(2)
    expect(api.COMMAND_SCHEMA_VERSION).toBe(2)
  })
})
