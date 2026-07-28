import {
  createComponentDocsContext,
  generateComponentDocs,
} from '../../docs/component-docs'
import { checkDocsI18nContract } from '../docs/i18n-contract'

describe('docs i18n contract', () => {
  it('keeps English at the root and generates matching Chinese pages', () => {
    const result = checkDocsI18nContract()

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.generatedDocCount).toBe(52)
  })

  it('rejects Chinese prose in the default English component docs', () => {
    const docs = generateComponentDocs(createComponentDocsContext())
    const invalidDocs = docs.map(doc => {
      if (doc.path !== 'apps/docs/components/button.md') return doc

      return {
        path: doc.path,
        content: `${doc.content}\n默认语言泄漏\n`,
      }
    })
    const result = checkDocsI18nContract(process.cwd(), invalidDocs)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'apps/docs/components/button.md must be English-only.',
    )
  })

  it('rejects a missing Chinese component page', () => {
    const docs = generateComponentDocs(createComponentDocsContext()).filter(
      doc => doc.path !== 'apps/docs/zh/components/button.md',
    )
    const result = checkDocsI18nContract(process.cwd(), docs)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Missing localized generated doc "apps/docs/zh/components/button.md".',
    )
  })

  it('rejects English enum labels in Chinese component docs', () => {
    const docs = generateComponentDocs(createComponentDocsContext())
    const invalidDocs = docs.map(doc => {
      if (doc.path !== 'apps/docs/zh/components/button.md') return doc

      return {
        path: doc.path,
        content: doc.content.replace('<br />可选值:', '<br />Values:'),
      }
    })
    const result = checkDocsI18nContract(process.cwd(), invalidDocs)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'apps/docs/zh/components/button.md must localize enum value labels.',
    )
  })
})
