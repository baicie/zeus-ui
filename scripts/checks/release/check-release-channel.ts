/**
 * Workflow-facing channel gate.
 *
 * `release.yml` and `publish.yml` call this before running `@baicie/release`,
 * so the YAML, the CLI guard and the release checker all read one rule set from
 * `scripts/release/channel.ts` instead of duplicating shell `case` patterns.
 */
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import pc from 'picocolors'

import { validateChannelTag } from '../../release/channel'

export interface ReleaseChannelCheckOptions {
  readonly version: string
  readonly tag: string
  readonly context: 'release' | 'publish'
}

export function parseReleaseChannelCheckArgs(
  args: readonly string[],
): ReleaseChannelCheckOptions {
  const { values } = parseArgs({
    args: [...args],
    options: {
      version: { type: 'string' },
      tag: { type: 'string' },
      context: { type: 'string', default: 'release' },
    },
    allowPositionals: false,
  })

  if (!values.version) throw new Error('--version is required')
  if (!values.tag) throw new Error('--tag is required')
  if (values.context !== 'release' && values.context !== 'publish') {
    throw new Error('--context must be release or publish')
  }

  return {
    version: values.version,
    tag: values.tag,
    context: values.context,
  }
}

export function checkReleaseChannel(
  options: ReleaseChannelCheckOptions,
): string[] {
  const result = validateChannelTag(options.version, options.tag)

  if (result.errors.length > 0) return [...result.errors]

  if (
    options.context === 'publish' &&
    result.prerelease &&
    result.channel === 'canary'
  ) {
    return [
      'canary versions are published by the canary workflow, not by the release workflow',
    ]
  }

  return []
}

function main(): void {
  const options = parseReleaseChannelCheckArgs(process.argv.slice(2))
  const errors = checkReleaseChannel(options)

  if (errors.length > 0) {
    for (const error of errors) console.error(pc.red(`BLOCKER ${error}`))
    process.exitCode = 1
    return
  }

  console.log(
    pc.green(
      `release channel ${options.tag} accepted for ${options.version} (${options.context})`,
    ),
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
