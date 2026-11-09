/**
 * Channel gate for the release and publish CLIs.
 *
 * `@baicie/release` derives a dist-tag from the version when `--tag` is absent
 * (`resolveDistTag`), but it accepts any explicit `--tag` value. That means
 * `pnpm release 0.2.0-rc.0 --tag latest` would silently move the npm default
 * install target to a release candidate.
 *
 * Every Zeus UI release entry point therefore validates the requested tag
 * against `resolveChannel()` before the underlying CLI runs.
 */
import { validateChannelTag } from '../release/channel'

export interface ChannelGuard {
  readonly version: string
  readonly tag: string | undefined
}

/** Returns the validated tag or throws, so a caller can never proceed on error. */
export function requirePublishChannel(args: readonly string[]): {
  version: string
  tag?: string
} {
  const { version, tag } = parseChannelArgs(args)

  if (!version) {
    throw new Error(
      'A release version is required (for example 0.2.0-rc.0 or 0.2.0)',
    )
  }

  const result = validateChannelTag(version, tag)

  if (!result.ok) {
    throw new Error(result.errors.join('\n'))
  }

  return {
    version,
    ...(result.channel ? { tag: result.channel } : {}),
  }
}

/**
 * Reads the positional version and `--tag` without consuming anything else, so
 * the remaining arguments still reach `@baicie/release` unchanged.
 */
export function parseChannelArgs(args: readonly string[]): ChannelGuard {
  let version = ''
  let tag: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--tag') {
      const value = args[index + 1]
      if (!value) throw new Error('--tag requires a value')
      tag = value
      index += 1
      continue
    }

    if (arg.startsWith('--tag=')) {
      const value = arg.slice('--tag='.length)
      if (!value) throw new Error('--tag requires a value')
      tag = value
      continue
    }

    if (arg === '--version') {
      const value = args[index + 1]
      if (!value) throw new Error('--version requires a value')
      version = value
      index += 1
      continue
    }

    if (arg.startsWith('--version=')) {
      version = arg.slice('--version='.length)
      continue
    }

    if (!arg.startsWith('-') && version === '') {
      version = arg
    }
  }

  return { version, tag }
}
