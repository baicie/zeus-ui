import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parse } from 'yaml'

import {
  CHECKOUT_ACTION_REF,
  githubExpression,
  PAIRING_MODE_GUARD,
  pairingCommand,
  PNPM_SETUP_ACTION_REF,
  publishPreflightCommand,
  RELEASE_DIST_TAGS,
  releaseChannelScript,
  revalidateReleaseTagScript,
  SETUP_NODE_ACTION_REF,
  shellVariable,
  staticPairingCommand,
  UPLOAD_ARTIFACT_ACTION_REF,
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

function getStepOrder(job: WorkflowObject): string[] {
  return getSteps(job).map((step, index) => {
    if (typeof step.name === 'string') return step.name
    if (typeof step.uses === 'string') return step.uses
    if (typeof step.run === 'string') return String(step.run).trim()

    throw new Error(`steps[${index}] must have name, uses, or run`)
  })
}

function expectFailClosedStep(step: WorkflowObject): void {
  expect(step.if).toBeUndefined()
  expect(step['continue-on-error']).toBeUndefined()
  expect(step.shell).toBeUndefined()
}

function expectFailClosedRunSteps(job: WorkflowObject): void {
  expect(job.defaults).toBeUndefined()
  expect(job['continue-on-error']).toBeUndefined()

  getSteps(job)
    .filter(step => typeof step.run === 'string')
    .forEach(expectFailClosedStep)
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
  it('uses the patched Sigstore verifier dependency', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'),
    ) as {
      devDependencies: Record<string, string>
      engines: Record<string, string>
    }
    const workspace = asObject(
      parse(
        readFileSync(resolve(process.cwd(), 'pnpm-workspace.yaml'), 'utf-8'),
      ) as unknown,
      'pnpm-workspace.yaml',
    )
    const overrides = getObject(workspace, 'overrides')

    expect(packageJson.devDependencies.sigstore).toBe('4.1.1')
    expect(packageJson.engines.node).toBe('^22.18.0 || >=24.11.0')
    expect(overrides).not.toHaveProperty('@sigstore/protobuf-specs')
  })

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
    expect(packageJson.scripts['release:capture:latest']).toBe(
      'tsx scripts/checks/release/capture-published-latest.ts',
    )
    expect(
      existsSync(
        resolve(
          process.cwd(),
          'scripts/checks/release/capture-published-latest.ts',
        ),
      ),
    ).toBe(true)
    expect(packageJson.scripts['check:phase24-release']).toBe(
      'tsx scripts/checks/release/check-phase24-release.ts',
    )
    expect(packageJson.scripts['version:packages']).toBe(
      'tsx scripts/commands/version-packages.ts',
    )
    expect(packageJson.scripts['ci-publish']).toBe(
      'tsx scripts/commands/publish.ts',
    )
    expect(packageJson.scripts['npm:dist-tag:remove']).toBeUndefined()
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
    const coreVersionInput = getObject(inputs, 'core_version')
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
    const validateChannelStep = getNamedStep(
      validateContext,
      'Verify release channel',
    )
    const dryRunRevision = getNamedStep(dryRunJob, 'Verify dispatch revision')
    const revision = getNamedStep(release, 'Verify dispatch revision')
    const dryRun = getNamedStep(dryRunJob, 'Dry-run release')
    const dryRunPairing = getNamedStep(
      dryRunJob,
      'Verify Core version alignment (static)',
    )
    const realRelease = getNamedStep(release, 'Verify prepared release')
    const tagRelease = getNamedStep(release, 'Tag release')
    const pairingStep = getNamedStep(
      release,
      'Verify immutable Core/UI pairing',
    )
    const coreImmutableStep = getNamedStep(
      dispatchPublish,
      'Verify the Core release is immutable',
    )
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
    // The publishing job must not re-run the release CLI: the version has to be
    // committed on main before dispatch so the tag can point at the dispatch
    // revision. It asserts the manifests already carry the release version.
    expect(releaseCommands).toHaveLength(0)
    expect(inlinePublishCommands).toHaveLength(0)
    expect(versionInput).toEqual({
      description:
        'Release version, for example 0.1.0-beta.0, 0.2.0-rc.0 or 0.2.0',
      required: true,
      type: 'string',
    })
    expect(coreVersionInput).toEqual({
      description:
        'The Zeus Core version this UI release was verified against, for example 0.2.0-rc.5. Required, and never derived from version.',
      required: true,
      type: 'string',
    })
    expect(tagInput).toEqual({
      description: 'npm dist-tag',
      required: true,
      default: 'beta',
      type: 'choice',
      options: [...RELEASE_DIST_TAGS],
    })
    expect(dryRunInput).toEqual({
      description: 'Run with --dry-run (no commit, no publish)',
      required: true,
      default: true,
      type: 'boolean',
    })
    expect(getObject(workflow, 'permissions')).toEqual({ contents: 'read' })
    expect(workflow.defaults).toBeUndefined()
    expect(concurrency).toEqual({
      group: `release-${githubExpression('github.repository')}`,
      'cancel-in-progress': false,
    })
    expect(validateContext['runs-on']).toBe('ubuntu-latest')
    expect(getObject(validateContext, 'permissions')).toEqual({})
    // The channel job checks out nothing, so the shell rule stays self-contained.
    expect(getActionRefs(validateContext)).toEqual([])
    expect(getObject(validateContext, 'env')).toEqual({
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
    })
    expect(validateContextStep.run).toBe(
      'test "$GITHUB_REF" = "refs/heads/main"',
    )
    expect(String(validateChannelStep.run).trim()).toBe(releaseChannelScript())
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
      CORE_VERSION: githubExpression('inputs.core_version'),
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
    expect(String(dryRunPairing.run).trim()).toBe(staticPairingCommand())
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
      release_sha: githubExpression('steps.tag_release.outputs.sha'),
      /*
       * The output that used to be referenced without a producer. It now names
       * the hyphenated key the step actually writes, and `pairing_mode` travels
       * beside it so a static report cannot be mistaken for an online one.
       */
      core_commit: githubExpression('steps.pairing_core.outputs.core-commit'),
      core_tag: githubExpression('steps.pairing_core.outputs.core-tag'),
      pairing_mode: githubExpression('steps.pairing_core.outputs.mode'),
      channel: githubExpression('steps.pairing_core.outputs.channel'),
    })
    expect(getObject(release, 'env')).toEqual({
      PUPPETEER_SKIP_DOWNLOAD: 'true',
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
    })
    expect(getActionRefs(release)).toEqual([
      ...RELEASE_ACTION_REFS,
      UPLOAD_ARTIFACT_ACTION_REF,
    ])
    expect(getObject(checkout, 'with')).toEqual({
      'fetch-depth': 0,
      ref: 'main',
      'persist-credentials': false,
    })
    expect(revision.run).toBe('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"')
    expect(realRelease.if).toBeUndefined()
    const realReleaseRun = String(realRelease.run)
    // The version is asserted against the committed manifest rather than bumped
    // here, because the tag below must point at the dispatch revision.
    expect(realReleaseRun).toContain('pkg.version !== process.env.VERSION')
    expect(realReleaseRun).not.toMatch(/pnpm release .*--skipGit/)
    expect(
      realReleaseRun.match(/test -z "\$\(git status --porcelain\)"/g),
    ).toHaveLength(2)
    expect(String(tagRelease.run).trim()).toBe(
      [
        'release_sha="$(git rev-parse HEAD)"',
        'tag_api="repos/$GITHUB_REPOSITORY/git/ref/tags/v$VERSION"',
        '',
        'test "$release_sha" = "$GITHUB_SHA"',
        'main_sha="$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq \'.object.sha\')"',
        'test "$main_sha" = "$release_sha"',
        '',
        'if tag_sha="$(gh api "$tag_api" --jq \'.object.sha\' 2>/dev/null)"; then',
        '  test "$tag_sha" = "$release_sha"',
        'else',
        '  gh api --method POST "repos/$GITHUB_REPOSITORY/git/refs" \\',
        '    --raw-field ref="refs/tags/v$VERSION" \\',
        '    --raw-field sha="$release_sha" >/dev/null',
        'fi',
        '',
        'test "$(gh api "$tag_api" --jq \'.object.sha\')" = "$release_sha"',
        'echo "sha=$release_sha" >> "$GITHUB_OUTPUT"',
      ].join('\n'),
    )
    expect(tagRelease.id).toBe('tag_release')
    expect(getObject(tagRelease, 'env')).toEqual({
      GH_TOKEN: githubExpression('github.token'),
    })
    // Only the two steps that read GitHub state carry the workflow token.
    expect(
      releaseSteps
        .filter(step => JSON.stringify(step.env || '').includes('github.token'))
        .map(step => step.name),
    ).toEqual(['Verify immutable Core/UI pairing', 'Tag release'])
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
      CORE_COMMIT: githubExpression('needs.release.outputs.core_commit'),
      PAIRING_MODE: githubExpression('needs.release.outputs.pairing_mode'),
    })
    expect(getActionRefs(dispatchPublish)).toEqual([])
    expect(String(dispatchPublishStep.run).trim()).toBe(
      [
        'gh workflow run publish.yml \\',
        '  --repo "$GITHUB_REPOSITORY" \\',
        '  --ref "v$VERSION" \\',
        '  --raw-field version="$VERSION" \\',
        '  --raw-field tag="$TAG" \\',
        '  --raw-field release_sha="$RELEASE_SHA" \\',
        '  --raw-field core_version="$CORE_VERSION" \\',
        '  --raw-field core_commit="$CORE_COMMIT" \\',
        '  --raw-field pairing_mode="$PAIRING_MODE"',
      ].join('\n'),
    )
    expect(getObject(dispatchPublishStep, 'env')).toEqual({
      GH_TOKEN: githubExpression('github.token'),
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
      RELEASE_SHA: githubExpression('needs.release.outputs.release_sha'),
      CORE_VERSION: githubExpression('inputs.core_version'),
      CORE_COMMIT: githubExpression('needs.release.outputs.core_commit'),
      PAIRING_MODE: githubExpression('needs.release.outputs.pairing_mode'),
    })
    expect(getStepOrder(validateContext)).toEqual([
      'Verify release context',
      'Verify release channel',
    ])
    expect(getStepOrder(dryRunJob)).toEqual([
      CHECKOUT_ACTION_REF,
      'Verify dispatch revision',
      PNPM_SETUP_ACTION_REF,
      SETUP_NODE_ACTION_REF,
      'pnpm install --frozen-lockfile',
      'Verify Core version alignment (static)',
      'Dry-run release',
    ])
    expect(getStepOrder(release)).toEqual([
      CHECKOUT_ACTION_REF,
      'Verify dispatch revision',
      PNPM_SETUP_ACTION_REF,
      SETUP_NODE_ACTION_REF,
      'pnpm install --frozen-lockfile',
      'Verify prepared release',
      'Verify immutable Core/UI pairing',
      'Preserve pairing evidence',
      'Tag release',
    ])
    expect(getStepOrder(dispatchPublish)).toEqual([
      'Verify the Core release is immutable',
      'Dispatch publish workflow',
    ])
    ;[validateContext, dryRunJob, release, dispatchPublish].forEach(
      expectFailClosedRunSteps,
    )
    expect(getRunCommands(validateContext)).toEqual([
      'test "$GITHUB_REF" = "refs/heads/main"',
      releaseChannelScript(),
    ])
    expect(getRunCommands(dryRunJob)).toEqual([
      'test "$(git rev-parse HEAD)" = "$GITHUB_SHA"',
      'pnpm install --frozen-lockfile',
      staticPairingCommand(),
      'pnpm release "$VERSION" --tag "$TAG" --dry',
    ])
    expect(getRunCommands(release)).toEqual([
      'test "$(git rev-parse HEAD)" = "$GITHUB_SHA"',
      'pnpm install --frozen-lockfile',
      String(realRelease.run).trim(),
      String(pairingStep.run).trim(),
      String(tagRelease.run).trim(),
    ])
    expect(getRunCommands(dispatchPublish)).toEqual([
      String(coreImmutableStep.run).trim(),
      String(dispatchPublishStep.run).trim(),
    ])
    expect(source).not.toContain('github.event.inputs')
    expect(source).not.toContain('secrets: inherit')
    expect(source).not.toContain('NPM_PUBLISH_TOKEN')
    expect(source).not.toContain('default@')
    expect(source).not.toContain('--force')
    expect(source).not.toMatch(/^\s*git tag\s+-d(?:\s|$)/m)
    expect(source).not.toMatch(/^\s*git push\b[^\n]*--delete(?:\s|$)/m)
    expect(source).not.toMatch(/^\s*git push\b[^\n]+refs\/heads\/main/m)
    expect(source).not.toMatch(/^\s+git push\s*$/m)
    expect(source).not.toMatch(/^\s*git push(?:\s|$)/m)
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
    const checkoutIndex = publishSteps.indexOf(checkout)
    const installIndex = publishSteps.findIndex(
      step => step.run === 'pnpm install --frozen-lockfile',
    )
    const captureLatestBaseline = getNamedStep(
      publish,
      'Capture latest dist-tag baseline',
    )
    const publishStep = getNamedStep(publish, 'Publish package')
    const verifyPublished = getNamedStep(publish, 'Verify published packages')
    const verifyTag = getNamedStep(publish, 'Verify release tag')
    const verifyTagIndex = publishSteps.indexOf(verifyTag)
    const revalidateTag = getNamedStep(publish, 'Revalidate release tag')
    const verifyContext = getNamedStep(publish, 'Verify dispatch context')

    expect(Object.keys(triggers)).toEqual([
      'workflow_call',
      'workflow_dispatch',
    ])
    expect(Object.keys(jobs)).toEqual(['publish'])
    expect(workflow.defaults).toBeUndefined()
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
    /*
     * `workflow_call` takes it too. Only `release.yml` dispatches publish
     * today, so nothing exercises this path — which is exactly why the input
     * has to be declared: a future reusable caller would otherwise reach the
     * mode guard with an empty value and be refused for the wrong reason.
     */
    expect(getObject(inputs, 'core_version')).toEqual({
      required: true,
      type: 'string',
    })
    expect(getObject(inputs, 'pairing_mode')).toEqual({
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
        options: [...RELEASE_DIST_TAGS],
      },
      release_sha: {
        description: 'Immutable release commit SHA',
        required: true,
        type: 'string',
      },
      core_version: {
        description: 'Exact published Zeus Core version',
        required: true,
        type: 'string',
      },
      core_commit: {
        description: 'Immutable paired Zeus Core commit SHA',
        required: true,
        type: 'string',
      },
      /*
       * Required, not optional. A dispatch without it is refused inside the
       * workflow, and making it optional here would let the dispatch succeed
       * and fail later at the guard.
       */
      pairing_mode: {
        description: 'How the pair was established (must be `online`)',
        required: true,
        type: 'string',
      },
    })
    expect(getObject(secrets, 'NPM_PUBLISH_TOKEN')).toEqual({ required: true })
    expect(concurrency).toEqual({
      group: `publish-${githubExpression('github.repository')}`,
      'cancel-in-progress': false,
    })
    expect(getObject(publish, 'permissions')).toEqual({
      contents: 'read',
      'id-token': 'write',
    })
    // The publish job uploads pairing evidence, so it also uses the pinned
    // upload-artifact action alongside the three release actions.
    expect(getActionRefs(publish)).toEqual([
      ...RELEASE_ACTION_REFS,
      UPLOAD_ARTIFACT_ACTION_REF,
      UPLOAD_ARTIFACT_ACTION_REF,
    ])
    expect(publish.environment).toBe('Release')
    expect(String(verifyContext.run).trim()).toBe(
      [
        releaseChannelScript(),
        'test "$GITHUB_REF" = "refs/tags/v$VERSION"',
        'test "$GITHUB_SHA" = "$RELEASE_SHA"',
        'if ! [[ "$CORE_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then',
        '  echo "::error::core_commit must be a full 40-character SHA"',
        '  exit 1',
        'fi',
        ...PAIRING_MODE_GUARD,
      ].join('\n'),
    )
    expect(getObject(verifyContext, 'env')).toEqual({
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
      RELEASE_SHA: githubExpression('inputs.release_sha'),
      CORE_COMMIT: githubExpression('inputs.core_commit'),
      PAIRING_MODE: githubExpression('inputs.pairing_mode'),
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
        'git fetch --no-tags origin "+refs/heads/main:refs/remotes/origin/main"',
        'git merge-base --is-ancestor -- "$RELEASE_SHA" refs/remotes/origin/main',
      ].join('\n'),
    )
    expect(getObject(verifyTag, 'env')).toEqual({
      VERSION: githubExpression('inputs.version'),
      RELEASE_SHA: githubExpression('inputs.release_sha'),
    })
    expect(install).toBeDefined()
    expect(checkoutIndex).toBeLessThan(verifyTagIndex)
    expect(verifyTagIndex).toBeLessThan(installIndex)
    expect(runCommands).toEqual([
      [
        releaseChannelScript(),
        'test "$GITHUB_REF" = "refs/tags/v$VERSION"',
        'test "$GITHUB_SHA" = "$RELEASE_SHA"',
        'if ! [[ "$CORE_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then',
        '  echo "::error::core_commit must be a full 40-character SHA"',
        '  exit 1',
        'fi',
        ...PAIRING_MODE_GUARD,
      ].join('\n'),
      [
        'test "$(git rev-parse HEAD)" = "$RELEASE_SHA"',
        `test "$(git rev-parse "refs/tags/v${shellVariable('VERSION')}^{commit}")" = "$RELEASE_SHA"`,
        'git fetch --no-tags origin "+refs/heads/main:refs/remotes/origin/main"',
        'git merge-base --is-ancestor -- "$RELEASE_SHA" refs/remotes/origin/main',
      ].join('\n'),
      'pnpm install --frozen-lockfile',
      'pnpm build',
      'pnpm check:build-output',
      'pnpm release:verify:pack',
      pairingCommand(),
      revalidateReleaseTagScript('$VERSION'),
      publishPreflightCommand(),
      'pnpm release:capture:latest --output "$LATEST_BASELINE"',
      [
        'pnpm exec tsx scripts/checks/release/check-release-channel.ts --version "$VERSION" --tag "$TAG" --context publish',
        'pnpm run ci-publish --version "$VERSION" --tag "$TAG"',
      ].join('\n'),
      'pnpm release:verify:published --version "$VERSION" --tag "$TAG" --latest-baseline "$LATEST_BASELINE" --release-sha "$RELEASE_SHA"',
    ])
    expect(captureLatestBaseline.id).toBeUndefined()
    expect(String(captureLatestBaseline.run).trim()).toBe(
      'pnpm release:capture:latest --output "$LATEST_BASELINE"',
    )
    expect(getObject(captureLatestBaseline, 'env')).toEqual({
      LATEST_BASELINE: `${githubExpression(
        'runner.temp',
      )}/published-latest-baseline.json`,
    })
    expect(String(publishStep.run).trim()).toBe(
      [
        'pnpm exec tsx scripts/checks/release/check-release-channel.ts --version "$VERSION" --tag "$TAG" --context publish',
        'pnpm run ci-publish --version "$VERSION" --tag "$TAG"',
      ].join('\n'),
    )
    expect(String(revalidateTag.run).trim()).toBe(
      revalidateReleaseTagScript('$VERSION'),
    )
    expect(getObject(revalidateTag, 'env')).toEqual({
      VERSION: githubExpression('inputs.version'),
      RELEASE_SHA: githubExpression('inputs.release_sha'),
      GH_TOKEN: githubExpression('github.token'),
    })
    expect(getStepOrder(publish)).toEqual([
      'Verify dispatch context',
      CHECKOUT_ACTION_REF,
      'Verify release tag',
      PNPM_SETUP_ACTION_REF,
      SETUP_NODE_ACTION_REF,
      'pnpm install --frozen-lockfile',
      'Build packages',
      'Verify build outputs',
      'Verify release tarballs',
      'Verify immutable Core/UI pairing',
      'Preserve pairing evidence',
      'Revalidate release tag',
      'Verify registry reachability and the recovery set',
      'Preserve publish preflight evidence',
      'Capture latest dist-tag baseline',
      'Publish package',
      'Verify published packages',
    ])
    expectFailClosedRunSteps(publish)
    expect(getObject(publishStep, 'env')).toEqual({
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
      NODE_AUTH_TOKEN: githubExpression('secrets.NPM_PUBLISH_TOKEN'),
    })
    expect(verifyPublished.run).toBe(
      'pnpm release:verify:published --version "$VERSION" --tag "$TAG" --latest-baseline "$LATEST_BASELINE" --release-sha "$RELEASE_SHA"',
    )
    expect(getObject(verifyPublished, 'env')).toEqual({
      LATEST_BASELINE: `${githubExpression(
        'runner.temp',
      )}/published-latest-baseline.json`,
      RELEASE_SHA: githubExpression('inputs.release_sha'),
      VERSION: githubExpression('inputs.version'),
      TAG: githubExpression('inputs.tag'),
    })
    expect(source).not.toContain('npm@latest')
    expect(source).not.toContain('npm i -g')
    expect(source).not.toContain('default@')
    expect(source).not.toContain('--tag latest')
    expect(source).not.toContain('--expected-latest')
    expect(source).not.toMatch(/uses:\s+\S+@v\d/)
  })

  it('does not expose npm dist-tag removal', () => {
    expect(
      existsSync(resolve(process.cwd(), '.github/workflows/npm-dist-tag.yml')),
    ).toBe(false)
    expect(
      existsSync(
        resolve(process.cwd(), 'scripts/commands/remove-npm-dist-tag.ts'),
      ),
    ).toBe(false)
  })
})

/*
 * Every `steps.<id>.outputs.<key>` a job declares must be written by a step
 * with that id. This is the defect that motivated the check: `release.yml`
 * declared `core_commit: ${{ steps.pairing_core.outputs.core_commit }}` for
 * months while the step with `id: pairing_core` wrote no output at all. The
 * expression evaluates to the empty string, `dispatch-publish` refuses with
 * "pairing record coreCommit is not a full SHA", and by then the UI tag has
 * already been pushed.
 *
 * Structural YAML checks cannot see this. They read the workflow, and the
 * workflow is self-consistent: it references an output, and an output is
 * declared. What is missing is the producer, which lives in a shell script
 * inside a step.
 */
describe('referenced outputs have producers', () => {
  /*
   * Both workflows are parsed by the same helper, so a future `outputs:` block
   * in `publish.yml` is held to the same rule rather than silently exempt.
   * Today `publish.yml` exposes none, which the second test asserts — that is a
   * different claim from "the file was not checked".
   */
  const workflows = ['release.yml', 'publish.yml'] as const

  function workflowSource(file: string): string {
    return readFileSync(
      resolve(process.cwd(), '.github/workflows', file),
      'utf8',
    )
  }

  /*
   * The keys a step writes with `>> "$GITHUB_OUTPUT"`, whether written one per
   * line or as a grouped block. Both forms appear in these files, and a parser
   * that understood only the first would report a false failure on the second.
   */
  function producedKeys(source: string, stepId: string): Set<string> {
    const keys = new Set<string>()
    const lines = source.split('\n')
    let inStep = false
    let stepIndent = 0
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? ''
      const idMatch = /^\s*-\s+name:.*$/u.exec(line)
      if (idMatch) {
        /*
         * A new list item starts a new step. Whether it is ours is decided by
         * the `id:` line that follows, so scan forward to the next item.
         */
        const start = index
        inStep = false
        stepIndent = (line.match(/^\s*/u)?.[0].length ?? 0) + 2
        for (let scan = start; scan < lines.length; scan += 1) {
          const candidate = lines[scan] ?? ''
          if (scan > start && /^\s*-\s+name:/u.test(candidate)) break
          const idLine = /^\s*id:\s*(\S+)\s*$/u.exec(candidate)
          if (idLine) {
            inStep = idLine[1] === stepId
            break
          }
        }
        continue
      }
      if (!inStep) continue
      const indent = line.match(/^\s*/u)?.[0].length ?? 0
      if (indent === 0 && line.trim().length > 0) {
        inStep = false
        continue
      }
      if (indent < stepIndent - 2 && line.trim().length > 0) {
        inStep = false
        continue
      }
      for (const match of line.matchAll(/echo "([\w-]+)=/gu)) {
        keys.add(match[1]!)
      }
    }
    return keys
  }

  it('writes every output key that a workflow exposes', () => {
    for (const file of workflows) {
      const source = workflowSource(file)
      const outputs =
        /outputs:\n((?:\s+[a-z_]+:.*\n)+)/u.exec(source)?.[1] ?? ''
      const referenced = [
        ...outputs.matchAll(/steps\.([\w-]+)\.outputs\.([\w-]+)/gu),
      ]
      if (file === 'release.yml') {
        /*
         * `release.yml` must expose at least one output; a regex that silently
         * matched nothing would make this whole suite vacuous.
         */
        expect(referenced.length).toBeGreaterThan(0)
      }
      for (const [, stepId, key] of referenced) {
        expect(
          producedKeys(source, stepId!).has(key!),
          `${file} exposes steps.${stepId}.outputs.${key} but no step with id ${stepId} writes it`,
        ).toBe(true)
      }
    }
  })

  it('derives core_commit from the pairing report rather than from an input', () => {
    const source = workflowSource('release.yml')
    /*
     * The value must come from the file the check just produced. A dispatch
     * input or a hard-coded SHA would let a wrong commit be paired with an
     * otherwise valid release.
     */
    expect(source).toMatch(
      /CORE_COMMIT=\$\(node -p "const r=require\('\$PAIRING_REPORT'\); r\.coreCommit \?\? ''"\)/,
    )
    expect(source).toMatch(
      /PAIRING_MODE=\$\(node -p "require\('\$PAIRING_REPORT'\)\.mode"\)/,
    )
  })

  it('refuses a static report on the release path', () => {
    const source = workflowSource('release.yml')
    expect(source).toMatch(
      /if \[ "\$PAIRING_MODE" != "online" \]; then[\s\S]{0,160}exit 1/u,
    )
  })
})
