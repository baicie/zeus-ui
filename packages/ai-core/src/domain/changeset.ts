/**
 * ChangeSet lifecycle (AI2-103 / AI2-405 prerequisite).
 *
 * `ready → applying → applied | conflicted | rejected` is the host-owned fact
 * from `01-ARCHITECTURE.md` §6.4. Local review progress ("I read this hunk")
 * never appears here. `applied` and `rejected` are final: a late `ready`
 * frame must not reopen a change set that the host already wrote or dropped.
 */

import type { ChangeSetStatus } from './types'

export const CHANGESET_TRANSITIONS: Readonly<
  Record<ChangeSetStatus, readonly ChangeSetStatus[]>
> = {
  draft: ['ready', 'rejected'],
  ready: ['draft', 'applying', 'rejected'],
  applying: ['applied', 'conflicted', 'rejected'],
  conflicted: ['ready', 'applying', 'rejected'],
  applied: [],
  rejected: [],
}

export function isChangeSetTerminal(status: ChangeSetStatus): boolean {
  return CHANGESET_TRANSITIONS[status].length === 0
}

export function canTransitionChangeSet(
  from: ChangeSetStatus,
  to: ChangeSetStatus,
): boolean {
  return from === to || CHANGESET_TRANSITIONS[from].includes(to)
}
