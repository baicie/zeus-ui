/**
 * M3 controllers: execution, step/tool projections, approval and run
 * switcher (AI2-301 – AI2-303, AI2-306).
 */

import type { CommandAck } from '../src/protocol/commands'

import { describe, expect, it, vi } from 'vitest'
import { createApprovalController } from '../src/controllers/approval'
import { createExecutionController } from '../src/controllers/execution'
import { createRunSwitcher } from '../src/controllers/run-switcher'
import { selectStepChildIds, selectStepTree } from '../src/store/projections'
import {
  approval,
  createFixture,
  createSessionStub,
  deferred,
  execution,
  sequentialIds,
  step,
  tool,
} from './helpers'

function agentFixture() {
  const fixture = createFixture()
  fixture.emit('execution.started', 'exec-1', { execution: execution() })
  return fixture
}

describe('ai2-301 · execution intents', () => {
  it('offers only actions the status and host capabilities allow', () => {
    const fixture = agentFixture()
    const session = createSessionStub(fixture.store)

    const basic = createExecutionController({ session, executionId: 'exec-1' })
    expect(basic.getSnapshot().availableActions).toEqual(['cancel'])

    const capable = createExecutionController({
      session,
      executionId: 'exec-1',
      capabilities: { pause: true, resume: true },
    })
    expect(capable.getSnapshot().availableActions).toEqual(['cancel', 'pause'])
  })

  it('shows cancel as requested until the host confirms it', async () => {
    const fixture = agentFixture()
    const session = createSessionStub(fixture.store)
    const controller = createExecutionController({
      session,
      executionId: 'exec-1',
    })

    await controller.request('cancel')
    expect(controller.getSnapshot()).toMatchObject({
      status: 'running',
      pendingAction: 'cancel',
      availableActions: [],
    })
    expect(session.commands()[0]).toMatchObject({
      type: 'execution.cancel',
      expectedRevision: 1,
    })

    fixture.emit('execution.status.changed', 'exec-1', {
      id: 'exec-1',
      from: 'running',
      to: 'cancelled',
      revision: 2,
    })
    expect(controller.getSnapshot()).toMatchObject({
      status: 'cancelled',
      pendingAction: undefined,
    })
  })

  it('shares one command between double clicks and clears on refusal', async () => {
    const gate = deferred<CommandAck>()
    const fixture = agentFixture()
    const session = createSessionStub(fixture.store, () => gate.promise)
    const controller = createExecutionController({
      session,
      executionId: 'exec-1',
    })

    const first = controller.request('cancel')
    expect(controller.request('cancel')).toBe(first)
    gate.resolve({
      accepted: false,
      commandId: 'x',
      code: 'AI_POLICY',
      message: 'no',
    })
    await first

    expect(session.execute).toHaveBeenCalledOnce()
    expect(controller.getSnapshot()).toMatchObject({
      pendingAction: undefined,
      availableActions: ['cancel'],
      lastErrorCode: 'AI_POLICY',
    })
  })
})

describe('ai2-302 · step and tool projections', () => {
  function seeded() {
    const fixture = agentFixture()
    fixture.emit('step.upserted', 'plan', {
      step: step({ id: 'plan', kind: 'plan' }),
    })
    fixture.emit('step.upserted', 'run', {
      step: step({ id: 'run', parentStepId: 'plan' }),
    })
    fixture.emit('tool.upserted', 'tool-1', { tool: tool({ stepId: 'run' }) })
    fixture.emit('step.upserted', 'report', {
      step: step({ id: 'report', kind: 'output' }),
    })
    return fixture
  }

  it('nests steps and attaches their tools', () => {
    const tree = selectStepTree(seeded().store.getState(), 'exec-1')

    expect(tree.map(node => node.step.id)).toEqual(['plan', 'report'])
    expect(tree[0].children[0]).toMatchObject({
      step: { id: 'run' },
      tool: { id: 'tool-1' },
      depth: 1,
    })
  })

  it('keeps child id lists stable when only a step status changes', () => {
    const fixture = seeded()
    const before = selectStepChildIds(fixture.store.getState(), 'exec-1')
    fixture.emit('step.upserted', 'report', {
      step: step({ id: 'report', kind: 'output', status: 'completed' }),
    })
    expect(selectStepChildIds(fixture.store.getState(), 'exec-1')).toBe(before)
  })

  it('does not let a late event reverse a finished step', () => {
    const fixture = seeded()
    fixture.emit('step.upserted', 'run', {
      step: step({ id: 'run', parentStepId: 'plan', status: 'completed' }),
    })
    const late = fixture.store.ingest(
      fixture.factory.create('step.upserted', 'run', {
        step: step({ id: 'run', parentStepId: 'plan', status: 'running' }),
      }),
    )
    expect(late.status).toBe('rejected')
    expect(
      selectStepTree(fixture.store.getState(), 'exec-1')[0].children[0].step
        .status,
    ).toBe('completed')
  })
})

describe('ai2-303 · approval decisions', () => {
  function setup(
    overrides: Parameters<typeof approval>[0] = {},
    respond?: Parameters<typeof createSessionStub>[1],
    now = () => Date.parse('2026-01-01T00:00:00.000Z'),
  ) {
    const fixture = agentFixture()
    fixture.emit('approval.requested', 'approval-1', {
      approval: approval(overrides),
    })
    const session = createSessionStub(fixture.store, respond)
    const controller = createApprovalController({
      session,
      approvalId: 'approval-1',
      now,
      createId: sequentialIds(),
    })
    return { fixture, session, controller }
  }

  it('sends one command for repeated clicks and waits for the host fact', async () => {
    const gate = deferred<CommandAck>()
    const { fixture, session, controller } = setup({}, () => gate.promise)

    const first = controller.approve()
    expect(controller.approve()).toBe(first)
    expect(controller.reject()).resolves.toMatchObject({
      code: 'AI_APPROVAL_DECISION_PENDING',
    })
    gate.resolve({ accepted: true, commandId: 'cmd-1', operationId: 'op' })
    await first

    expect(session.execute).toHaveBeenCalledOnce()
    expect(session.commands()[0]).toMatchObject({
      type: 'approval.resolve',
      idempotencyKey: 'approval-1:1:approved',
      expectedRevision: 1,
      payload: { decision: 'approved', scope: 'once' },
    })
    // Accepted is not approved.
    expect(controller.getSnapshot()).toMatchObject({
      displayStatus: 'submitted',
      canDecide: false,
    })
    expect(fixture.store.getState().approvals['approval-1'].status).toBe(
      'pending',
    )

    fixture.emit('approval.resolved', 'approval-1', {
      approvalId: 'approval-1',
      decision: 'approved',
      revision: 2,
    })
    expect(controller.getSnapshot().displayStatus).toBe('approved')
  })

  it('never approves offline and shows a host refusal as an error', async () => {
    const offline = setup({}, async () => {
      throw Object.assign(new Error('socket closed'), { code: 'closed' })
    })
    await expect(offline.controller.approve()).rejects.toThrow('socket closed')
    expect(offline.controller.getSnapshot()).toMatchObject({
      displayStatus: 'pending',
      local: 'failed',
      canDecide: true,
      errorCode: 'closed',
    })

    const refused = setup({}, command => ({
      accepted: false,
      commandId: command.commandId,
      code: 'AI_POLICY_DENIED',
      message: 'policy requires a second approver',
    }))
    await refused.controller.approve()
    expect(refused.controller.getSnapshot()).toMatchObject({
      displayStatus: 'pending',
      error: 'policy requires a second approver',
    })
  })

  it('refuses to submit an expired approval', async () => {
    const { controller, session } = setup({
      expiresAt: '2025-12-31T23:59:00.000Z',
    })

    expect(controller.getSnapshot()).toMatchObject({
      expired: true,
      displayStatus: 'expired',
      canDecide: false,
    })
    expect(await controller.approve()).toMatchObject({
      code: 'AI_APPROVAL_EXPIRED',
    })
    expect(session.execute).not.toHaveBeenCalled()
  })

  it('expires on the local clock while the prompt is open', () => {
    vi.useFakeTimers()
    let now = Date.parse('2026-01-01T00:00:00.000Z')
    const { controller } = setup(
      { expiresAt: '2026-01-01T00:00:30.000Z' },
      undefined,
      () => now,
    )

    expect(controller.getSnapshot().canDecide).toBe(true)
    now += 31_000
    vi.advanceTimersByTime(31_000)
    expect(controller.getSnapshot()).toMatchObject({
      expired: true,
      canDecide: false,
    })
    controller.dispose()
    vi.useRealTimers()
  })

  it('sends nothing when the prompt is closed', () => {
    const { controller, session } = setup()
    controller.dispose()
    expect(session.execute).not.toHaveBeenCalled()
  })
})

describe('ai2-306 · run switcher', () => {
  function multiRun() {
    const fixture = createFixture()
    for (const id of ['exec-1', 'exec-2', 'exec-3', 'exec-4']) {
      fixture.emit('execution.started', id, { execution: execution({ id }) })
    }
    return fixture
  }

  it('isolates runs: switching sends nothing and counts unread per run', () => {
    const fixture = multiRun()
    const switcher = createRunSwitcher({ session: { store: fixture.store } })
    expect(switcher.getSnapshot().selectedExecutionId).toBe('exec-1')

    fixture.emit('step.upserted', 's2', {
      step: step({ id: 's2', executionId: 'exec-2' }),
    })
    fixture.emit('step.upserted', 's1', {
      step: step({ id: 's1', executionId: 'exec-1' }),
    })

    const runs = switcher.getSnapshot().runs
    expect(runs.find(run => run.executionId === 'exec-2')?.unread).toBe(1)
    expect(runs.find(run => run.executionId === 'exec-1')?.unread).toBe(0)

    switcher.select('exec-2')
    expect(
      switcher.getSnapshot().runs.find(run => run.executionId === 'exec-2')
        ?.unread,
    ).toBe(0)
    expect(fixture.store.getState().executions['exec-1'].status).toBe('running')
  })

  it('keeps approvals of hidden runs discoverable', () => {
    const fixture = multiRun()
    const switcher = createRunSwitcher({ session: { store: fixture.store } })
    fixture.emit('approval.requested', 'a3', {
      approval: approval({ id: 'a3', executionId: 'exec-3' }),
    })

    expect(switcher.getSnapshot()).toMatchObject({
      selectedExecutionId: 'exec-1',
      pendingApprovalTotal: 1,
    })
    expect(switcher.getSnapshot().runs[2].pendingApprovals).toBe(1)
  })

  it('wraps keyboard navigation', () => {
    const switcher = createRunSwitcher({ session: { store: multiRun().store } })
    switcher.step(-1)
    expect(switcher.getSnapshot().selectedExecutionId).toBe('exec-4')
    switcher.step(1)
    expect(switcher.getSnapshot().selectedExecutionId).toBe('exec-1')
  })
})
