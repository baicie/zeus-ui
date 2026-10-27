/**
 * Execution, step and tool lifecycles (AI2-102 / M3 prerequisite).
 *
 * Terminal executions never revive from a late or duplicated event: the store
 * rejects the transition instead of letting a delayed `running` frame reopen a
 * completed run. The table mirrors `01-ARCHITECTURE.md` §6.1 exactly; a run
 * waiting for approval resumes, fails or is cancelled, it is not paused.
 *
 * Steps and tool invocations have no per-entity revision in the protocol, so
 * the only guarantee the store can enforce is that a terminal status is final.
 */

import type { ExecutionStatus, StepStatus, ToolInvocationStatus } from './types'

export const EXECUTION_TRANSITIONS: Readonly<
  Record<ExecutionStatus, readonly ExecutionStatus[]>
> = {
  queued: ['running', 'cancelled'],
  running: ['awaiting-approval', 'paused', 'completed', 'failed', 'cancelled'],
  'awaiting-approval': ['running', 'failed', 'cancelled'],
  paused: ['running', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
}

export function isExecutionTerminal(status: ExecutionStatus): boolean {
  return EXECUTION_TRANSITIONS[status].length === 0
}

export function canTransitionExecution(
  from: ExecutionStatus,
  to: ExecutionStatus,
): boolean {
  return EXECUTION_TRANSITIONS[from].includes(to)
}

export const STEP_TERMINAL_STATUSES: readonly StepStatus[] = [
  'completed',
  'failed',
  'cancelled',
]

export function isStepTerminal(status: StepStatus): boolean {
  return STEP_TERMINAL_STATUSES.includes(status)
}

export const TOOL_TERMINAL_STATUSES: readonly ToolInvocationStatus[] = [
  'succeeded',
  'failed',
  'cancelled',
]

export function isToolTerminal(status: ToolInvocationStatus): boolean {
  return TOOL_TERMINAL_STATUSES.includes(status)
}
