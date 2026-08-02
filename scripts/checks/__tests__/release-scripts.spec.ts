import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parse } from 'yaml'

import {
  CHECKOUT_ACTION_REF,
  githubExpression,
  PNPM_SETUP_ACTION_REF,
  SETUP_NODE_ACTION_REF,
  shellVariable,
} from '../release/check-release-workflows'

interface WorkflowObject {
  [key: string]: unknown
}

const RELEASE_ACTION_REFS = [
  CHECKOUT_ACTION_REF,
  PNPM_SETUP_ACTION_REF,
  SETUP_NODE_ACTION_REF,
]

const RELEASE_CLI_PATTERN = /(?:^|\n)\s*pnpm release(?:\s|$)/

function asObject(value: unknown, label: string): WorkflowObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }

  return value as WorkflowObject
}

function getObject(parent: WorkflowObject, key: string): WorkflowObject {
  return asObject(parent[key], key)
}

function getSteps(job: WorkflowObject): WorkflowObject[] {
  const steps = job.steps

  if (!Array.isArray(steps)) throw new Error('steps must be an array')

  return steps.map((step, index) => asObject(step, `steps[${index}]`))
}

function getActionRefs(job: WorkflowObject): string[] {
  return getSteps(job)
    .filter(step => typeof step.uses === 'string')
    .map(step => String(step.uses))
}

function getRunCommands(job: WorkflowObject): string[] {
  return getSteps(job)
    .filter(step => typeof step.run === 'string')
    .map(step => String(step.run).trim())
}

function getNamedStep(job: WorkflowObject, name: string): WorkflowObject {
  const step = getSteps(job).find(candidate => candidate.name === name)

  if (!step) throw new Error(`Missing workflow step: ${name}`)

  return step
}

function getActionStep(job: WorkflowObject, action: string): WorkflowObject {
  const step = getSteps(job).find(candidate => candidate.uses === action)

  if (!step) throw new Error(`Missing workflow action: ${action}`)

  return step
}

function readWorkflow(name: string): {
  source: string
  workflow: WorkflowObject
} {
  const source = readFileSync(
    resolve(process.cwd(), `.github/workflows/${name}`),
    'utf-8',
  )

  return {
    source,
    workflow: asObject(parse(source) as unknown, name),
  }
}

describe('release script contract', () => {
  it('wires release scripts in root package.json', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'),
    ) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts.release).toBe('tsx scripts/commands/release.ts')
    expect(packageJson.scripts['release:plan']).toBe(
      'tsx scripts/commands/release-plan.ts',
    )
    expect(packageJson.scripts['release:verify']).toBe(
      'tsx scripts/checks/release/check-release-readiness.ts',
    )
    expect(packageJson.scripts['release:final']).toBe(
      'tsx scripts/checks/release/check-release-final.ts',
    )
    expect(packageJson.scripts['release:verify:published']).toBe(
      'tsx scripts/checks/release/check-published-packages.ts',
    )
    expect(packageJson.scripts['check:phase24-release']).toBe(
      'tsx scripts/checks/release/check-phase24-release.ts',
    )
    expect(packageJson.scripts['version:packages']).toBe(
      'tsx scripts/commands/version-packages.ts',
    )
    expect(packageJson.scripts['ci-publish']).toBe(
      'tsx scripts/commands/publish.ts',
    )
    expect(packageJson.scripts['npm:dist-tag:remove']).toBe(
      'tsx scripts/commands/remove-npm-dist-tag.ts',
    )
  })

  it('wires release config file', () => {
    const config = readFileSync(
      resolve(process.cwd(), 'scripts/release.config.ts'),
      'utf-8',
    )

    expect(config).toContain('defineReleaseConfig')
    expect(config).toContain('@baicie/release')
    expect(config).toContain('workspace-fixed')
    expect(config).toContain('publishable')
    expect(config).toContain('precheck')
  })

  it('keeps release workflow aligned with release scripts', () => {
    const { source, workflow } = readWorkflow('release.yml')
    const triggers = getObject(workflow, 'on')
    const workflowDispatch = getObject(triggers, 'workflow_dispatch')
    const inputs = getObject(workflowDispatch, 'inputs')
    const versionInput = getObject(inputs, 'version')
    const tagInput = getObject(inputs, 'tag')
    const dryRunInput = getObject(inputs, 'dry_run')
    const concurrency = getObject(workflow, 'concurrency')
    const jobs = getObject(workflow, 'jobs')
    const validateContext = getObject(jobs, 'validate-context')
    const dryRunJob = getObject(jobs, 'dry-run')
    const release = getObject(jobs, 'release')
    const dispatchPublish = getObject(jobs, 'dispatch-publish')
    const validateContextSteps = getSteps(validateContext)
    const dryRunSteps = getSteps(dryRunJob)
    const releaseSteps = getSteps(release)
    const dispatchPublishSteps = getSteps(dispatchPublish)
    const dryRunCommands = dryRunSteps.filter(
      step =>
        typeof step.run === 'string' && RELEASE_CLI_PATTERN.test(step.run),
    )
    const releaseCommands = releaseSteps.filter(
      step =>
        typeof step.run === 'string' && RELEASE_CLI_PATTERN.test(step.run),
    )
    const inlinePublishCommands = validateContextSteps
      .concat(dryRunSteps, releaseSteps, dispatchPublishSteps)
      .filter(
        step => typeof step.run === 'string' && step.run.includes('ci-publish'),
      )
    const dryRunCheckout = getActionStep(dryRunJob, CHECKOUT_ACTION_REF)
    const checkout = getActionStep(release, CHECKOUT_ACTION_REF)
    const validateContextStep = getNamedStep(
      validateContext,
      'Verify release context',
    )
    const dryRunRevision = getNamedStep(dryRunJob, 'Verify dispatch revision')
    const revision = getNamedStep(release, 'Verify dispatch revision')
    const dryRun = getNamedStep(dryRunJob, 'Dry-run release')
    const gitIdentity = getNamedStep(release, 'Configure Git identity')
    const realRelease = getNamedStep(release, 'Release')
    const captureRelease = getNamedStep(release, 'Capture release commit')
    const dispatchPublishStep = getNamedStep(
      dispatchPublish,
      'Dispatch publish workflow',
    )

    expect(Object.keys(triggers)).toEqual(['workflow_dispatch'])
    expect(Object.keys(jobs)).toEqual([
      'validate-context',
      'dry-run',
      'release',
      'dispatch-publish',
    ])
    expect(dryRunCommands).toHaveLength(1)
    expect(releaseCommands).toHaveLength(1)
    expect(inlinePublishCommands).toHaveLength(0)
    expect(versionInput).toEqual({
      description: 'Release version, for example 0.1.0-beta.0 or 0.1.0',
      required: true,
      type: 'string',
    })
    expect(tagInput).toEqual({
      description: 'npm dist-tag',
      required: true,
      default: 'beta',
      type: 'choice',
      options: ['beta', 'latest'],
    })
    expect(dryRunInput).toEqual({
      description: 'Run with --dry-run (no commit, no publish)',
      required: true,
      default: true,
      type: 'boolean',
    })
    expect(getObject(workflow, 'permissions')).toEqual({ contents: 'read' })
    expect(concurrency).toEqual({
      group: `release-${githubExpression('github.repository')}`,
      'cancel-in-progress': false,
    })
    expect(validateContext['runs-on']).toBe('ubuntu-latest')
    expect(getObject(validateContext, 'permissions')).toEqual({})
    expect(getActionRefs(validateContext)).toEqual([])
    expect(validateContextStep.run).toBe(
      'test "$GITHUB_REF" = "refs/heads/main"',
    )
    expect(dryRunJob.needs).toBe('validate-context')
    expect(dryRunJob.if).toBe(
      githubExpression(
        "github.ref == 'refs/heads/main' && inputs.dry_run == true",
      ),
    )
    expect(getObject(dryRunJob, 'permissions')).toEqual({ contents: 'read' })
    expect(getObject(dryRunJob, 'env')).toEqual({
      PUPPETEER_SKIP_DOWNLOAD: 'true',
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
    })
    expect(getActionRefs(dryRunJob)).toEqual(RELEASE_ACTION_REFS)
    expect(getObject(dryRunCheckout, 'with')).toEqual({
      'fetch-depth': 0,
      ref: 'main',
      'persist-credentials': false,
    })
    expect(dryRunRevision.run).toBe(
      'test "$(git rev-parse HEAD)" = "$GITHUB_SHA"',
    )
    expect(String(dryRun.run).trim()).toBe(
      'pnpm release "$VERSION" --tag "$TAG" --dry',
    )
    expect(JSON.stringify(dryRunJob)).not.toContain('NPM_TOKEN')
    expect(JSON.stringify(dryRunJob)).not.toContain('NODE_AUTH_TOKEN')

    expect(release.needs).toBe('validate-context')
    expect(release.if).toBe(
      githubExpression(
        "github.ref == 'refs/heads/main' && inputs.dry_run == false",
      ),
    )
    expect(getObject(release, 'permissions')).toEqual({ contents: 'write' })
    expect(getObject(release, 'outputs')).toEqual({
      release_sha: githubExpression('steps.release_commit.outputs.sha'),
    })
    expect(getObject(release, 'env')).toEqual({
      PUPPETEER_SKIP_DOWNLOAD: 'true',
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
    })
    expect(getActionRefs(release)).toEqual(RELEASE_ACTION_REFS)
    expect(getObject(checkout, 'with')).toEqual({
      'fetch-depth': 0,
      ref: 'main',
    })
    expect(revision.run).toBe('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"')
    expect(gitIdentity.if).toBeUndefined()
    expect(String(gitIdentity.run)).toContain(
      'git config user.name "github-actions[bot]"',
    )
    expect(String(gitIdentity.run)).toContain(
      'git config user.email "41898282+github-actions[bot]@users.noreply.github.com"',
    )
    expect(realRelease.if).toBeUndefined()
    expect(realRelease.run).toBe('pnpm release "$VERSION" --tag "$TAG"')
    expect(captureRelease.id).toBe('release_commit')
    expect(String(captureRelease.run).trim()).toBe(
      [
        `release_sha="$(git rev-parse "refs/tags/v${shellVariable('VERSION')}^{commit}")"`,
        'test "$(git rev-parse HEAD)" = "$release_sha"',
        'echo "sha=$release_sha" >> "$GITHUB_OUTPUT"',
      ].join('\n'),
    )
    expect(JSON.stringify(release)).not.toContain('NPM_TOKEN')
    expect(JSON.stringify(release)).not.toContain('NODE_AUTH_TOKEN')

    expect(dispatchPublish.needs).toBe('release')
    expect(dispatchPublish.if).toBe(
      githubExpression(
        "github.ref == 'refs/heads/main' && inputs.dry_run == false",
      ),
    )
    expect(dispatchPublish['runs-on']).toBe('ubuntu-latest')
    expect(getObject(dispatchPublish, 'permissions')).toEqual({
      actions: 'write',
      contents: 'read',
    })
    expect(getObject(dispatchPublish, 'env')).toEqual({
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
      RELEASE_SHA: githubExpression('needs.release.outputs.release_sha'),
    })
    expect(getActionRefs(dispatchPublish)).toEqual([])
    expect(String(dispatchPublishStep.run).trim()).toBe(
      [
        'gh workflow run publish.yml \\',
        '  --repo "$GITHUB_REPOSITORY" \\',
        '  --ref "v$VERSION" \\',
        '  --raw-field version="$VERSION" \\',
        '  --raw-field tag="$TAG" \\',
        '  --raw-field release_sha="$RELEASE_SHA"',
      ].join('\n'),
    )
    expect(getObject(dispatchPublishStep, 'env')).toEqual({
      GH_TOKEN: githubExpression('github.token'),
    })
    expect(source).not.toContain('github.event.inputs')
    expect(source).not.toContain('secrets: inherit')
    expect(source).not.toContain('NPM_PUBLISH_TOKEN')
    expect(source).not.toContain('default@')
    expect(source).not.toMatch(/uses:\s+\S+@v\d/)
  })

  it('publishes only from a matching tag-scoped workflow context', () => {
    const { source, workflow } = readWorkflow('publish.yml')
    const triggers = getObject(workflow, 'on')
    const workflowCall = getObject(triggers, 'workflow_call')
    const inputs = getObject(workflowCall, 'inputs')
    const secrets = getObject(workflowCall, 'secrets')
    const workflowDispatch = getObject(triggers, 'workflow_dispatch')
    const dispatchInputs = getObject(workflowDispatch, 'inputs')
    const concurrency = getObject(workflow, 'concurrency')
    const jobs = getObject(workflow, 'jobs')
    const publish = getObject(jobs, 'publish')
    const publishSteps = getSteps(publish)
    const runCommands = getRunCommands(publish)
    const publishCommands = publishSteps.filter(
      step => typeof step.run === 'string' && step.run.includes('ci-publish'),
    )
    const inlineReleaseCommands = publishSteps.filter(
      step =>
        typeof step.run === 'string' && RELEASE_CLI_PATTERN.test(step.run),
    )
    const checkout = getActionStep(publish, CHECKOUT_ACTION_REF)
    const install = getSteps(publish).find(
      step => step.run === 'pnpm install --frozen-lockfile',
    )
    const publishStep = getNamedStep(publish, 'Publish package')
    const verifyPublished = getNamedStep(publish, 'Verify published packages')
    const verifyTag = getNamedStep(publish, 'Verify release tag')
    const verifyContext = getNamedStep(publish, 'Verify dispatch context')

    expect(Object.keys(triggers)).toEqual([
      'workflow_call',
      'workflow_dispatch',
    ])
    expect(Object.keys(jobs)).toEqual(['publish'])
    expect(publish.if).toBeUndefined()
    expect(publishCommands).toHaveLength(1)
    expect(inlineReleaseCommands).toHaveLength(0)
    expect(getObject(inputs, 'version')).toEqual({
      required: true,
      type: 'string',
    })
    expect(getObject(inputs, 'tag')).toEqual({
      required: true,
      type: 'string',
    })
    expect(getObject(inputs, 'release_sha')).toEqual({
      required: true,
      type: 'string',
    })
    expect(dispatchInputs).toEqual({
      version: {
        description: 'Release version without the v prefix',
        required: true,
        type: 'string',
      },
      tag: {
        description: 'npm dist-tag',
        required: true,
        type: 'choice',
        options: ['beta', 'latest'],
      },
      release_sha: {
        description: 'Immutable release commit SHA',
        required: true,
        type: 'string',
      },
    })
    expect(getObject(secrets, 'NPM_PUBLISH_TOKEN')).toEqual({ required: true })
    expect(concurrency).toEqual({
      group: `publish-${githubExpression(
        'github.repository',
      )}-${githubExpression('inputs.tag')}`,
      'cancel-in-progress': false,
    })
    expect(getObject(publish, 'permissions')).toEqual({
      contents: 'read',
      'id-token': 'write',
    })
    expect(getActionRefs(publish)).toEqual(RELEASE_ACTION_REFS)
    expect(publish.environment).toBe('Release')
    expect(String(verifyContext.run).trim()).toBe(
      [
        'test "$GITHUB_REF" = "refs/tags/v$VERSION"',
        'test "$GITHUB_SHA" = "$RELEASE_SHA"',
      ].join('\n'),
    )
    expect(getObject(verifyContext, 'env')).toEqual({
      VERSION: githubExpression('inputs.version'),
      RELEASE_SHA: githubExpression('inputs.release_sha'),
    })
    expect(getObject(checkout, 'with')).toEqual({
      'fetch-depth': 0,
      ref: githubExpression('inputs.release_sha'),
      'persist-credentials': false,
    })
    expect(String(verifyTag.run).trim()).toBe(
      [
        'test "$(git rev-parse HEAD)" = "$RELEASE_SHA"',
        `test "$(git rev-parse "refs/tags/v${shellVariable('VERSION')}^{commit}")" = "$RELEASE_SHA"`,
      ].join('\n'),
    )
    expect(getObject(verifyTag, 'env')).toEqual({
      VERSION: githubExpression('inputs.version'),
      RELEASE_SHA: githubExpression('inputs.release_sha'),
    })
    expect(install).toBeDefined()
    expect(runCommands).toEqual([
      [
        'test "$GITHUB_REF" = "refs/tags/v$VERSION"',
        'test "$GITHUB_SHA" = "$RELEASE_SHA"',
      ].join('\n'),
      [
        'test "$(git rev-parse HEAD)" = "$RELEASE_SHA"',
        `test "$(git rev-parse "refs/tags/v${shellVariable('VERSION')}^{commit}")" = "$RELEASE_SHA"`,
      ].join('\n'),
      'pnpm install --frozen-lockfile',
      'pnpm build',
      'pnpm check:build-output',
      'pnpm release:verify:pack',
      'pnpm run ci-publish --version "$VERSION" --tag "$TAG"',
      'pnpm release:verify:published --version "$VERSION" --tag "$TAG"',
    ])
    expect(publishStep.run).toBe(
      'pnpm run ci-publish --version "$VERSION" --tag "$TAG"',
    )
    expect(getObject(publishStep, 'env')).toEqual({
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
      NODE_AUTH_TOKEN: githubExpression('secrets.NPM_PUBLISH_TOKEN'),
    })
    expect(verifyPublished.run).toBe(
      'pnpm release:verify:published --version "$VERSION" --tag "$TAG"',
    )
    expect(getObject(verifyPublished, 'env')).toEqual({
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
    })
    expect(source).not.toContain('npm@latest')
    expect(source).not.toContain('npm i -g')
    expect(source).not.toContain('default@')
    expect(source).not.toContain('--tag latest')
    expect(source).not.toMatch(/uses:\s+\S+@v\d/)
  })

  it('removes npm dist-tags through the protected Release environment', () => {
    const { source, workflow } = readWorkflow('npm-dist-tag.yml')
    const triggers = getObject(workflow, 'on')
    const workflowDispatch = getObject(triggers, 'workflow_dispatch')
    const inputs = getObject(workflowDispatch, 'inputs')
    const jobs = getObject(workflow, 'jobs')
    const remove = getObject(jobs, 'remove')
    const verifyContext = getNamedStep(remove, 'Verify dispatch context')
    const checkout = getActionStep(remove, CHECKOUT_ACTION_REF)
    const removeTag = getNamedStep(remove, 'Remove npm dist-tag')

    expect(Object.keys(triggers)).toEqual(['workflow_dispatch'])
    expect(inputs).toEqual({
      version: {
        description: 'Published version that currently owns the tag',
        required: true,
        type: 'string',
      },
      tag: {
        description: 'npm dist-tag to remove',
        required: true,
        type: 'choice',
        options: ['latest'],
      },
    })
    expect(Object.keys(jobs)).toEqual(['remove'])
    expect(remove.environment).toBe('Release')
    expect(getObject(remove, 'permissions')).toEqual({ contents: 'read' })
    expect(getActionRefs(remove)).toEqual(RELEASE_ACTION_REFS)
    expect(getObject(remove, 'env')).toEqual({
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
    })
    expect(verifyContext.run).toBe('test "$GITHUB_REF" = "refs/heads/main"')
    expect(getObject(checkout, 'with')).toEqual({
      ref: 'main',
      'persist-credentials': false,
    })
    expect(getRunCommands(remove)).toEqual([
      'test "$GITHUB_REF" = "refs/heads/main"',
      'pnpm install --frozen-lockfile',
      'pnpm npm:dist-tag:remove --version "$VERSION" --tag "$TAG"',
    ])
    expect(getObject(removeTag, 'env')).toEqual({
      NODE_AUTH_TOKEN: githubExpression('secrets.NPM_PUBLISH_TOKEN'),
    })
    expect(source).not.toMatch(/uses:\s+\S+@v\d/)
  })
})
