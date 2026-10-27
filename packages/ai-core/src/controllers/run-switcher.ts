/**
 * Run switcher (AI2-306).
 *
 * Several executions can be live at once. The switcher only chooses which
 * one is visible: switching never sends a command, never stops a run, and
 * pending approvals of hidden runs stay discoverable through the summaries.
 * Unread activity is counted per run while it is not selected.
 */

import type { EntityId, ExecutionStatus } from '../domain/types'
import type { AiState } from '../store/state'
import type { AiSession } from './session'
import type { Controller } from './view-store'

import { createViewStore } from './view-store'

export interface RunSummary {
  executionId: EntityId
  status: ExecutionStatus
  /** Step / tool / status changes since the run was last selected. */
  unread: number
  pendingApprovals: number
}

export interface RunSwitcherViewState {
  runs: readonly RunSummary[]
  selectedExecutionId?: EntityId
  /** Pending approvals across every run, visible or not. */
  pendingApprovalTotal: number
}

export interface RunSwitcherOptions {
  session: Pick<AiSession, 'store'>
  /** Which executions to list; defaults to every execution in the store. */
  filter?: (state: AiState) => readonly EntityId[]
  initialExecutionId?: EntityId
}

export interface RunSwitcherController extends Controller<RunSwitcherViewState> {
  select: (executionId: EntityId) => void
  /** Move selection by an offset (keyboard navigation in a tablist). */
  step: (offset: number) => void
}

/** Objects whose identity changes when a run shows new activity. */
function activityOf(state: AiState, executionId: EntityId): object[] {
  const parts: object[] = []
  const execution = state.executions[executionId]
  if (execution) parts.push(execution)
  for (const id of state.executionStepIds[executionId] ?? []) {
    const step = state.steps[id]
    if (step) parts.push(step)
  }
  for (const tool of Object.values(state.toolInvocations)) {
    if (tool.executionId === executionId) parts.push(tool)
  }
  return parts
}

export function createRunSwitcher(
  options: RunSwitcherOptions,
): RunSwitcherController {
  const { store } = options.session
  const listIds =
    options.filter ?? ((state: AiState) => Object.keys(state.executions))
  const unread = new Map<EntityId, number>()
  const seen = new Map<EntityId, Set<object>>()
  let selected = options.initialExecutionId

  function observe(state: AiState): void {
    for (const id of listIds(state)) {
      const previous = seen.get(id)
      const current = new Set(activityOf(state, id))

      if (previous && id !== selected) {
        let changed = 0
        for (const entry of current) {
          if (!previous.has(entry)) changed += 1
        }
        if (changed > 0) unread.set(id, (unread.get(id) ?? 0) + changed)
      }

      seen.set(id, current)
    }
  }

  function project(state: AiState): RunSwitcherViewState {
    const approvalsByRun = new Map<EntityId, number>()
    for (const approval of Object.values(state.approvals)) {
      if (approval.status === 'pending' || approval.status === 'submitted') {
        approvalsByRun.set(
          approval.executionId,
          (approvalsByRun.get(approval.executionId) ?? 0) + 1,
        )
      }
    }

    const runs = listIds(state)
      .map(id => state.executions[id])
      .filter(execution => execution !== undefined)
      .map(execution => ({
        executionId: execution.id,
        status: execution.status,
        unread: execution.id === selected ? 0 : (unread.get(execution.id) ?? 0),
        pendingApprovals: approvalsByRun.get(execution.id) ?? 0,
      }))

    if (selected === undefined && runs.length > 0) {
      selected = runs[0].executionId
    }

    return {
      runs,
      selectedExecutionId: selected,
      pendingApprovalTotal: [...approvalsByRun.values()].reduce(
        (sum, count) => sum + count,
        0,
      ),
    }
  }

  observe(store.getState())
  const view = createViewStore<RunSwitcherViewState>(project(store.getState()))

  function refresh(): void {
    const next = project(store.getState())
    const current = view.getSnapshot()
    view.update({
      ...next,
      runs:
        JSON.stringify(current.runs) === JSON.stringify(next.runs)
          ? current.runs
          : next.runs,
    })
  }

  view.onDispose(
    store.subscribe(
      state => state,
      state => {
        observe(state)
        refresh()
      },
    ),
  )

  function select(executionId: EntityId): void {
    if (!store.getState().executions[executionId]) return
    selected = executionId
    unread.set(executionId, 0)
    refresh()
  }

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    select,
    step(offset): void {
      const runs = view.getSnapshot().runs
      if (runs.length === 0) return
      const index = runs.findIndex(run => run.executionId === selected)
      const next =
        (((index + offset) % runs.length) + runs.length) % runs.length
      select(runs[next].executionId)
    },
    dispose(): void {
      view.dispose()
    },
  }
}
