/**
 * Approval state machine (AI2-104).
 *
 * The transition table is deliberately small and total: every status lists the
 * only statuses it may move to, and anything else throws. A front-end that
 * "knows" an approval was granted (local state, disabled button, user role)
 * still cannot move an approval on its own; only host events call this.
 */

import type { ApprovalStatus } from './types'

export const APPROVAL_TRANSITIONS: Readonly<
  Record<ApprovalStatus, readonly ApprovalStatus[]>
> = {
  pending: ['submitted', 'expired', 'revoked'],
  submitted: ['approved', 'rejected', 'expired', 'revoked'],
  approved: ['revoked'],
  rejected: [],
  expired: [],
  revoked: [],
}

export const APPROVAL_TERMINAL_STATUSES: readonly ApprovalStatus[] = [
  'rejected',
  'expired',
  'revoked',
]

export function isApprovalTerminal(status: ApprovalStatus): boolean {
  return APPROVAL_TRANSITIONS[status].length === 0
}

export function canTransitionApproval(
  from: ApprovalStatus,
  to: ApprovalStatus,
): boolean {
  return APPROVAL_TRANSITIONS[from].includes(to)
}

/**
 * Decisions a host resolution event may carry. Resolution is allowed from
 * `pending` as well as `submitted`: the local "submitted" state is a UI
 * projection, and the host may resolve a request before the client mirrors it.
 */
export type ApprovalDecision = 'approved' | 'rejected' | 'expired' | 'revoked'

export const APPROVAL_RESOLUTION_SOURCES: readonly ApprovalStatus[] = [
  'pending',
  'submitted',
]

export function canResolveApproval(
  from: ApprovalStatus,
  decision: ApprovalDecision,
): boolean {
  if (APPROVAL_RESOLUTION_SOURCES.includes(from)) {
    return APPROVAL_TRANSITIONS.submitted.includes(decision)
  }

  if (from === 'approved') return decision === 'revoked'

  return false
}

export interface ApprovalTransitionError extends Error {
  code: 'AI_APPROVAL_ILLEGAL_TRANSITION'
  from: ApprovalStatus
  to: ApprovalStatus
}

export function createApprovalTransitionError(
  from: ApprovalStatus,
  to: ApprovalStatus,
): ApprovalTransitionError {
  const error = new Error(
    `[AI_APPROVAL_ILLEGAL_TRANSITION] ${from} -> ${to} is not an allowed approval transition`,
  ) as ApprovalTransitionError

  error.name = 'ApprovalTransitionError'
  error.code = 'AI_APPROVAL_ILLEGAL_TRANSITION'
  error.from = from
  error.to = to

  return error
}
