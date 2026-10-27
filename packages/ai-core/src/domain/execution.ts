/**
 * Execution state machine (AI2-102 / M3 prerequisite).
 *
 * Terminal executions never revive from a late or duplicated event: the store
 * rejects the transition instead of letting a delayed `running` frame reopen a
 * completed run.
 */

import type { ExecutionStatus } from './types'

export const EXECUTION_TRANSITIONS: Readonly<
  Record<ExecutionStatus, readonly ExecutionStatus[]>
> = {
  queued: ['running', 'cancelled'],
  running: ['awaiting-approval', 'paused', 'completed', 'failed', 'cancelled'],
  'awaiting-approval': ['running', 'paused', 'failed', 'cancelled'],
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
