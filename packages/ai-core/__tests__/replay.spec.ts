import type { ScenarioFixture } from '../src/host/fixtures'

import type { AiStore } from '../src/store/store'
import { describe, expect, it } from 'vitest'
import {
  createS1ChatScenario,
  createS2AgentApprovalScenario,
  createS3CodingReviewScenario,
  SCENARIO_FIXTURES,
} from '../src/host/fixtures'
import { createReplayHost } from '../src/host/replay-host'

import { checksumState } from '../src/store/snapshot'
import { createAiStore } from '../src/store/store'

async function replay(
  fixture: ScenarioFixture,
  options: { swapPairs?: boolean } = {},
): Promise<AiStore> {
  const host = createReplayHost(fixture.events)
  const store = createAiStore({ streamId: fixture.streamId })

  const events = fixture.events.slice()
  if (options.swapPairs) {
    for (let index = 0; index + 1 < events.length; index += 2) {
      const left = events[index]
      events[index] = events[index + 1]
      events[index + 1] = left
    }
  }

  for (const event of events) {
    store.ingest(event)
  }

  void host

  return store
}

describe('s1/S2/S3 replay (G0 gate, AI2-110)', () => {
  it('exposes three recorded scenarios', () => {
    expect(SCENARIO_FIXTURES.map(fixture => fixture.name)).toEqual([
      'S1 会话流式回答',
      'S2 Agent 审批后执行',
      'S3 代码变更审阅与写入',
    ])
  })

  it('replays S1 to a completed answer', async () => {
    const store = await replay(createS1ChatScenario())
    const state = store.getState()

    expect(state.messages['msg-s1-assistant'].status).toBe('complete')
    expect(state.messages['msg-s1-assistant'].parts[0]).toMatchObject({
      kind: 'text',
      text: '这段代码做的是增量渲染。',
    })
    expect(state.executions['exec-s1'].status).toBe('completed')
    expect(state.conversationMessageIds['conv-s1']).toEqual([
      'msg-s1-user',
      'msg-s1-assistant',
    ])
  })

  it('replays S2 through the approval gate', async () => {
    const store = await replay(createS2AgentApprovalScenario())
    const state = store.getState()

    expect(state.approvals['approval-s2'].status).toBe('approved')
    expect(state.executions['exec-s2'].status).toBe('completed')
    expect(state.steps['step-s2-plan'].status).toBe('completed')
    expect(state.toolInvocations['tool-s2-shell'].status).toBe('succeeded')
  })

  it('replays S3 to an applied change set', async () => {
    const store = await replay(createS3CodingReviewScenario())
    const state = store.getState()

    expect(state.approvals['approval-s3'].status).toBe('approved')
    expect(state.changeSets['changeset-s3'].status).toBe('applied')
    expect(state.executions['exec-s3'].status).toBe('completed')
  })

  it('is deterministic across replays of the same stream', async () => {
    for (const fixture of SCENARIO_FIXTURES) {
      const first = await replay(fixture)
      const second = await replay(fixture)

      expect(checksumState(second.getState())).toBe(
        checksumState(first.getState()),
      )
    }
  })

  it('reaches the same canonical state when events arrive out of order', async () => {
    for (const fixture of SCENARIO_FIXTURES) {
      const ordered = await replay(fixture)
      const shuffled = await replay(fixture, { swapPairs: true })

      expect(checksumState(shuffled.getState())).toBe(
        checksumState(ordered.getState()),
      )
      expect(shuffled.getCursor()).toBe(ordered.getCursor())
    }
  })

  it('refuses commands on a replay host instead of faking approvals', async () => {
    const host = createReplayHost(createS2AgentApprovalScenario().events)
    const ack = await host.execute({
      schemaVersion: 2,
      commandId: 'cmd-1',
      idempotencyKey: 'idem-1',
      type: 'approval.resolve',
      target: { kind: 'approval', id: 'approval-s2' },
      payload: { decision: 'approved' },
    })

    expect(ack).toMatchObject({ accepted: false, code: 'AI_HOST_READONLY' })
  })
})
