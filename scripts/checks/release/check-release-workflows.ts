import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { parse } from 'yaml'

interface WorkflowObject {
  [key: string]: unknown
}

export const CHECKOUT_ACTION_REF =
  'actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09'
export const PNPM_SETUP_ACTION_REF =
  'pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1'
export const SETUP_NODE_ACTION_REF =
  'actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444'

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

function getObject(
  parent: WorkflowObject,
  key: string,
  label: string,
): WorkflowObject {
  return asObject(parent[key], `${label}.${key}`)
}

function getSteps(job: WorkflowObject, label: string): WorkflowObject[] {
  const steps = job.steps

  if (!Array.isArray(steps)) {
    throw new TypeError(`${label}.steps must be an array`)
  }

  return steps.map((step, index) => asObject(step, `${label}.steps[${index}]`))
}

function getActionRefs(job: WorkflowObject, label: string): string[] {
  return getSteps(job, label)
    .filter(step => typeof step.uses === 'string')
    .map(step => String(step.uses))
}

function getRunCommands(job: WorkflowObject, label: string): string[] {
  return getSteps(job, label)
    .filter(step => typeof step.run === 'string')
    .map(step => String(step.run).trim())
}

export function githubExpression(value: string): string {
  const dollar = String.fromCharCode(36)
  return `${dollar}{{ ${value} }}`
}

export function shellVariable(value: string): string {
  const dollar = String.fromCharCode(36)
  return `${dollar}{${value}}`
}

function getNamedStep(
  job: WorkflowObject,
  name: string,
  label: string,
): WorkflowObject {
  const step = getSteps(job, label).find(candidate => candidate.name === name)

  if (!step) throw new Error(`${label} must contain step "${name}"`)

  return step
}

function getActionStep(
  job: WorkflowObject,
  action: string,
  label: string,
): WorkflowObject {
  const step = getSteps(job, label).find(candidate => candidate.uses === action)

  if (!step) throw new Error(`${label} must contain action "${action}"`)

  return step
}

function readWorkflow(
  root: string,
  name: string,
): {
  source: string
  workflow: WorkflowObject
} {
  const source = readFileSync(
    resolve(root, `.github/workflows/${name}`),
    'utf-8',
  )

  return {
    source,
    workflow: asObject(parse(source) as unknown, name),
  }
}

function formatValue(value: unknown): string {
  const serialized = JSON.stringify(value)
  return serialized === undefined ? String(value) : serialized
}

function expectEqual(
  actual: unknown,
  expected: unknown,
  label: string,
  errors: string[],
): void {
  if (!isDeepStrictEqual(actual, expected)) {
    errors.push(
      `${label} must be ${formatValue(expected)}. Found: ${formatValue(actual)}`,
    )
  }
}

function expectContains(
  source: string,
  expected: string,
  label: string,
  errors: string[],
): void {
  if (!source.includes(expected)) {
    errors.push(`${label} must contain "${expected}"`)
  }
}

function expectNotContains(
  source: string,
  forbidden: string,
  label: string,
  errors: string[],
): void {
  if (source.includes(forbidden)) {
    errors.push(`${label} must not contain "${forbidden}"`)
  }
}

function checkReleaseWorkflow(root: string, errors: string[]): void {
  const { source, workflow } = readWorkflow(root, 'release.yml')
  const triggers = getObject(workflow, 'on', 'release')
  const workflowDispatch = getObject(
    triggers,
    'workflow_dispatch',
    'release.on',
  )
  const inputs = getObject(
    workflowDispatch,
    'inputs',
    'release.on.workflow_dispatch',
  )
  const jobs = getObject(workflow, 'jobs', 'release')
  const validateContext = getObject(jobs, 'validate-context', 'release.jobs')
  const dryRunJob = getObject(jobs, 'dry-run', 'release.jobs')
  const release = getObject(jobs, 'release', 'release.jobs')
  const dispatchPublish = getObject(jobs, 'dispatch-publish', 'release.jobs')
  const validateContextSteps = getSteps(
    validateContext,
    'release.jobs.validate-context',
  )
  const dryRunSteps = getSteps(dryRunJob, 'release.jobs.dry-run')
  const releaseSteps = getSteps(release, 'release.jobs.release')
  const dispatchPublishSteps = getSteps(
    dispatchPublish,
    'release.jobs.dispatch-publish',
  )
  const dryRunCommands = dryRunSteps.filter(
    step => typeof step.run === 'string' && RELEASE_CLI_PATTERN.test(step.run),
  )
  const releaseCommands = releaseSteps.filter(
    step => typeof step.run === 'string' && RELEASE_CLI_PATTERN.test(step.run),
  )
  const inlinePublishCommands = validateContextSteps
    .concat(dryRunSteps, releaseSteps, dispatchPublishSteps)
    .filter(
      step => typeof step.run === 'string' && step.run.includes('ci-publish'),
    )
  const dryRunInstallSteps = dryRunSteps.filter(
    step => step.run === 'pnpm install --frozen-lockfile',
  )
  const releaseInstallSteps = releaseSteps.filter(
    step => step.run === 'pnpm install --frozen-lockfile',
  )
  const dryRunCheckout = getActionStep(
    dryRunJob,
    CHECKOUT_ACTION_REF,
    'release.jobs.dry-run',
  )
  const validateContextStep = getNamedStep(
    validateContext,
    'Verify release context',
    'release.jobs.validate-context',
  )
  const checkout = getActionStep(
    release,
    CHECKOUT_ACTION_REF,
    'release.jobs.release',
  )
  const dryRunRevision = getNamedStep(
    dryRunJob,
    'Verify dispatch revision',
    'release.jobs.dry-run',
  )
  const revision = getNamedStep(
    release,
    'Verify dispatch revision',
    'release.jobs.release',
  )
  const dryRun = getNamedStep(
    dryRunJob,
    'Dry-run release',
    'release.jobs.dry-run',
  )
  const gitIdentity = getNamedStep(
    release,
    'Configure Git identity',
    'release.jobs.release',
  )
  const realRelease = getNamedStep(release, 'Release', 'release.jobs.release')
  const captureRelease = getNamedStep(
    release,
    'Capture release commit',
    'release.jobs.release',
  )
  const dispatchPublishStep = getNamedStep(
    dispatchPublish,
    'Dispatch publish workflow',
    'release.jobs.dispatch-publish',
  )

  expectEqual(
    Object.keys(triggers),
    ['workflow_dispatch'],
    'release.on triggers',
    errors,
  )
  expectEqual(
    Object.keys(jobs),
    ['validate-context', 'dry-run', 'release', 'dispatch-publish'],
    'release.jobs',
    errors,
  )
  expectEqual(
    dryRunCommands.length,
    1,
    'release.jobs.dry-run pnpm release step count',
    errors,
  )
  expectEqual(
    releaseCommands.length,
    1,
    'release.jobs.release pnpm release step count',
    errors,
  )
  expectEqual(
    inlinePublishCommands.length,
    0,
    'release.jobs.release ci-publish step count',
    errors,
  )
  expectEqual(
    getObject(inputs, 'version', 'release.on.workflow_dispatch.inputs'),
    {
      description: 'Release version, for example 0.1.0-beta.0 or 0.1.0',
      required: true,
      type: 'string',
    },
    'release.on.workflow_dispatch.inputs.version',
    errors,
  )
  expectEqual(
    getObject(inputs, 'tag', 'release.on.workflow_dispatch.inputs'),
    {
      description: 'npm dist-tag',
      required: true,
      default: 'beta',
      type: 'choice',
      options: ['beta', 'latest'],
    },
    'release.on.workflow_dispatch.inputs.tag',
    errors,
  )
  expectEqual(
    getObject(inputs, 'dry_run', 'release.on.workflow_dispatch.inputs'),
    {
      description: 'Run with --dry-run (no commit, no publish)',
      required: true,
      default: true,
      type: 'boolean',
    },
    'release.on.workflow_dispatch.inputs.dry_run',
    errors,
  )
  expectEqual(
    getObject(workflow, 'permissions', 'release'),
    { contents: 'read' },
    'release.permissions',
    errors,
  )
  expectEqual(
    getObject(workflow, 'concurrency', 'release'),
    {
      group: `release-${githubExpression('github.repository')}`,
      'cancel-in-progress': false,
    },
    'release.concurrency',
    errors,
  )
  expectEqual(
    validateContext['runs-on'],
    'ubuntu-latest',
    'release.jobs.validate-context.runs-on',
    errors,
  )
  expectEqual(
    getObject(validateContext, 'permissions', 'release.jobs.validate-context'),
    {},
    'release.jobs.validate-context.permissions',
    errors,
  )
  expectEqual(
    getActionRefs(validateContext, 'release.jobs.validate-context'),
    [],
    'release.jobs.validate-context action refs',
    errors,
  )
  expectEqual(
    validateContextStep.run,
    'test "$GITHUB_REF" = "refs/heads/main"',
    'release.jobs.validate-context.steps.Verify release context.run',
    errors,
  )
  expectEqual(
    dryRunJob.needs,
    'validate-context',
    'release.jobs.dry-run.needs',
    errors,
  )
  expectEqual(
    dryRunJob.if,
    githubExpression(
      "github.ref == 'refs/heads/main' && inputs.dry_run == true",
    ),
    'release.jobs.dry-run.if',
    errors,
  )
  expectEqual(
    getObject(dryRunJob, 'permissions', 'release.jobs.dry-run'),
    { contents: 'read' },
    'release.jobs.dry-run.permissions',
    errors,
  )
  expectEqual(
    getObject(dryRunJob, 'env', 'release.jobs.dry-run'),
    {
      PUPPETEER_SKIP_DOWNLOAD: 'true',
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
    },
    'release.jobs.dry-run.env',
    errors,
  )
  expectEqual(
    getActionRefs(dryRunJob, 'release.jobs.dry-run'),
    RELEASE_ACTION_REFS,
    'release.jobs.dry-run action refs',
    errors,
  )
  expectEqual(
    getObject(dryRunCheckout, 'with', 'release.jobs.dry-run.checkout'),
    {
      'fetch-depth': 0,
      ref: 'main',
      'persist-credentials': false,
    },
    'release.jobs.dry-run.checkout.with',
    errors,
  )
  expectEqual(
    dryRunRevision.run,
    'test "$(git rev-parse HEAD)" = "$GITHUB_SHA"',
    'release.jobs.dry-run.steps.Verify dispatch revision.run',
    errors,
  )
  expectEqual(
    dryRunInstallSteps.length,
    1,
    'release.jobs.dry-run frozen install step count',
    errors,
  )
  expectEqual(
    String(dryRun.run).trim(),
    'pnpm release "$VERSION" --tag "$TAG" --dry',
    'release.jobs.dry-run.steps.Dry-run release.run',
    errors,
  )
  expectNotContains(
    JSON.stringify(dryRunJob),
    'NPM_TOKEN',
    'release.jobs.dry-run',
    errors,
  )
  expectNotContains(
    JSON.stringify(dryRunJob),
    'NODE_AUTH_TOKEN',
    'release.jobs.dry-run',
    errors,
  )

  expectEqual(
    release.needs,
    'validate-context',
    'release.jobs.release.needs',
    errors,
  )
  expectEqual(
    release.if,
    githubExpression(
      "github.ref == 'refs/heads/main' && inputs.dry_run == false",
    ),
    'release.jobs.release.if',
    errors,
  )
  expectEqual(
    getObject(release, 'permissions', 'release.jobs.release'),
    { contents: 'write' },
    'release.jobs.release.permissions',
    errors,
  )
  expectEqual(
    getObject(release, 'outputs', 'release.jobs.release'),
    {
      release_sha: githubExpression('steps.release_commit.outputs.sha'),
    },
    'release.jobs.release.outputs',
    errors,
  )
  expectEqual(
    getObject(release, 'env', 'release.jobs.release'),
    {
      PUPPETEER_SKIP_DOWNLOAD: 'true',
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
    },
    'release.jobs.release.env',
    errors,
  )
  expectEqual(
    getActionRefs(release, 'release.jobs.release'),
    RELEASE_ACTION_REFS,
    'release.jobs.release action refs',
    errors,
  )
  expectEqual(
    getObject(checkout, 'with', 'release.jobs.release.checkout'),
    { 'fetch-depth': 0, ref: 'main' },
    'release.jobs.release.checkout.with',
    errors,
  )
  expectEqual(
    revision.run,
    'test "$(git rev-parse HEAD)" = "$GITHUB_SHA"',
    'release.jobs.release.steps.Verify dispatch revision.run',
    errors,
  )
  expectEqual(
    releaseInstallSteps.length,
    1,
    'release.jobs.release frozen install step count',
    errors,
  )
  expectEqual(
    gitIdentity.if,
    undefined,
    'release.jobs.release.steps.Configure Git identity.if',
    errors,
  )
  expectContains(
    String(gitIdentity.run),
    'git config user.name "github-actions[bot]"',
    'release.jobs.release.steps.Configure Git identity.run',
    errors,
  )
  expectContains(
    String(gitIdentity.run),
    'git config user.email "41898282+github-actions[bot]@users.noreply.github.com"',
    'release.jobs.release.steps.Configure Git identity.run',
    errors,
  )
  expectEqual(
    realRelease.if,
    undefined,
    'release.jobs.release.steps.Release.if',
    errors,
  )
  expectEqual(
    realRelease.run,
    'pnpm release "$VERSION" --tag "$TAG"',
    'release.jobs.release.steps.Release.run',
    errors,
  )
  expectEqual(
    captureRelease.id,
    'release_commit',
    'release.jobs.release.steps.Capture release commit.id',
    errors,
  )
  expectEqual(
    String(captureRelease.run).trim(),
    [
      `release_sha="$(git rev-parse "refs/tags/v${shellVariable('VERSION')}^{commit}")"`,
      'test "$(git rev-parse HEAD)" = "$release_sha"',
      'echo "sha=$release_sha" >> "$GITHUB_OUTPUT"',
    ].join('\n'),
    'release.jobs.release.steps.Capture release commit.run',
    errors,
  )
  expectNotContains(
    JSON.stringify(release),
    'NPM_TOKEN',
    'release.jobs.release',
    errors,
  )
  expectNotContains(
    JSON.stringify(release),
    'NODE_AUTH_TOKEN',
    'release.jobs.release',
    errors,
  )

  expectEqual(
    dispatchPublish.needs,
    'release',
    'release.jobs.dispatch-publish.needs',
    errors,
  )
  expectEqual(
    dispatchPublish.if,
    githubExpression(
      "github.ref == 'refs/heads/main' && inputs.dry_run == false",
    ),
    'release.jobs.dispatch-publish.if',
    errors,
  )
  expectEqual(
    dispatchPublish['runs-on'],
    'ubuntu-latest',
    'release.jobs.dispatch-publish.runs-on',
    errors,
  )
  expectEqual(
    getObject(dispatchPublish, 'permissions', 'release.jobs.dispatch-publish'),
    { actions: 'write', contents: 'read' },
    'release.jobs.dispatch-publish.permissions',
    errors,
  )
  expectEqual(
    getObject(dispatchPublish, 'env', 'release.jobs.dispatch-publish'),
    {
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
      RELEASE_SHA: githubExpression('needs.release.outputs.release_sha'),
    },
    'release.jobs.dispatch-publish.env',
    errors,
  )
  expectEqual(
    getActionRefs(dispatchPublish, 'release.jobs.dispatch-publish'),
    [],
    'release.jobs.dispatch-publish action refs',
    errors,
  )
  expectEqual(
    String(dispatchPublishStep.run).trim(),
    [
      'gh workflow run publish.yml \\',
      '  --repo "$GITHUB_REPOSITORY" \\',
      '  --ref "v$VERSION" \\',
      '  --raw-field version="$VERSION" \\',
      '  --raw-field tag="$TAG" \\',
      '  --raw-field release_sha="$RELEASE_SHA"',
    ].join('\n'),
    'release.jobs.dispatch-publish.steps.Dispatch publish workflow.run',
    errors,
  )
  expectEqual(
    getObject(
      dispatchPublishStep,
      'env',
      'release.jobs.dispatch-publish.steps.Dispatch publish workflow',
    ),
    { GH_TOKEN: githubExpression('github.token') },
    'release.jobs.dispatch-publish.steps.Dispatch publish workflow.env',
    errors,
  )
  expectNotContains(source, 'github.event.inputs', 'release.yml', errors)
  expectNotContains(source, 'secrets: inherit', 'release.yml', errors)
  expectNotContains(source, 'NPM_PUBLISH_TOKEN', 'release.yml', errors)
  expectNotContains(source, 'default@', 'release.yml', errors)
}

function checkPublishWorkflow(root: string, errors: string[]): void {
  const { source, workflow } = readWorkflow(root, 'publish.yml')
  const triggers = getObject(workflow, 'on', 'publish')
  const workflowCall = getObject(triggers, 'workflow_call', 'publish.on')
  const inputs = getObject(workflowCall, 'inputs', 'publish.on.workflow_call')
  const secrets = getObject(workflowCall, 'secrets', 'publish.on.workflow_call')
  const workflowDispatch = getObject(
    triggers,
    'workflow_dispatch',
    'publish.on',
  )
  const dispatchInputs = getObject(
    workflowDispatch,
    'inputs',
    'publish.on.workflow_dispatch',
  )
  const jobs = getObject(workflow, 'jobs', 'publish')
  const publish = getObject(jobs, 'publish', 'publish.jobs')
  const publishSteps = getSteps(publish, 'publish.jobs.publish')
  const runCommands = getRunCommands(publish, 'publish.jobs.publish')
  const publishCommands = publishSteps.filter(
    step => typeof step.run === 'string' && step.run.includes('ci-publish'),
  )
  const inlineReleaseCommands = publishSteps.filter(
    step => typeof step.run === 'string' && RELEASE_CLI_PATTERN.test(step.run),
  )
  const checkout = getActionStep(
    publish,
    CHECKOUT_ACTION_REF,
    'publish.jobs.publish',
  )
  const publishStep = getNamedStep(
    publish,
    'Publish package',
    'publish.jobs.publish',
  )
  const verifyTag = getNamedStep(
    publish,
    'Verify release tag',
    'publish.jobs.publish',
  )
  const verifyContext = getNamedStep(
    publish,
    'Verify dispatch context',
    'publish.jobs.publish',
  )
  const installSteps = getSteps(publish, 'publish.jobs.publish').filter(
    step => step.run === 'pnpm install --frozen-lockfile',
  )

  expectEqual(
    Object.keys(triggers),
    ['workflow_call', 'workflow_dispatch'],
    'publish.on triggers',
    errors,
  )
  expectEqual(Object.keys(jobs), ['publish'], 'publish.jobs', errors)
  expectEqual(publish.if, undefined, 'publish.jobs.publish.if', errors)
  expectEqual(
    publishCommands.length,
    1,
    'publish.jobs.publish ci-publish step count',
    errors,
  )
  expectEqual(
    inlineReleaseCommands.length,
    0,
    'publish.jobs.publish pnpm release step count',
    errors,
  )
  expectEqual(
    getObject(inputs, 'version', 'publish.on.workflow_call.inputs'),
    { required: true, type: 'string' },
    'publish.on.workflow_call.inputs.version',
    errors,
  )
  expectEqual(
    getObject(inputs, 'tag', 'publish.on.workflow_call.inputs'),
    { required: true, type: 'string' },
    'publish.on.workflow_call.inputs.tag',
    errors,
  )
  expectEqual(
    getObject(inputs, 'release_sha', 'publish.on.workflow_call.inputs'),
    { required: true, type: 'string' },
    'publish.on.workflow_call.inputs.release_sha',
    errors,
  )
  expectEqual(
    dispatchInputs,
    {
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
    },
    'publish.on.workflow_dispatch.inputs',
    errors,
  )
  expectEqual(
    getObject(secrets, 'NPM_PUBLISH_TOKEN', 'publish.on.workflow_call.secrets'),
    { required: true },
    'publish.on.workflow_call.secrets.NPM_PUBLISH_TOKEN',
    errors,
  )
  expectEqual(
    getObject(workflow, 'concurrency', 'publish'),
    {
      group: `publish-${githubExpression(
        'github.repository',
      )}-${githubExpression('inputs.tag')}`,
      'cancel-in-progress': false,
    },
    'publish.concurrency',
    errors,
  )
  expectEqual(
    getObject(publish, 'permissions', 'publish.jobs.publish'),
    { contents: 'read', 'id-token': 'write' },
    'publish.jobs.publish.permissions',
    errors,
  )
  expectEqual(
    getActionRefs(publish, 'publish.jobs.publish'),
    RELEASE_ACTION_REFS,
    'publish.jobs.publish action refs',
    errors,
  )
  expectEqual(
    publish.environment,
    'Release',
    'publish.jobs.publish.environment',
    errors,
  )
  expectEqual(
    String(verifyContext.run).trim(),
    [
      'test "$GITHUB_REF" = "refs/tags/v$VERSION"',
      'test "$GITHUB_SHA" = "$RELEASE_SHA"',
    ].join('\n'),
    'publish.jobs.publish.steps.Verify dispatch context.run',
    errors,
  )
  expectEqual(
    getObject(
      verifyContext,
      'env',
      'publish.jobs.publish.steps.Verify dispatch context',
    ),
    {
      VERSION: githubExpression('inputs.version'),
      RELEASE_SHA: githubExpression('inputs.release_sha'),
    },
    'publish.jobs.publish.steps.Verify dispatch context.env',
    errors,
  )
  expectEqual(
    getObject(checkout, 'with', 'publish.jobs.publish.checkout'),
    {
      'fetch-depth': 0,
      ref: githubExpression('inputs.release_sha'),
      'persist-credentials': false,
    },
    'publish.jobs.publish.checkout.with',
    errors,
  )
  expectEqual(
    String(verifyTag.run).trim(),
    [
      'test "$(git rev-parse HEAD)" = "$RELEASE_SHA"',
      `test "$(git rev-parse "refs/tags/v${shellVariable('VERSION')}^{commit}")" = "$RELEASE_SHA"`,
    ].join('\n'),
    'publish.jobs.publish.steps.Verify release tag.run',
    errors,
  )
  expectEqual(
    getObject(
      verifyTag,
      'env',
      'publish.jobs.publish.steps.Verify release tag',
    ),
    {
      VERSION: githubExpression('inputs.version'),
      RELEASE_SHA: githubExpression('inputs.release_sha'),
    },
    'publish.jobs.publish.steps.Verify release tag.env',
    errors,
  )
  expectEqual(
    installSteps.length,
    1,
    'publish.jobs.publish frozen install step count',
    errors,
  )
  expectEqual(
    runCommands,
    [
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
    ],
    'publish.jobs.publish run command order',
    errors,
  )
  expectEqual(
    publishStep.run,
    'pnpm run ci-publish --version "$VERSION" --tag "$TAG"',
    'publish.jobs.publish.steps.Publish package.run',
    errors,
  )
  expectEqual(
    getObject(publishStep, 'env', 'publish.jobs.publish.steps.Publish package'),
    {
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
      NODE_AUTH_TOKEN: githubExpression('secrets.NPM_PUBLISH_TOKEN'),
    },
    'publish.jobs.publish.steps.Publish package.env',
    errors,
  )
  expectNotContains(source, 'npm@latest', 'publish.yml', errors)
  expectNotContains(source, 'npm i -g', 'publish.yml', errors)
  expectNotContains(source, 'default@', 'publish.yml', errors)
  expectNotContains(source, '--tag latest', 'publish.yml', errors)
}

export function checkReleaseWorkflowContract(root = process.cwd()): string[] {
  const errors: string[] = []

  try {
    checkReleaseWorkflow(root, errors)
    checkPublishWorkflow(root, errors)
  } catch (error) {
    errors.push(
      `Release workflow contract could not be read: ${(error as Error).message}`,
    )
  }

  return errors
}
