import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parse } from 'yaml'

interface WorkflowObject {
  [key: string]: unknown
}

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

function getRunCommands(job: WorkflowObject): string[] {
  return getSteps(job)
    .filter(step => typeof step.run === 'string')
    .map(step => String(step.run).trim())
}

function readWorkflow(name: string): WorkflowObject {
  const source = readFileSync(
    resolve(process.cwd(), `.github/workflows/${name}`),
    'utf-8',
  )

  return asObject(parse(source) as unknown, name)
}

describe('ci workflow contract', () => {
  it('runs the expensive site check once in a bounded build job', () => {
    const ci = readWorkflow('ci.yml')
    const test = readWorkflow('test.yml')
    const ciBuild = getObject(getObject(ci, 'jobs'), 'build')
    const testJobs = getObject(test, 'jobs')
    const buildOutput = getObject(testJobs, 'build-output')
    const siteCheckCommands = getRunCommands(ciBuild)
      .concat(getRunCommands(buildOutput))
      .filter(command => command.includes('pnpm site:check'))

    expect(ciBuild['timeout-minutes']).toBe(45)
    expect(buildOutput['timeout-minutes']).toBe(20)
    expect(siteCheckCommands).toEqual(['pnpm site:check'])
    expect(getRunCommands(buildOutput)).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm build',
      'pnpm check:build-output',
    ])
  })

  it('bounds every reusable test job', () => {
    const jobs = getObject(readWorkflow('test.yml'), 'jobs')

    expect(getObject(jobs, 'data-grid-benchmark')['timeout-minutes']).toBe(15)
    expect(getObject(jobs, 'unit-test')['timeout-minutes']).toBe(20)
    expect(getObject(jobs, 'unit-test-windows')['timeout-minutes']).toBe(25)
    expect(getObject(jobs, 'build-output')['timeout-minutes']).toBe(20)
    expect(getObject(jobs, 'lint-and-test-dts')['timeout-minutes']).toBe(15)
  })

  it('uses an explicit Bash shell so artifact logging pipelines preserve failures', () => {
    const defaults = getObject(readWorkflow('showcase.yml'), 'defaults')

    expect(getObject(defaults, 'run')).toEqual({ shell: 'bash' })
  })

  it('validates docs in pull requests and deploys only from main', () => {
    const workflow = readWorkflow('docs.yml')
    const triggers = getObject(workflow, 'on')
    const jobs = getObject(workflow, 'jobs')
    const docs = getObject(jobs, 'docs')
    const deploy = getObject(jobs, 'build-and-deploy')

    expect(triggers.pull_request).toBeNull()
    expect(triggers).not.toHaveProperty('workflow_dispatch')
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(docs.if).toBe("github.event_name == 'pull_request'")
    expect(docs['timeout-minutes']).toBe(30)
    expect(getRunCommands(docs)).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm showcase:e2e:deps',
      'pnpm docs:check',
      'pnpm docs:build',
    ])
    expect(deploy.if).toBe(
      "github.event_name == 'push' && github.ref == 'refs/heads/main'",
    )
    expect(deploy.permissions).toEqual({
      contents: 'read',
      pages: 'write',
      'id-token': 'write',
    })
  })
})
