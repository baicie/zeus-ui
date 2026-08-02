import { describe, expect, it } from 'vitest'

import {
  createBrowserEntry,
  createConsumerPackageJson,
  getPublishedMetadataProblems,
} from '../release/check-published-packages'

describe('published package smoke check', () => {
  it('installs every published package at the exact release version', () => {
    const packageJson = createConsumerPackageJson(
      ['@zeus-web/button', '@zeus-web/zeus-compat'],
      '0.1.0-beta.1',
    )

    expect(packageJson).toMatchObject({
      private: true,
      dependencies: {
        '@zeus-web/button': '0.1.0-beta.1',
        '@zeus-web/zeus-compat': '0.1.0-beta.1',
        react: '^19.1.1',
        'react-dom': '^19.1.1',
        vue: '^3.5.18',
      },
      devDependencies: {
        '@types/react': '^19.1.9',
        '@types/react-dom': '^19.1.7',
        typescript: '^6.0.3',
        vite: '^8.0.16',
      },
    })
  })

  it('accepts matching dist-tags and SLSA provenance', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': {
          distTags: {
            beta: '0.1.0-beta.1',
          },
          provenancePredicateType: 'https://slsa.dev/provenance/v1',
          versions: ['0.1.0-beta.1'],
        },
      },
    )

    expect(problems).toEqual([])
  })

  it('rejects missing versions, mismatched tags and missing provenance', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': {
          distTags: {
            beta: '0.1.0-beta.0',
          },
          versions: ['0.1.0-beta.0'],
        },
      },
    )

    expect(problems).toEqual([
      '@zeus-web/button: version 0.1.0-beta.1 is unavailable',
      '@zeus-web/button: dist-tag beta points to 0.1.0-beta.0',
      '@zeus-web/button: SLSA provenance is unavailable',
    ])
  })

  it('bundles browser packages without importing the CLI entry', () => {
    const source = createBrowserEntry(
      ['@zeus-web/button', '@zeus-web/cli', '@zeus-web/zeus-compat'],
      ['@zeus-web/button'],
    )

    expect(source).toContain("from '@zeus-web/button'")
    expect(source).toContain("from '@zeus-web/button/react'")
    expect(source).toContain("from '@zeus-web/button/vue'")
    expect(source).toContain("from '@zeus-web/zeus-compat'")
    expect(source).not.toContain("from '@zeus-web/cli'")
    expect(source).not.toContain("from '@zeus-web/zeus-compat/react'")
    expect(source).not.toContain("from '@zeus-web/zeus-compat/vue'")
  })
})
