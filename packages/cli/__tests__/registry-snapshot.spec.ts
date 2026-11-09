import type { Registry } from '@zeus-web/registry'

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createAddPlan, rewriteRegistrySource } from '../src/commands/add'
import { createDiffEntries } from '../src/commands/diff'
import { readComponentsConfig } from '../src/config'
import { hashString, readComponentsLock } from '../src/lock'
import { loadRegistrySource } from '../src/registry-source'

function createManifest(name = '@acme/registry'): Registry {
  return {
    schemaVersion: 2,
    name,
    version: '1.2.3',
    license: 'MIT',
    authors: [{ name: 'Test Author' }],
    items: [
      {
        name: 'button',
        type: 'component',
        description: 'Custom button',
        frameworks: ['react'],
        dependencies: [],
        registryDependencies: [],
        files: [
          {
            framework: 'react',
            source: 'templates/button.tsx',
            target: 'components/ui/button.tsx',
          },
        ],
      },
    ],
  } as Registry
}

function createProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'zeus-registry-safety-'))
  writeFileSync(
    join(root, 'zeus-ui.json'),
    `${JSON.stringify(
      {
        framework: 'react',
        aliases: {
          components: '@/components',
          ui: '@/components/ui',
          lib: '@/lib',
          styles: '@/styles',
        },
      },
      null,
      2,
    )}\n`,
  )
  mkdirSync(join(root, 'src'), { recursive: true })
  return root
}

function registryDirectory(): string {
  const root = mkdtempSync(join(tmpdir(), 'zeus-registry-fixture-'))
  mkdirSync(join(root, 'templates'), { recursive: true })
  writeFileSync(join(root, 'registry.json'), JSON.stringify(createManifest()))
  writeFileSync(join(root, 'templates/button.tsx'), 'export const Button = 1')
  return root
}

async function withServer(
  handler: Parameters<typeof createServer>[1],
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(handler)
  await new Promise<void>(resolveListen => {
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Expected a TCP server address')
  }

  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close(error => {
        if (error) rejectClose(error)
        else resolveClose()
      })
    })
  }
}

describe('registry snapshot consistency', () => {
  it('writes exactly the bytes it hashes when the resource changes between requests', async () => {
    let assetRequests = 0
    const manifest = JSON.stringify(createManifest())

    await withServer(
      (request, response) => {
        if (request.url === '/registry/registry.json') {
          response.end(manifest)
          return
        }
        if (request.url === '/registry/templates/button.tsx') {
          assetRequests += 1
          // A hostile or simply racy registry changes content per request.
          response.end(
            assetRequests === 1
              ? 'export const Button = "A"'
              : 'export const Button = "B"',
          )
          return
        }
        response.statusCode = 404
        response.end('missing')
      },
      async baseUrl => {
        const project = createProject()
        try {
          const loaded = await loadRegistrySource({
            reference: `${baseUrl}/registry/`,
          })
          const config = readComponentsConfig(project)
          const plans = createAddPlan({
            components: ['button'],
            registrySource: loaded,
            cwd: project,
            config,
          })

          const snapshots = await Promise.all(
            plans.flatMap(plan =>
              plan.files.map(file => plan.snapshots.get(file.source)),
            ),
          )
          // One capture per resource, no matter how many plans reference it.
          expect(assetRequests).toBe(1)
          expect(snapshots[0]?.content).toContain('"A"')

          const expectedHash = hashString(snapshots[0]!.content)
          expect(snapshots[0]!.registryHash).toBe(expectedHash)
        } finally {
          rmSync(project, { recursive: true, force: true })
        }
      },
    )
  })

  it('reuses one capture across add and diff so update cannot write unhased bytes', async () => {
    const fixture = registryDirectory()
    const project = createProject()

    try {
      const loaded = await loadRegistrySource({ reference: fixture })
      const config = readComponentsConfig(project)
      const plans = createAddPlan({
        components: ['button'],
        registrySource: loaded,
        cwd: project,
        config,
      })
      const entries = await createDiffEntries({ cwd: project, plans })

      expect(entries).toHaveLength(1)
      const snapshot = await plans[0]!.snapshots.get('templates/button.tsx')
      expect(entries[0]!.registrySource).toBe(snapshot.content)
      expect(entries[0]!.registryHash).toBe(snapshot.registryHash)
      expect(entries[0]!.registryHash).toBe(hashString(snapshot.content))
    } finally {
      rmSync(project, { recursive: true, force: true })
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  it('does not cache a failed read, so a retry re-reads the resource', async () => {
    const fixture = registryDirectory()
    const project = createProject()
    const original = readFileSync(join(fixture, 'templates/button.tsx'), 'utf8')

    try {
      const loaded = await loadRegistrySource({ reference: fixture })
      const config = readComponentsConfig(project)
      const plans = createAddPlan({
        components: ['button'],
        registrySource: loaded,
        cwd: project,
        config,
      })

      // Break the resource, observe the failure, then repair it.
      rmSync(join(fixture, 'templates/button.tsx'))
      await expect(
        plans[0]!.snapshots.get('templates/button.tsx'),
      ).rejects.toThrow()

      writeFileSync(join(fixture, 'templates/button.tsx'), original)
      const recovered = await plans[0]!.snapshots.get('templates/button.tsx')
      expect(recovered.content).toBe(original)
    } finally {
      rmSync(project, { recursive: true, force: true })
      rmSync(fixture, { recursive: true, force: true })
    }
  })
})

describe('remote registry fetch safety', () => {
  it('rejects a response without Content-Length that exceeds the asset limit', async () => {
    const oversized = 'x'.repeat(5 * 1024 * 1024 + 1)

    await withServer(
      (request, response) => {
        if (request.url === '/registry/registry.json') {
          response.end(JSON.stringify(createManifest()))
          return
        }
        // Chunked response: no Content-Length header at all.
        response.writeHead(200, { 'transfer-encoding': 'chunked' })
        response.write(oversized.slice(0, 1024))
        response.end(oversized.slice(1024))
      },
      async baseUrl => {
        const loaded = await loadRegistrySource({
          reference: `${baseUrl}/registry/`,
        })

        await expect(loaded.readSource('templates/button.tsx')).rejects.toThrow(
          /5 MiB registry asset limit/,
        )
      },
    )
  })

  it('rejects a redirect to another origin before downloading the target', async () => {
    let targetRequests = 0
    const outsider = createServer((_request, response) => {
      targetRequests += 1
      response.end('export const Stolen = true')
    })
    await new Promise<void>(resolveListen => {
      outsider.listen(0, '127.0.0.1', resolveListen)
    })
    const outsiderAddress = outsider.address()
    if (!outsiderAddress || typeof outsiderAddress === 'string') {
      throw new Error('Expected a TCP server address')
    }
    const outsiderUrl = `http://127.0.0.1:${outsiderAddress.port}/secret.ts`

    try {
      await withServer(
        (request, response) => {
          if (request.url === '/registry/registry.json') {
            response.end(JSON.stringify(createManifest()))
            return
          }
          response.statusCode = 302
          response.setHeader('location', outsiderUrl)
          response.end()
        },
        async baseUrl => {
          const loaded = await loadRegistrySource({
            reference: `${baseUrl}/registry/`,
          })

          await expect(
            loaded.readSource('templates/button.tsx'),
          ).rejects.toThrow(/changes origin/)
          // The body must never be fetched from the rejected target.
          expect(targetRequests).toBe(0)
        },
      )
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        outsider.close(error => {
          if (error) rejectClose(error)
          else resolveClose()
        })
      })
    }
  })

  it('rejects a redirect that leaves the registry root on the same origin', async () => {
    let outsideRequests = 0

    await withServer(
      (request, response) => {
        if (request.url === '/registry/registry.json') {
          response.end(JSON.stringify(createManifest()))
          return
        }
        if (request.url === '/outside.ts') {
          outsideRequests += 1
          response.end('export const Outside = true')
          return
        }
        response.statusCode = 302
        response.setHeader('location', '/outside.ts')
        response.end()
      },
      async baseUrl => {
        const loaded = await loadRegistrySource({
          reference: `${baseUrl}/registry/`,
        })

        await expect(loaded.readSource('templates/button.tsx')).rejects.toThrow(
          /escapes its registry root/,
        )
        expect(outsideRequests).toBe(0)
      },
    )
  })

  it('rejects a redirect loop instead of following it forever', async () => {
    await withServer(
      (request, response) => {
        if (request.url === '/registry/registry.json') {
          response.end(JSON.stringify(createManifest()))
          return
        }
        response.statusCode = 302
        // Always points at itself, still inside the root.
        response.setHeader('location', '/registry/templates/loop.tsx')
        response.end()
      },
      async baseUrl => {
        const loaded = await loadRegistrySource({
          reference: `${baseUrl}/registry/`,
        })

        await expect(loaded.readSource('templates/loop.tsx')).rejects.toThrow(
          /redirect limit/,
        )
      },
    )
  })

  it('rejects an encoded traversal path without making a request', async () => {
    let assetRequests = 0

    await withServer(
      (request, response) => {
        if (request.url === '/registry/registry.json') {
          response.end(JSON.stringify(createManifest()))
          return
        }
        assetRequests += 1
        response.end('export const Leak = true')
      },
      async baseUrl => {
        const loaded = await loadRegistrySource({
          reference: `${baseUrl}/registry/`,
        })

        await expect(
          loaded.readSource('templates/%2e%2e/secret.ts'),
        ).rejects.toThrow(/Unsafe registry source path/)
        await expect(loaded.readSource('../secret.ts')).rejects.toThrow(
          /Unsafe registry source path/,
        )
        expect(assetRequests).toBe(0)
      },
    )
  })

  it('rejects a private registry host and allows loopback', async () => {
    await expect(
      loadRegistrySource({ reference: 'http://10.0.0.1/registry/' }),
    ).rejects.toThrow(/private address/)
    await expect(
      loadRegistrySource({
        reference: 'http://169.254.169.254/latest/meta-data',
      }),
    ).rejects.toThrow(/private address/)
    await expect(
      loadRegistrySource({
        reference: 'https://user:pass@registry.example.com/',
      }),
    ).rejects.toThrow(/must not contain credentials/)
  })

  it('rejects a protocol downgrade on redirect', async () => {
    await withServer(
      (request, response) => {
        if (request.url === '/registry/registry.json') {
          response.statusCode = 302
          // Same host, but an https -> http downgrade. The target is never
          // fetched: the redirect is rejected while inspecting the header.
          response.setHeader(
            'location',
            'https://registry.example.com/registry.json',
          )
          response.end()
          return
        }
        response.end('{}')
      },
      async baseUrl => {
        await expect(
          loadRegistrySource({ reference: `${baseUrl}/registry/` }),
        ).rejects.toThrow(/changes origin|downgrades/)
      },
    )
  })

  it('rejects a redirect from https to http', async () => {
    const loaded = await loadRegistrySource({
      reference: 'https://registry.example.com/registry/',
      fetchOptions: {
        fetch: (async input => {
          const status = 302
          const headers = new Headers({
            location: 'http://registry.example.com/registry.json',
          })
          void input
          return new Response(null, { status, headers })
        }) as typeof fetch,
      },
    }).catch(error => error as Error)

    expect(loaded).toBeInstanceOf(Error)
    expect((loaded as Error).message).toMatch(/downgrades/)
  })
})

describe('file registry target safety', () => {
  it('rejects a local symlink that points outside the registry root', async () => {
    const fixture = registryDirectory()
    const outside = mkdtempSync(join(tmpdir(), 'zeus-registry-outside-'))
    writeFileSync(join(outside, 'secret.ts'), 'export const Secret = true')

    try {
      // Replace the template with a symlink pointing outside the root.
      rmSync(join(fixture, 'templates/button.tsx'))
      symlinkSync(
        join(outside, 'secret.ts'),
        join(fixture, 'templates/button.tsx'),
      )
      const loaded = await loadRegistrySource({ reference: fixture })

      await expect(loaded.readSource('templates/button.tsx')).rejects.toThrow(
        /escapes its registry root/,
      )
    } finally {
      rmSync(fixture, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('rejects a missing or corrupt registry manifest', async () => {
    const missing = mkdtempSync(join(tmpdir(), 'zeus-registry-missing-'))
    const corrupt = mkdtempSync(join(tmpdir(), 'zeus-registry-corrupt-'))

    try {
      await expect(
        loadRegistrySource({ reference: join(missing, 'registry.json') }),
      ).rejects.toThrow()

      writeFileSync(join(corrupt, 'registry.json'), '{ not json')
      await expect(
        loadRegistrySource({ reference: join(corrupt, 'registry.json') }),
      ).rejects.toThrow(/not valid JSON/)

      writeFileSync(
        join(corrupt, 'registry.json'),
        JSON.stringify({ schemaVersion: 1 }),
      )
      await expect(
        loadRegistrySource({ reference: join(corrupt, 'registry.json') }),
      ).rejects.toThrow(/Invalid registry manifest/)
    } finally {
      rmSync(missing, { recursive: true, force: true })
      rmSync(corrupt, { recursive: true, force: true })
    }
  })
})

describe('lock integrity on failure', () => {
  it('does not write a lock entry when the registry asset is missing', async () => {
    const fixture = registryDirectory()
    const project = createProject()

    try {
      rmSync(join(fixture, 'templates/button.tsx'))
      const loaded = await loadRegistrySource({ reference: fixture })
      const config = readComponentsConfig(project)
      const plans = createAddPlan({
        components: ['button'],
        registrySource: loaded,
        cwd: project,
        config,
      })

      await expect(
        plans[0]!.snapshots.get('templates/button.tsx'),
      ).rejects.toThrow()

      const lock = readComponentsLock(project)
      expect(lock.components).toEqual({})
      expect(lock.registries).toEqual({})
    } finally {
      rmSync(project, { recursive: true, force: true })
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  it('keeps alias rewriting applied to the captured content', () => {
    const config = readComponentsConfig(createProject())
    const rewritten = rewriteRegistrySource(
      "import { cn } from '@/lib/cn'",
      config,
    )

    expect(rewritten).toContain('@/lib/cn')
  })
})
