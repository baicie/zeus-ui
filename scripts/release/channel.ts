/**
 * The single source of truth for the npm dist-tag a version may be published
 * under.
 *
 * A release channel is not an operator preference: it is a property of the
 * version itself.
 *
 *   stable  `0.2.0`          -> `latest`
 *   rc      `0.2.0-rc.0`     -> `rc`
 *   beta    `0.1.0-beta.35`  -> `beta`
 *   canary  `0.1.1-canary.3` -> `canary`
 *
 * Publishing `0.2.0-rc.0` under `latest` (or a stable version under `rc`) would
 * silently move the default install target, so every caller must derive the
 * tag through `resolveChannel()` and reject an explicit override that disagrees.
 */

export type ReleaseChannel = 'latest' | 'rc' | 'beta' | 'canary'

export const RELEASE_CHANNELS: readonly ReleaseChannel[] = [
  'latest',
  'rc',
  'beta',
  'canary',
]

const PRERELEASE_IDENTIFIERS: readonly ReleaseChannel[] = [
  'canary',
  'rc',
  'beta',
]

const SEMVER_PATTERN =
  /^\d+\.\d+\.\d+(?:-([0-9a-z]+(?:[.-][0-9a-z]+)*))?(?:\+[0-9a-z]+(?:[.-][0-9a-z]+)*)?$/i

export interface ChannelResolution {
  readonly channel?: ReleaseChannel
  readonly prerelease: boolean
  readonly errors: readonly string[]
}

function isChannel(value: string): value is ReleaseChannel {
  return (RELEASE_CHANNELS as readonly string[]).includes(value)
}

/**
 * Derives the channel a version must be published under.
 *
 * A prerelease identifier that is not one of the known channels is rejected
 * rather than mapped onto `latest`: an unrecognised identifier would otherwise
 * publish an unstable build as the default install target.
 */
export function resolveChannel(version: string): ChannelResolution {
  const match = SEMVER_PATTERN.exec(version)

  if (!match) {
    return {
      prerelease: false,
      errors: [`Invalid release version: ${version}`],
    }
  }

  const prerelease = match[1]

  if (prerelease === undefined) {
    return { channel: 'latest', prerelease: false, errors: [] }
  }

  const identifier = prerelease.split(/[.-]/)[0]?.toLowerCase() ?? ''

  if (!identifier || !isChannel(identifier) || identifier === 'latest') {
    return {
      prerelease: true,
      errors: [
        `Unsupported prerelease identifier "${identifier}" in ${version}; expected one of ${PRERELEASE_IDENTIFIERS.join(', ')}`,
      ],
    }
  }

  return { channel: identifier, prerelease: true, errors: [] }
}

export interface ChannelValidation {
  readonly ok: boolean
  readonly channel?: ReleaseChannel
  readonly prerelease: boolean
  readonly errors: readonly string[]
}

/**
 * Validates an operator-supplied `--tag` against the version. The version
 * decides the channel; the tag may only confirm it.
 */
export function validateChannelTag(
  version: string,
  tag: string | undefined,
): ChannelValidation {
  const resolution = resolveChannel(version)

  if (resolution.errors.length > 0) {
    return {
      ok: false,
      prerelease: resolution.prerelease,
      errors: resolution.errors,
    }
  }

  const channel = resolution.channel!

  if (tag === undefined) {
    return { ok: true, channel, prerelease: resolution.prerelease, errors: [] }
  }

  if (!isChannel(tag)) {
    return {
      ok: false,
      channel,
      prerelease: resolution.prerelease,
      errors: [
        `Unsupported npm dist-tag "${tag}"; expected one of ${RELEASE_CHANNELS.join(', ')}`,
      ],
    }
  }

  if (tag !== channel) {
    return {
      ok: false,
      channel,
      prerelease: resolution.prerelease,
      errors: [
        `Version ${version} must be published under dist-tag "${channel}", not "${tag}"`,
      ],
    }
  }

  return { ok: true, channel, prerelease: resolution.prerelease, errors: [] }
}
