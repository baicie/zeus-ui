/**
 * Fails when the verification workflow is able to publish.
 *
 * ## Why a script and not inline `node -e`
 *
 * The first version was a shell `grep` over the whole file, and it matched the
 * file's own comment describing what must not happen — it could never pass.
 * The second was inline JavaScript, which worked but could not be tested
 * without running the workflow.
 *
 * This parses the workflow and inspects only step `run` bodies, with shell
 * comments stripped. Documentation is allowed to say "no npm publish"; a
 * command is not.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'yaml'

/** Commands that would turn a verification run into a publish run. */
export const FORBIDDEN_COMMAND =
  /\b(?:npm|pnpm)\s+(?:publish|dist-tag|unpublish)\b|\bnpm\s+(?:deprecate|owner|access)\b/

/** Secrets a verification workflow has no business reading. */
export const FORBIDDEN_SECRETS = [
  'NPM_PUBLISH_TOKEN',
  'NODE_AUTH_TOKEN',
  'NPM_TOKEN',
]

/** Removes shell comments so prose cannot trip a command check. */
export function stripShellComments(script) {
  return script
    .split('\n')
    .map(line => line.replace(/(^|\s)#.*$/, ''))
    .join('\n')
}

/**
 * Returns the offences in a parsed workflow.
 *
 * Exported so the test can feed it a workflow that *does* publish and assert
 * that it is caught — a guard that cannot fail is not a guard.
 */
export function findPublishOffences(workflow) {
  const offenders = []

  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      const label = step.name ?? 'unnamed'
      const run = typeof step.run === 'string' ? step.run : ''

      if (FORBIDDEN_COMMAND.test(stripShellComments(run))) {
        offenders.push(
          `${jobName} / ${label}: contains a publish, dist-tag or unpublish command`,
        )
      }

      const env = JSON.stringify(step.env ?? {})

      for (const secret of FORBIDDEN_SECRETS) {
        if (env.includes(`secrets.${secret}`)) {
          offenders.push(`${jobName} / ${label}: reads secrets.${secret}`)
        }
      }
    }
  }

  return offenders
}

/** Also rejects a write permission: verification only reads. */
export function findPermissionOffences(workflow) {
  const offences = []
  const check = (scope, permissions) => {
    if (!permissions || typeof permissions !== 'object') return

    if (permissions.contents === 'write') {
      offences.push(
        `${scope}: contents is write, but verification must be read-only`,
      )
    }
  }

  check('workflow', workflow.permissions)

  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    check(`job ${jobName}`, job.permissions)
  }

  return offences
}

export function checkVerifyWorkflow(file) {
  const source = readFileSync(file, 'utf8')
  const workflow = parse(source)

  return [...findPublishOffences(workflow), ...findPermissionOffences(workflow)]
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const file = resolve(
    process.argv[2] ?? '.github/workflows/verify-published-release.yml',
  )

  const offences = checkVerifyWorkflow(file)

  if (offences.length > 0) {
    for (const offence of offences) console.error(`::error::${offence}`)
    process.exit(1)
  }

  console.log(
    `${file} cannot publish: no publish commands, no publish tokens, read-only`,
  )
}
