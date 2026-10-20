import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadRegistrySource } from '../src/registry-source'

function createManifest(name = '@acme/registry') {
  return {
    schemaVersion: 1 as const,
    name,
    version: '1.2.3',
    items: [
      {
        name: 'button',
        type: 'component' as const,
        description: 'Custom button',
        frameworks: ['react' as const],
        dependencies: [],
        registryDependencies: [],
        files: [
          {
            framework: 'react' as const,
            source: 'templates/button.tsx',
            target: 'components/ui/button.tsx',
          },
        ],
      },
    ],
  }
}

describe('@zeus-web/cli registry sources', () => {
  it('loads a file registry and resolves assets from its root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'zeus-registry-source-'))
    mkdirSync(join(root, 'templates'), { recursive: true })
    writeFileSync(join(root, 'registry.json'), JSON.stringify(createManifest()))
    writeFileSync(join(root, 'templates/button.tsx'), 'export const Button = 1')

    try {
      const loaded = await loadRegistrySource({ reference: root })

      expect(loaded.registry.name).toBe('@acme/registry')
      expect(loaded.source.kind).toBe('file')
      expect(await loaded.readSource('templates/button.tsx')).toBe(
        'export const Button = 1',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('loads a directory URL and resolves assets relative to registry.json', async () => {
    const manifest = JSON.stringify(createManifest())
    const server = createServer((request, response) => {
      if (request.url === '/registry/registry.json') {
        response.end(manifest)
        return
      }
      if (request.url === '/registry/templates/button.tsx') {
        response.end('export const Button = 2')
        return
      }
      response.statusCode = 404
      response.end('missing')
    })
    await new Promise<void>(resolveListen => {
      server.listen(0, '127.0.0.1', resolveListen)
    })
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP server address')
    }

    try {
      const loaded = await loadRegistrySource({
        reference: `http://127.0.0.1:${address.port}/registry/`,
      })

      expect(loaded.source.kind).toBe('url')
      expect(loaded.registry.version).toBe('1.2.3')
      expect(await loaded.readSource('templates/button.tsx')).toBe(
        'export const Button = 2',
      )
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close(error => {
          if (error) rejectClose(error)
          else resolveClose()
        })
      })
    }
  })

  it('rebases registry assets after a same-origin manifest redirect', async () => {
    const manifest = JSON.stringify(createManifest())
    const server = createServer((request, response) => {
      if (request.url === '/registry/registry.json') {
        response.statusCode = 302
        response.setHeader('location', '/cdn/registry.json')
        response.end()
        return
      }
      if (request.url === '/cdn/registry.json') {
        response.end(manifest)
        return
      }
      if (request.url === '/cdn/templates/button.tsx') {
        response.end('export const Button = 3')
        return
      }
      response.statusCode = 404
      response.end('missing')
    })
    await new Promise<void>(resolveListen => {
      server.listen(0, '127.0.0.1', resolveListen)
    })
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP server address')
    }

    try {
      const loaded = await loadRegistrySource({
        reference: `http://127.0.0.1:${address.port}/registry/`,
      })

      expect(loaded.source.location).toContain('/cdn/registry.json')
      expect(await loaded.readSource('templates/button.tsx')).toBe(
        'export const Button = 3',
      )
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close(error => {
          if (error) rejectClose(error)
          else resolveClose()
        })
      })
    }
  })

  it('rejects file assets that escape the registry root through symlinks', async () => {
    const root = mkdtempSync(join(tmpdir(), 'zeus-registry-source-'))
    const outside = mkdtempSync(join(tmpdir(), 'zeus-registry-outside-'))
    mkdirSync(join(root, 'templates'), { recursive: true })
    writeFileSync(join(root, 'registry.json'), JSON.stringify(createManifest()))
    writeFileSync(join(outside, 'secret.tsx'), 'secret')
    symlinkSync(join(outside, 'secret.tsx'), join(root, 'templates/button.tsx'))

    try {
      const loaded = await loadRegistrySource({ reference: root })
      await expect(loaded.readSource('templates/button.tsx')).rejects.toThrow(
        'escapes its registry root',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('rejects encoded traversal in URL asset paths', async () => {
    const manifest = JSON.stringify(createManifest())
    const server = createServer((_request, response) => response.end(manifest))
    await new Promise<void>(resolveListen => {
      server.listen(0, '127.0.0.1', resolveListen)
    })
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP server address')
    }

    try {
      const loaded = await loadRegistrySource({
        reference: `http://127.0.0.1:${address.port}/registry/`,
      })
      await expect(
        loaded.readSource('templates/%2e%2e/%2e%2e/secret'),
      ).rejects.toThrow('Unsafe registry source path')
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close(error => {
          if (error) rejectClose(error)
          else resolveClose()
        })
      })
    }
  })

  it('rejects redirects before registry assets can leave the validated root', async () => {
    const manifest = JSON.stringify(createManifest())
    const server = createServer((request, response) => {
      if (request.url === '/registry/registry.json') {
        response.end(manifest)
        return
      }
      if (request.url === '/registry/templates/button.tsx') {
        response.writeHead(302, { location: '/outside/button.tsx' })
        response.end()
        return
      }
      if (request.url === '/outside/button.tsx') {
        response.end('secret from another root')
        return
      }
      response.statusCode = 404
      response.end('missing')
    })
    await new Promise<void>(resolveListen => {
      server.listen(0, '127.0.0.1', resolveListen)
    })
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP server address')
    }

    try {
      const loaded = await loadRegistrySource({
        reference: `http://127.0.0.1:${address.port}/registry/`,
      })
      await expect(loaded.readSource('templates/button.tsx')).rejects.toThrow()
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close(error => {
          if (error) rejectClose(error)
          else resolveClose()
        })
      })
    }
  })
})
