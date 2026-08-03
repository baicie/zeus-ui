import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  parseCapturePublishedLatestOptions,
  runCapturePublishedLatest,
  writePublishedPackageLatestBaseline,
} from '../release/capture-published-latest'
import {
  capturePublishedPackageLatestBaseline,
  createBrowserEntry,
  createConsumerPackageJson,
  fetchPublishedPackageMetadata,
  getPublishedMetadataProblems,
  parsePublishedPackageOptions,
  parseRegistryPackageMetadata,
  readPublishedPackageLatestBaseline,
  verifySlsaProvenanceBundle,
} from '../release/check-published-packages'

const RELEASE_SHA = '3a37683c855455d9a980609f9d7c54152d00b561'
const PACKAGE_DIGEST =
  'd6f63c755ed812a619ffcea7249dcd78c46241272684a3023415751be8237768794b0df419b0bb46de04c0e28ff17e5b52991508d6fb464ca52cd38654e0a9e5'

interface ProvenanceFixtureOptions {
  integrity?: string
  latest?: string | null
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
  const distTags: Record<string, string> = {
    beta: version,
  }

  if (options.latest !== null) {
    distTags.latest = options.latest || '0.1.0-beta.0'
  }

  return {
    distTags,
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
        signatures: [
          {
            keyid: '',
            sig: 'fixture-signature',
          },
        ],
      },
    },
    predicateType: 'https://slsa.dev/provenance/v1',
  }
}

function createLatestBaseline(
  latest: string | null = '0.1.0-beta.0',
): Record<string, string | null> {
  return {
    '@zeus-web/button': latest,
  }
}

function acceptSigstoreBundle(): Promise<void> {
  return Promise.resolve()
}

describe('published package smoke check', () => {
  it('requires an immutable release SHA', () => {
    expect(() =>
      parsePublishedPackageOptions([
        '--version',
        '0.1.0-beta.2',
        '--tag',
        'beta',
        '--latest-baseline',
        '/tmp/latest.json',
      ]),
    ).toThrow('Expected --release-sha with a 40-character commit SHA')
  })

  it('requires a complete per-package latest baseline for verification', () => {
    expect(() =>
      parsePublishedPackageOptions([
        '--version',
        '0.1.0-beta.2',
        '--tag',
        'beta',
        '--latest-baseline',
        '/tmp/latest.json',
        '--release-sha',
        RELEASE_SHA,
      ]),
    ).not.toThrow()
  })

  it('rejects release versions that are not strict SemVer', () => {
    const invalidVersions = ['01.2.3', '1.2.3-.', '1.2.3-a..b', '1.2.3-beta.01']

    for (const version of invalidVersions) {
      expect(() =>
        parsePublishedPackageOptions([
          '--version',
          version,
          '--tag',
          'beta',
          '--latest-baseline',
          '/tmp/latest.json',
          '--release-sha',
          RELEASE_SHA,
        ]),
      ).toThrow('Expected --version with a valid release version')
    }
  })

  it('captures each package latest tag and records unpublished packages', () => {
    const urls: string[] = []

    return capturePublishedPackageLatestBaseline(
      ['@zeus-web/button', '@zeus-web/new-package'],
      'https://registry.npmjs.org/',
      url => {
        urls.push(url)

        if (url.includes('new-package')) {
          return Promise.resolve({
            json: () => Promise.resolve({}),
            ok: false,
            status: 404,
          })
        }

        return Promise.resolve({
          json: () =>
            Promise.resolve({
              'dist-tags': { latest: '0.1.0-beta.0' },
            }),
          ok: true,
          status: 200,
        })
      },
    ).then(baseline => {
      expect(urls).toEqual([
        'https://registry.npmjs.org/%40zeus-web%2Fbutton',
        'https://registry.npmjs.org/%40zeus-web%2Fnew-package',
      ])
      expect(baseline).toEqual({
        '@zeus-web/button': '0.1.0-beta.0',
        '@zeus-web/new-package': null,
      })
    })
  })

  it('parses capture output and normalizes the registry URL', () => {
    expect(
      parseCapturePublishedLatestOptions([
        '--output',
        '/tmp/latest.json',
        '--registry',
        'https://registry.example.test',
      ]),
    ).toEqual({
      output: '/tmp/latest.json',
      registry: 'https://registry.example.test/',
      root: process.cwd(),
    })
  })

  it('requires an output path when capturing the latest baseline', () => {
    expect(() => parseCapturePublishedLatestOptions([])).toThrow(
      'Expected --output with a baseline file path',
    )
  })

  it('reports synchronous capture CLI errors without an uncaught stack', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        join(
          process.cwd(),
          'scripts/checks/release/capture-published-latest.ts',
        ),
      ],
      { encoding: 'utf8' },
    )

    expect(result.status).toBe(1)
    expect(result.stderr.trim()).toBe(
      'Expected --output with a baseline file path',
    )
    expect(result.stderr).not.toContain('at parseCapturePublishedLatestOptions')
  })

  it('runs the complete capture pipeline for publishable workspace packages', () => {
    const root = mkdtempSync(join(tmpdir(), 'zeus-capture-latest-'))
    const output = join(root, 'latest.json')
    const publicPackage = join(root, 'packages/primitives/button/package.json')
    const privatePackage = join(root, 'packages/private/package.json')
    const requests: string[] = []

    mkdirSync(join(publicPackage, '..'), { recursive: true })
    mkdirSync(join(privatePackage, '..'), { recursive: true })
    writeFileSync(
      publicPackage,
      JSON.stringify({ name: '@zeus-web/button', version: '0.1.0' }),
    )
    writeFileSync(
      privatePackage,
      JSON.stringify({ name: '@zeus-web/private', private: true }),
    )

    return runCapturePublishedLatest(
      ['--output', output, '--registry', 'https://registry.example.test'],
      root,
      url => {
        requests.push(url)

        return Promise.resolve({
          json: () => Promise.resolve({ 'dist-tags': { latest: '0.1.0' } }),
          ok: true,
          status: 200,
        })
      },
    ).then(
      packageCount => {
        expect(packageCount).toBe(1)
        expect(requests).toEqual([
          'https://registry.example.test/%40zeus-web%2Fbutton',
        ])
        expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual({
          '@zeus-web/button': '0.1.0',
        })
        rmSync(root, { force: true, recursive: true })
      },
      error => {
        rmSync(root, { force: true, recursive: true })
        throw error
      },
    )
  })

  it('fails baseline capture on registry errors other than not found', () => {
    return expect(
      capturePublishedPackageLatestBaseline(
        ['@zeus-web/button'],
        'https://registry.npmjs.org/',
        () =>
          Promise.resolve({
            json: () => Promise.resolve({}),
            ok: false,
            status: 503,
          }),
      ),
    ).rejects.toThrow('@zeus-web/button: registry returned HTTP 503')
  })

  it('records an existing package without a latest tag as null', () => {
    return capturePublishedPackageLatestBaseline(
      ['@zeus-web/button'],
      'https://registry.npmjs.org/',
      () =>
        Promise.resolve({
          json: () => Promise.resolve({ 'dist-tags': { beta: '0.1.0' } }),
          ok: true,
          status: 200,
        }),
    ).then(baseline => {
      expect(baseline).toEqual({
        '@zeus-web/button': null,
      })
    })
  })

  it('fails baseline capture when registry dist-tags metadata is invalid', () => {
    return expect(
      capturePublishedPackageLatestBaseline(
        ['@zeus-web/button'],
        'https://registry.npmjs.org/',
        () =>
          Promise.resolve({
            json: () => Promise.resolve({ 'dist-tags': [] }),
            ok: true,
            status: 200,
          }),
      ),
    ).rejects.toThrow('@zeus-web/button: registry dist-tags are invalid')
  })

  it('fails baseline capture when latest is not strict SemVer', () => {
    const invalidVersions = ['01.2.3', '1.2.3-.', '1.2.3-a..b', '1.2.3-beta.01']

    return Promise.all(
      invalidVersions.map(latest =>
        expect(
          capturePublishedPackageLatestBaseline(
            ['@zeus-web/button'],
            'https://registry.npmjs.org/',
            () =>
              Promise.resolve({
                json: () => Promise.resolve({ 'dist-tags': { latest } }),
                ok: true,
                status: 200,
              }),
          ),
        ).rejects.toThrow(
          '@zeus-web/button: registry latest dist-tag is invalid',
        ),
      ),
    ).then(() => undefined)
  })

  it('writes and reads a per-package latest baseline', () => {
    const directory = mkdtempSync(join(tmpdir(), 'zeus-latest-baseline-'))
    const path = join(directory, 'latest.json')

    try {
      writePublishedPackageLatestBaseline(path, {
        '@zeus-web/button': '0.1.0-beta.0',
        '@zeus-web/new-package': null,
      })

      expect(readFileSync(path, 'utf8')).toBe(
        '{\n  "@zeus-web/button": "0.1.0-beta.0",\n  "@zeus-web/new-package": null\n}\n',
      )
      expect(readPublishedPackageLatestBaseline(path)).toEqual({
        '@zeus-web/button': '0.1.0-beta.0',
        '@zeus-web/new-package': null,
      })
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('rejects malformed latest baseline JSON', () => {
    const directory = mkdtempSync(join(tmpdir(), 'zeus-latest-baseline-'))
    const path = join(directory, 'latest.json')

    try {
      writeFileSync(path, '{not-json}\n', 'utf8')

      expect(() => readPublishedPackageLatestBaseline(path)).toThrow(
        'Latest baseline must be valid JSON',
      )
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('rejects non-object and invalid latest baseline values', () => {
    const directory = mkdtempSync(join(tmpdir(), 'zeus-latest-baseline-'))
    const path = join(directory, 'latest.json')

    try {
      writeFileSync(path, '[]\n', 'utf8')
      expect(() => readPublishedPackageLatestBaseline(path)).toThrow(
        'Latest baseline must be a JSON object',
      )

      writeFileSync(path, '{"@zeus-web/button":false}\n', 'utf8')
      expect(() => readPublishedPackageLatestBaseline(path)).toThrow(
        '@zeus-web/button: latest baseline is invalid',
      )

      for (const latest of [
        '01.2.3',
        '1.2.3-.',
        '1.2.3-a..b',
        '1.2.3-beta.01',
      ]) {
        writeFileSync(
          path,
          `${JSON.stringify({ '@zeus-web/button': latest })}\n`,
          'utf8',
        )
        expect(() => readPublishedPackageLatestBaseline(path)).toThrow(
          '@zeus-web/button: latest baseline is invalid',
        )
      }
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
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

    return verifySlsaProvenanceBundle(
      bundle,
      '0.1.0-beta.1',
      acceptSigstoreBundle,
    ).then(result => {
      expect(result).toEqual(statement)
    })
  })

  it('rejects a bundle with multiple SLSA statements', () => {
    const statement = createPublishedMetadata().provenanceStatement
    const bundle = {
      attestations: [
        createSlsaAttestation(statement),
        createSlsaAttestation(statement),
      ],
    }

    return verifySlsaProvenanceBundle(
      bundle,
      '0.1.0-beta.1',
      acceptSigstoreBundle,
    ).then(result => {
      expect(result).toBeUndefined()
    })
  })

  it('rejects a SLSA bundle without a DSSE signature', () => {
    const statement = createPublishedMetadata().provenanceStatement
    const attestation = createSlsaAttestation(statement)
    let verificationCount = 0

    attestation.bundle.dsseEnvelope.signatures = []

    return verifySlsaProvenanceBundle(
      { attestations: [attestation] },
      '0.1.0-beta.1',
      () => {
        verificationCount += 1

        return Promise.resolve()
      },
    ).then(result => {
      expect(result).toBeUndefined()
      expect(verificationCount).toBe(0)
    })
  })

  it('rejects a SLSA payload changed after signature verification', () => {
    const statement = createPublishedMetadata().provenanceStatement
    const attestation = createSlsaAttestation(statement)
    const tamperedStatement = createPublishedMetadata({
      releaseSha: '0000000000000000000000000000000000000000',
    }).provenanceStatement

    return verifySlsaProvenanceBundle(
      { attestations: [attestation] },
      '0.1.0-beta.1',
      bundle => {
        const verifiedBundle = bundle as typeof attestation.bundle

        verifiedBundle.dsseEnvelope.payload = Buffer.from(
          JSON.stringify(tamperedStatement),
        ).toString('base64')

        return Promise.resolve()
      },
    ).then(result => {
      expect(result).toBeUndefined()
    })
  })

  it('rejects provenance from the wrong certificate identity', () => {
    const statement = createPublishedMetadata().provenanceStatement
    const attestation = createSlsaAttestation(statement)

    return expect(
      verifySlsaProvenanceBundle(
        { attestations: [attestation] },
        '0.1.0-beta.1',
        () => Promise.reject(new Error('certificate identity mismatch')),
      ),
    ).rejects.toThrow('certificate identity mismatch')
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

  it('preserves invalid raw latest values so first beta verification fails closed', () => {
    for (const latest of [false, null]) {
      const metadata = parseRegistryPackageMetadata(
        {
          'dist-tags': {
            beta: '0.1.0-beta.1',
            latest,
          },
          versions: {
            '0.1.0-beta.1': {},
          },
        },
        '0.1.0-beta.1',
      )
      const problems = getPublishedMetadataProblems(
        ['@zeus-web/button'],
        '0.1.0-beta.1',
        'beta',
        {
          '@zeus-web/button': metadata,
        },
        createLatestBaseline(null),
        RELEASE_SHA,
      )

      expect(problems).toContain(
        `@zeus-web/button: dist-tag latest points to ${String(latest)}`,
      )
    }
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
    const slsaAttestation = createSlsaAttestation(statement)
    const attestationBundle = {
      attestations: [
        {
          predicateType:
            'https://github.com/npm/attestation/tree/main/specs/publish/v0.1',
        },
        slsaAttestation,
      ],
    }
    const requests: string[] = []
    const verificationRequests: unknown[] = []

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
      (bundle, options) => {
        verificationRequests.push({ bundle, options })

        return Promise.resolve()
      },
    ).then(metadata => {
      expect(requests).toEqual([
        'https://registry.npmjs.org/%40zeus-web%2Fbutton',
        attestationUrl,
      ])
      expect(verificationRequests).toEqual([
        {
          bundle: slsaAttestation.bundle,
          options: {
            certificateIdentityURI:
              '^https://github\\.com/baicie/zeus-ui/\\.github/workflows/publish\\.yml@refs/tags/v0\\.1\\.0-beta\\.1$',
            certificateIssuer: 'https://token.actions.githubusercontent.com',
          },
        },
      ])
      const identityPattern = new RegExp(
        (
          verificationRequests[0] as {
            options: { certificateIdentityURI: string }
          }
        ).options.certificateIdentityURI,
      )

      expect(
        identityPattern.test(
          'https://github.com/baicie/zeus-ui/.github/workflows/publish.yml@refs/tags/v0.1.0-beta.1',
        ),
      ).toBe(true)
      expect(
        identityPattern.test(
          'https://github.com/baicie/zeus-ui/.github/workflows/publish.yml@refs/tags/v0x1x0-beta.1-attacker',
        ),
      ).toBe(false)
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
      createLatestBaseline(),
      RELEASE_SHA,
    )

    expect(problems).toEqual([])
  })

  it('preserves a different latest baseline for each package', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button', '@zeus-web/input'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          latest: '0.1.0-beta.0',
        }),
        '@zeus-web/input': createPublishedMetadata({
          latest: '0.0.9',
          subjectName: 'pkg:npm/%40zeus-web/input@0.1.0-beta.1',
        }),
      },
      {
        '@zeus-web/button': '0.1.0-beta.0',
        '@zeus-web/input': '0.0.9',
      },
      RELEASE_SHA,
    )

    expect(problems).toEqual([])
  })

  it('expects no latest tag for a beta package first published from an empty registry', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          latest: null,
        }),
      },
      {
        '@zeus-web/button': null,
      },
      RELEASE_SHA,
    )

    expect(problems).toEqual([])
  })

  it('rejects a beta package first publish that unexpectedly creates latest', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata({
          latest: '0.1.0-beta.1',
        }),
      },
      {
        '@zeus-web/button': null,
      },
      RELEASE_SHA,
    )

    expect(problems).toEqual([
      '@zeus-web/button: dist-tag latest points to 0.1.0-beta.1',
    ])
  })

  it('expects the current version as latest for a stable package first publish', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0',
      'latest',
      {
        '@zeus-web/button': createPublishedMetadata({
          latest: '0.1.0',
          version: '0.1.0',
        }),
      },
      {
        '@zeus-web/button': null,
      },
      RELEASE_SHA,
    )

    expect(problems).toEqual([])
  })

  it('fails closed when the release baseline does not cover every package', () => {
    const problems = getPublishedMetadataProblems(
      ['@zeus-web/button'],
      '0.1.0-beta.1',
      'beta',
      {
        '@zeus-web/button': createPublishedMetadata(),
      },
      {},
      RELEASE_SHA,
    )

    expect(problems).toContain(
      '@zeus-web/button: latest baseline is unavailable',
    )
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
      createLatestBaseline(),
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
      createLatestBaseline(),
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
      createLatestBaseline(),
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
      createLatestBaseline(),
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
      createLatestBaseline(),
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
      createLatestBaseline(),
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
      createLatestBaseline(),
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
      createLatestBaseline(),
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
      createLatestBaseline(),
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
      createLatestBaseline(),
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
      createLatestBaseline(),
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
      createLatestBaseline(),
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
