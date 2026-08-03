import { Buffer } from 'node:buffer'

import { describe, expect, it } from 'vitest'

import {
  createBrowserEntry,
  createConsumerPackageJson,
  fetchPublishedPackageMetadata,
  getPublishedMetadataProblems,
  parsePublishedPackageOptions,
  parseRegistryPackageMetadata,
  parseSlsaProvenanceBundle,
} from '../release/check-published-packages'

const RELEASE_SHA = '3a37683c855455d9a980609f9d7c54152d00b561'
const PACKAGE_DIGEST =
  'd6f63c755ed812a619ffcea7249dcd78c46241272684a3023415751be8237768794b0df419b0bb46de04c0e28ff17e5b52991508d6fb464ca52cd38654e0a9e5'

interface ProvenanceFixtureOptions {
  integrity?: string
  latest?: string
  path?: string
  ref?: string
  releaseSha?: string
  repository?: string
  subjectDigest?: string
  subjectName?: string
  splitResolvedDependency?: boolean
  uri?: string
  version?: string
}

function createPublishedMetadata(options: ProvenanceFixtureOptions = {}) {
  const version = options.version || '0.1.0-beta.1'
  const releaseSha = options.releaseSha || RELEASE_SHA
  const releaseRef = `refs/tags/v${version}`
  const workflowRef = options.ref || releaseRef
  const sourceUri =
    options.uri || `git+https://github.com/baicie/zeus-ui@${releaseRef}`
  const resolvedDependencies = options.splitResolvedDependency
    ? [
        {
          digest: {
            gitCommit: '0000000000000000000000000000000000000000',
          },
          uri: sourceUri,
        },
        {
          digest: {
            gitCommit: releaseSha,
          },
          uri: 'git+https://github.com/example/zeus-ui@refs/tags/v0.1.0-beta.1',
        },
      ]
    : [
        {
          digest: {
            gitCommit: releaseSha,
          },
          uri: sourceUri,
        },
      ]

  return {
    distTags: {
      beta: version,
      latest: options.latest || '0.1.0-beta.0',
    },
    integrity:
      options.integrity ||
      'sha512-1vY8dV7YEqYZ/86nJJ3NeMRiQScmhKMCNBV1G+gjd2h5Sw30GbC7Rt4EwOKP8X5bUpkVCNb7RkylLNOGVOCp5Q==',
    provenancePredicateType: 'https://slsa.dev/provenance/v1',
    provenanceStatement: {
      predicateType: 'https://slsa.dev/provenance/v1',
      subject: [
        {
          digest: {
            sha512: options.subjectDigest || PACKAGE_DIGEST,
          },
          name: options.subjectName || `pkg:npm/%40zeus-web/button@${version}`,
        },
      ],
      predicate: {
        buildDefinition: {
          externalParameters: {
            workflow: {
              path: options.path || '.github/workflows/publish.yml',
              ref: workflowRef,
              repository:
                options.repository || 'https://github.com/baicie/zeus-ui',
            },
          },
          resolvedDependencies,
        },
      },
    },
    versions: [version],
  }
}

function createSlsaAttestation(statement: unknown) {
  return {
    bundle: {
      dsseEnvelope: {
        payload: Buffer.from(JSON.stringify(statement)).toString('base64'),
        payloadType: 'application/vnd.in-toto+json',
      },
    },
    predicateType: 'https://slsa.dev/provenance/v1',
  }
}

describe('published package smoke check', () => {
  it('requires an immutable release SHA', () => {
    expect(() =>
      parsePublishedPackageOptions([
        '--version',
        '0.1.0-beta.2',
        '--tag',
        'beta',
        '--expected-latest',
        '0.1.0-beta.0',
      ]),
    ).toThrow('Expected --release-sha with a 40-character commit SHA')
  })

  it('decodes the SLSA statement when publish attestation comes first', () => {
    const statement = createPublishedMetadata().provenanceStatement
    const bundle = {
      attestations: [
        {
          predicateType:
            'https://github.com/npm/attestation/tree/main/specs/publish/v0.1',
        },
        createSlsaAttestation(statement),
      ],
    }

    expect(parseSlsaProvenanceBundle(bundle)).toEqual(statement)
  })

  it('rejects a bundle with multiple SLSA statements', () => {
    const statement = createPublishedMetadata().provenanceStatement
    const bundle = {
      attestations: [
        createSlsaAttestation(statement),
        createSlsaAttestation(statement),
      ],
    }

    expect(parseSlsaProvenanceBundle(bundle)).toBeUndefined()
  })

  it('extracts the attestation contract from npm package metadata', () => {
    const metadata = parseRegistryPackageMetadata(
      {
        'dist-tags': {
          beta: '0.1.0-beta.1',
          latest: '0.1.0-beta.0',
        },
        versions: {
          '0.1.0-beta.1': {
            dist: {
              attestations: {
                provenance: {
                  predicateType: 'https://slsa.dev/provenance/v1',
                },
                url: 'https://registry.npmjs.org/-/npm/v1/attestations/@zeus-web%2fbutton@0.1.0-beta.1',
              },
              integrity:
                'sha512-1vY8dV7YEqYZ/86nJJ3NeMRiQScmhKMCNBV1G+gjd2h5Sw30GbC7Rt4EwOKP8X5bUpkVCNb7RkylLNOGVOCp5Q==',
            },
          },
        },
      },
      '0.1.0-beta.1',
    )

    expect(metadata).toEqual({
      attestationUrl:
        'https://registry.npmjs.org/-/npm/v1/attestations/@zeus-web%2fbutton@0.1.0-beta.1',
      distTags: {
        beta: '0.1.0-beta.1',
        latest: '0.1.0-beta.0',
      },
      integrity:
        'sha512-1vY8dV7YEqYZ/86nJJ3NeMRiQScmhKMCNBV1G+gjd2h5Sw30GbC7Rt4EwOKP8X5bUpkVCNb7RkylLNOGVOCp5Q==',
      provenancePredicateType: 'https://slsa.dev/provenance/v1',
      versions: ['0.1.0-beta.1'],
    })
  })

  it('loads the decoded statement from the npm attestation URL', () => {
    const statement = createPublishedMetadata().provenanceStatement
    const attestationUrl =
      'https://registry.npmjs.org/-/npm/v1/attestations/@zeus-web%2fbutton@0.1.0-beta.1'
    const packageMetadata = {
      'dist-tags': {
        beta: '0.1.0-beta.1',
        latest: '0.1.0-beta.0',
      },
      versions: {
        '0.1.0-beta.1': {
          dist: {
            attestations: {
              provenance: {
                predicateType: 'https://slsa.dev/provenance/v1',
              },
              url: attestationUrl,
            },
            integrity:
              'sha512-1vY8dV7YEqYZ/86nJJ3NeMRiQScmhKMCNBV1G+gjd2h5Sw30GbC7Rt4EwOKP8X5bUpkVCNb7RkylLNOGVOCp5Q==',
          },
        },
      },
    }
    const attestationBundle = {
      attestations: [
        {
          predicateType:
            'https://github.com/npm/attestation/tree/main/specs/publish/v0.1',
        },
        createSlsaAttestation(statement),
      ],
    }
    const requests: string[] = []

    return fetchPublishedPackageMetadata(
      '@zeus-web/button',
      '0.1.0-beta.1',
      'https://registry.npmjs.org/',
      url => {
        const value =
          url === attestationUrl ? attestationBundle : packageMetadata

        requests.push(url)

        return Promise.resolve({
          json: () => Promise.resolve(value),
          ok: true,
          status: 200,
        })
      },
    ).then(metadata => {
      expect(requests).toEqual([
        'https://registry.npmjs.org/%40zeus-web%2Fbutton',
        attestationUrl,
      ])
      expect(metadata.provenanceStatement).toEqual(statement)
    })
  })

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

  it('accepts matching dist-tags and release-bound SLSA provenance', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata(),
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([])
  })

  it('rejects a provenance summary without a decoded statement', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': {
          distTags: {
            beta: '0.1.0-beta.1',
            latest: '0.1.0-beta.0',
          },
          provenancePredicateType: 'https://slsa.dev/provenance/v1',
          versions: ['0.1.0-beta.1'],
        },
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      '@zeus-web/button: SLSA provenance is unavailable',
    ])
  })

  it('rejects a beta release that moves the latest dist-tag', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.2',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          latest: '0.1.0-beta.2',
          version: '0.1.0-beta.2',
        }),
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      '@zeus-web/button: dist-tag latest points to 0.1.0-beta.2',
    ])
  })

  it('rejects provenance from a different release commit', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          releaseSha: '0000000000000000000000000000000000000000',
        }),
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      `@zeus-web/button: SLSA provenance release commit does not match ${RELEASE_SHA}`,
    ])
  })

  it('rejects provenance from a different workflow repository', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          repository: 'https://github.com/example/zeus-ui',
        }),
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      '@zeus-web/button: SLSA provenance workflow repository does not match https://github.com/baicie/zeus-ui',
    ])
  })

  it('rejects provenance from a different release tag', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          ref: 'refs/tags/v0.1.0-beta.0',
        }),
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      '@zeus-web/button: SLSA provenance workflow ref does not match refs/tags/v0.1.0-beta.1',
    ])
  })

  it('rejects provenance from a different workflow path', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          path: '.github/workflows/release.yml',
        }),
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      '@zeus-web/button: SLSA provenance workflow path does not match .github/workflows/publish.yml',
    ])
  })

  it('rejects provenance for a different package digest', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          subjectDigest: '0'.repeat(128),
        }),
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      '@zeus-web/button: SLSA provenance subject does not match pkg:npm/%40zeus-web/button@0.1.0-beta.1 and its sha512 digest',
    ])
  })

  it('rejects a sha512 integrity value with the wrong digest length', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          integrity: 'sha512-YQ==',
          subjectDigest: '61',
        }),
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      '@zeus-web/button: SLSA provenance subject does not match pkg:npm/%40zeus-web/button@0.1.0-beta.1 and its sha512 digest',
    ])
  })

  it('rejects provenance for a different package subject', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          subjectName: 'pkg:npm/%40zeus-web/input@0.1.0-beta.1',
        }),
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      '@zeus-web/button: SLSA provenance subject does not match pkg:npm/%40zeus-web/button@0.1.0-beta.1 and its sha512 digest',
    ])
  })

  it('rejects provenance resolved from a different release source', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          uri: 'git+https://github.com/example/zeus-ui@refs/tags/v0.1.0-beta.1',
        }),
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      '@zeus-web/button: SLSA provenance source does not match git+https://github.com/baicie/zeus-ui@refs/tags/v0.1.0-beta.1',
    ])
  })

  it('requires the release source and commit on the same dependency', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          splitResolvedDependency: true,
        }),
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      `@zeus-web/button: SLSA provenance release commit does not match ${RELEASE_SHA}`,
    ])
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
            latest: '0.1.0-beta.0',
          },
          versions: ['0.1.0-beta.0'],
        },
      },
      '0.1.0-beta.0',
      RELEASE_SHA,
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
