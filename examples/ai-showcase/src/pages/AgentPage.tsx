/**
 * S2 · Agent + approval: start runs, follow steps, approve or reject a
 * high-risk tool call, switch runs without stopping them.
 */

import type { AiState, EntityId } from '@zeus-web/ai-core'

import {
  createApprovalController,
  createCommand,
  createExecutionController,
  createRunSwitcher,
} from '@zeus-web/ai-core'
import {
  AiApprovalPrompt,
  AiExecutionStatus,
  AiRunSwitcher,
  AiStepList,
  useAiState,
  useController,
  useOwnedController,
} from '@zeus-web/ai-react'
import { session } from '../session'

const runs = createRunSwitcher({
  session,
  filter: state =>
    state.executions
      .values()
      .filter(execution => execution.id.startsWith('run-'))
      .map(execution => execution.id),
})
let started = 0

function startRun(): void {
  started += 1
  void session.execute(
    createCommand({
      commandId: `agent-start-${started}`,
      idempotencyKey: `agent-start-${started}`,
      type: 'agent.start',
      target: { kind: 'workspace', id: 'ws-demo' },
      payload: {},
    }),
  )
}

function Approval({ approvalId }: { approvalId: EntityId }) {
  const controller = useOwnedController(
    () => createApprovalController({ session, approvalId }),
    [approvalId],
  )
  return (
    <AiApprovalPrompt
      controller={controller}
      presentation="region"
      confirmationPhrase="run tests"
    />
  )
}

function approvalsOf(executionId: EntityId) {
  return (state: AiState): string => {
    const ids = state.approvals
      .values()
      .filter(approval => approval.executionId === executionId)
    return ids.map(approval => approval.id).join(',')
  }
}

function RunDetails({ executionId }: { executionId: EntityId }) {
  const execution = useOwnedController(
    () =>
      createExecutionController({
        session,
        executionId,
        capabilities: { cancel: true },
      }),
    [executionId],
  )
  const approvalIds = useAiState(session.store, approvalsOf(executionId))

  return (
    <div className="run" data-run={executionId}>
      <AiExecutionStatus controller={execution} />
      <AiStepList executionId={executionId} session={session} label="Steps" />
      {approvalIds
        .split(',')
        .filter(Boolean)
        .map(id => (
          <Approval key={id} approvalId={id} />
        ))}
    </div>
  )
}

export function AgentPage() {
  const selected = useController(runs, view => view.selectedExecutionId)
  const pending = useController(runs, view => view.pendingApprovalTotal)

  return (
    <section className="story" aria-labelledby="agent-title">
      <header className="story-header">
        <h1 id="agent-title">S2 · Agent</h1>
        <button type="button" onClick={startRun}>
          Start run
        </button>
        <span data-testid="pending-total">{pending} awaiting approval</span>
      </header>
      <AiRunSwitcher
        controller={runs}
        title={id => `Run ${id.replace('run-', '#')}`}
      />
      {selected && <RunDetails key={selected} executionId={selected} />}
    </section>
  )
}
