import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

import { aiMetadata } from '../src'

const workspaceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
)
const sourceContracts = new Map<string, ReturnType<typeof analyzeFile>>()
const publicEvents = aiMetadata.components.flatMap(component =>
  component.events.map(event => ({ component: component.name, event })),
)

function getSourceContract(component: string) {
  let contract = sourceContracts.get(component)
  if (!contract) {
    const file = resolve(
      workspaceRoot,
      `packages/primitives/${component}/src/${component}.tsx`,
    )
    // Use the installed Analyzer so an outdated registry package fails this contract.
    contract = analyzeFile({ file, code: readFileSync(file, 'utf8') })
    sourceContracts.set(component, contract)
  }
  return contract
}

describe('ai event optionality matches component source', () => {
  it.each(publicEvents)(
    '$component $event.name preserves required and optional fields',
    ({ component, event }) => {
      const contract = getSourceContract(component)
      expect(contract.diagnostics).toEqual([])
      const tag = `zw-${component}`
      expect(contract.components.some(record => record.tag === tag)).toBe(true)

      // Compound families such as Avatar document events from their child elements.
      const matches = contract.components
        .filter(
          record => record.tag === tag || record.tag.startsWith(`${tag}-`),
        )
        .flatMap(record => Object.values(record.events))
        .filter(record => record.name === event.name)
      expect(matches).toHaveLength(1)
      const sourceEvent = matches[0]
      expect(Object.keys(sourceEvent.detail ?? {}).sort()).toEqual(
        Object.keys(event.detail).sort(),
      )

      const sourceOptional =
        (sourceEvent as { detailOptional?: string[] }).detailOptional ?? []
      const documentedOptional = event.detailOptional ?? []
      expect([...sourceOptional].sort()).toEqual([...documentedOptional].sort())

      const requiredSourceFields = Object.keys(sourceEvent.detail ?? {}).filter(
        name => !sourceOptional.includes(name),
      )
      const requiredDocumentedFields = Object.keys(event.detail).filter(
        name => !documentedOptional.includes(name),
      )
      expect(requiredSourceFields.sort()).toEqual(
        requiredDocumentedFields.sort(),
      )
    },
  )
})
