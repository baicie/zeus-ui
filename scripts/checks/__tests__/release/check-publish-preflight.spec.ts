import { describe, expect, it } from 'vitest'

import { runPublishPreflight } from '../../release/check-publish-preflight'

const VERSION = '0.2.0-rc.0'
const PACKAGES = ['@zeus-web/ui', '@zeus-web/primitives']

type Handler = (url: string) => Response | Promise<Response>

function fetcher(handler: Handler): typeof fetch {
  return (async input => {
    const url = typeof input === 'string' ? input : String(input)
    return handler(url)
  }) as typeof fetch
}

function stateResponse(status: number): Response {
  return new Response(null, { status })
}

const noSleep = () => Promise.resolve()

describe('publish preflight', () => {
  it('records published and absent packages before a first publish', async () => {
    const report = await runPublishPreflight({
      version: VERSION,
      tag: 'rc',
      packageNames: PACKAGES,
      fetcher: fetcher(url =>
        url.includes('primitives') ? stateResponse(404) : stateResponse(200),
      ),
      sleep: noSleep,
    })

    expect(report.ok).toBe(true)
    expect(report.published).toEqual(['@zeus-web/ui'])
    expect(report.absent).toEqual(['@zeus-web/primitives'])
    expect(report.failed).toEqual([])
  })

  it('fails closed on a 500 instead of treating the version as absent', async () => {
    const report = await runPublishPreflight({
      version: VERSION,
      tag: 'rc',
      packageNames: PACKAGES,
      fetcher: fetcher(() => stateResponse(500)),
      sleep: noSleep,
    })

    expect(report.ok).toBe(false)
    expect(report.absent).toEqual([])
    expect(report.failed).toEqual(PACKAGES)
  })

  it('fails closed on 401 and 403', async () => {
    for (const status of [401, 403]) {
      const report = await runPublishPreflight({
        version: VERSION,
        tag: 'rc',
        packageNames: ['@zeus-web/ui'],
        fetcher: fetcher(() => stateResponse(status)),
        sleep: noSleep,
      })

      expect(report.ok).toBe(false)
      expect(report.packages[0]!.state).toBe('FAILED')
    }
  })

  it('fails closed on a network error', async () => {
    const report = await runPublishPreflight({
      version: VERSION,
      tag: 'rc',
      packageNames: ['@zeus-web/ui'],
      fetcher: fetcher(() => {
        throw new Error('ECONNREFUSED')
      }),
      sleep: noSleep,
    })

    expect(report.ok).toBe(false)
    expect(report.packages[0]!.detail).toContain('ECONNREFUSED')
  })

  it('retries a transient failure and then succeeds', async () => {
    let calls = 0
    const report = await runPublishPreflight({
      version: VERSION,
      tag: 'rc',
      packageNames: ['@zeus-web/ui'],
      fetcher: fetcher(() => {
        calls += 1
        return calls === 1 ? stateResponse(503) : stateResponse(404)
      }),
      sleep: noSleep,
    })

    expect(calls).toBe(2)
    expect(report.ok).toBe(true)
    expect(report.absent).toEqual(['@zeus-web/ui'])
  })

  it('reports the recovery set on a partial release', async () => {
    // The first attempt published ui and failed on primitives. A retry must
    // leave ui alone and publish only the missing package.
    const report = await runPublishPreflight({
      version: VERSION,
      tag: 'rc',
      packageNames: PACKAGES,
      fetcher: fetcher(url =>
        url.includes('primitives') ? stateResponse(404) : stateResponse(200),
      ),
      sleep: noSleep,
    })

    expect(report.published).toEqual(['@zeus-web/ui'])
    expect(report.absent).toEqual(['@zeus-web/primitives'])
  })

  it('rejects a version published on the wrong channel', async () => {
    await expect(
      runPublishPreflight({
        version: VERSION,
        tag: 'latest',
        packageNames: PACKAGES,
        fetcher: fetcher(() => stateResponse(404)),
        sleep: noSleep,
      }),
    ).rejects.toThrow('must be published under dist-tag "rc"')
  })

  it('rejects an unsupported prerelease identifier', async () => {
    await expect(
      runPublishPreflight({
        version: '0.2.0-alpha.1',
        tag: 'rc',
        packageNames: PACKAGES,
        fetcher: fetcher(() => stateResponse(404)),
        sleep: noSleep,
      }),
    ).rejects.toThrow('Unsupported prerelease')
  })

  it('rejects an empty package set', async () => {
    await expect(
      runPublishPreflight({
        version: VERSION,
        tag: 'rc',
        packageNames: [],
        fetcher: fetcher(() => stateResponse(404)),
        sleep: noSleep,
      }),
    ).rejects.toThrow('No publishable packages')
  })

  it('never writes to the registry', async () => {
    const methods: string[] = []
    const recording = (async (input: RequestInfo | URL, init?: RequestInit) => {
      void input
      methods.push(init?.method ?? 'GET')
      return stateResponse(404)
    }) as typeof fetch

    await runPublishPreflight({
      version: VERSION,
      tag: 'rc',
      packageNames: ['@zeus-web/ui'],
      fetcher: recording,
      sleep: noSleep,
    })

    expect(methods.every(method => method === 'GET')).toBe(true)
  })
})
