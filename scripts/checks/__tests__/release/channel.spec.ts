import { describe, expect, it } from 'vitest'

import {
  RELEASE_CHANNELS,
  resolveChannel,
  validateChannelTag,
} from '../../../release/channel'

describe('release channel contract', () => {
  it.each([
    ['0.2.0', 'latest', false],
    ['1.0.0', 'latest', false],
    ['0.2.0-rc.0', 'rc', true],
    ['0.2.0-rc.12', 'rc', true],
    ['0.1.0-beta.35', 'beta', true],
    ['0.1.1-canary.3', 'canary', true],
  ])('maps %s to the %s channel', (version, channel, prerelease) => {
    const result = resolveChannel(version)

    expect(result.errors).toEqual([])
    expect(result.channel).toBe(channel)
    expect(result.prerelease).toBe(prerelease)
  })

  it('accepts a tag that confirms the version channel', () => {
    expect(validateChannelTag('0.2.0-rc.0', 'rc').ok).toBe(true)
    expect(validateChannelTag('0.1.0-beta.35', 'beta').ok).toBe(true)
    expect(validateChannelTag('0.2.0', 'latest').ok).toBe(true)
  })

  it('rejects publishing a release candidate to latest', () => {
    const result = validateChannelTag('0.2.0-rc.0', 'latest')

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain(
      'must be published under dist-tag "rc", not "latest"',
    )
  })

  it('rejects publishing a stable version to rc or beta', () => {
    for (const tag of ['rc', 'beta', 'canary']) {
      const result = validateChannelTag('0.2.0', tag)

      expect(result.ok).toBe(false)
      expect(result.errors.join('\n')).toContain(
        `must be published under dist-tag "latest", not "${tag}"`,
      )
    }
  })

  it('rejects a prerelease that is not a known channel', () => {
    const result = resolveChannel('0.2.0-alpha.1')

    expect(result.channel).toBeUndefined()
    expect(result.errors.join('\n')).toContain('alpha')
    expect(result.errors.join('\n')).toContain('Unsupported prerelease')
  })

  it('rejects an unknown dist-tag', () => {
    const result = validateChannelTag('0.2.0-rc.0', 'next')

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain(
      'Unsupported npm dist-tag "next"',
    )
  })

  it('rejects a malformed version', () => {
    const result = resolveChannel('v0.2.0')

    expect(result.channel).toBeUndefined()
    expect(result.errors).toHaveLength(1)
  })

  it('derives a channel without an explicit tag', () => {
    const result = validateChannelTag('0.2.0-rc.0', undefined)

    expect(result.ok).toBe(true)
    expect(result.channel).toBe('rc')
  })

  it('never maps a prerelease onto latest', () => {
    for (const version of ['0.2.0-rc.0', '0.1.0-beta.1', '0.1.1-canary.1']) {
      expect(resolveChannel(version).channel).not.toBe('latest')
    }
  })

  it('exposes the channel list used by the workflows', () => {
    expect(RELEASE_CHANNELS).toEqual(['latest', 'rc', 'beta', 'canary'])
  })
})
