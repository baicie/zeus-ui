/**
 * Approval controller (AI2-303).
 *
 * The UI collects a decision and sends `approval.resolve`; it never decides
 * on its own (01-ARCHITECTURE §13, 02-INTERACTION-SPEC B5):
 *
 * - a second click while a decision is in flight returns the same promise,
 *   and the command carries one idempotency key per approval revision and
 *   decision, so the host executes it once;
 * - an accepted ack only moves the view to `submitted`; the approval becomes
 *   `approved` / `rejected` when the host's `approval.resolved` arrives;
 * - a host refusal (policy, expiry) is shown as an error, not as the user
 *   rejecting; a transport failure leaves the approval pending — there is no
 *   offline approval;
 * - an expired approval cannot be submitted, whether the host said so or the
 *   local clock passed `expiresAt`;
 * - closing the prompt (`dispose`) sends nothing.
 */

import type { ApprovalRequest, ApprovalStatus, EntityId } from '../domain/types'
import type { CommandAck } from '../protocol/commands'
import type { AiSession } from './session'
import type { Controller, IdGenerator } from './view-store'

import { createCommand } from '../protocol/commands'
import { createViewStore, defaultIdGenerator } from './view-store'

export type ApprovalDecisionIntent = 'approved' | 'rejected'

export type ApprovalLocalState = 'idle' | 'submitting' | 'submitted' | 'failed'

export interface ApprovalViewState {
  approvalId: EntityId
  approval?: ApprovalRequest
  /** Host status, or `submitted` while a decision awaits confirmation. */
  displayStatus?: ApprovalStatus
  local: ApprovalLocalState
  pendingDecision?: ApprovalDecisionIntent
  expired: boolean
  canDecide: boolean
  error?: string
  errorCode?: string
}

export interface ApprovalControllerOptions {
  session: Pick<AiSession, 'store' | 'execute'>
  approvalId: EntityId
  /** Clock for `expiresAt`; injected in tests. */
  now?: () => number
  createId?: IdGenerator
}

export interface ApprovalController extends Controller<ApprovalViewState> {
  approve: () => Promise<CommandAck>
  reject: () => Promise<CommandAck>
}

function isExpired(
  approval: ApprovalRequest | undefined,
  now: number,
): boolean {
  if (!approval) return false
  if (approval.status === 'expired') return true
  if (!approval.expiresAt) return false

  const at = Date.parse(approval.expiresAt)
  return Number.isFinite(at) && at <= now
}

export function createApprovalController(
  options: ApprovalControllerOptions,
): ApprovalController {
  const { store } = options.session
  const now = options.now ?? Date.now
  const createId = options.createId ?? defaultIdGenerator
  let inFlight:
    | { decision: ApprovalDecisionIntent; promise: Promise<CommandAck> }
    | undefined
  let expiryTimer: ReturnType<typeof setTimeout> | undefined

  function derive(
    local: ApprovalLocalState,
    pendingDecision: ApprovalDecisionIntent | undefined,
  ): Omit<ApprovalViewState, 'error' | 'errorCode'> {
    const approval = store.getState().approvals.get(options.approvalId)
    const expired = isExpired(approval, now())
    const hostDecided =
      approval !== undefined &&
      approval.status !== 'pending' &&
      approval.status !== 'submitted'
    // Once the host decided, the local submission is history.
    const effectiveLocal = hostDecided && local === 'submitted' ? 'idle' : local

    return {
      approvalId: options.approvalId,
      approval,
      displayStatus:
        approval && !hostDecided && effectiveLocal === 'submitted'
          ? 'submitted'
          : expired && approval?.status === 'pending'
            ? 'expired'
            : approval?.status,
      local: effectiveLocal,
      pendingDecision: effectiveLocal === 'idle' ? undefined : pendingDecision,
      expired,
      canDecide:
        approval?.status === 'pending' &&
        !expired &&
        (effectiveLocal === 'idle' || effectiveLocal === 'failed'),
    }
  }

  const view = createViewStore<ApprovalViewState>(derive('idle', undefined))

  function refresh(): void {
    const current = view.getSnapshot()
    view.update(derive(current.local, current.pendingDecision))
    scheduleExpiry()
  }

  function scheduleExpiry(): void {
    if (expiryTimer) clearTimeout(expiryTimer)
    expiryTimer = undefined

    const expiresAt = view.getSnapshot().approval?.expiresAt
    if (!expiresAt || view.getSnapshot().expired) return

    const delay = Date.parse(expiresAt) - now()
    if (!Number.isFinite(delay)) return

    expiryTimer = setTimeout(refresh, Math.max(0, Math.min(delay, 2 ** 31 - 1)))
  }

  view.onDispose(
    store.subscribe(state => state.approvals.get(options.approvalId), refresh),
  )
  view.onDispose(() => {
    if (expiryTimer) clearTimeout(expiryTimer)
  })
  scheduleExpiry()

  function decide(decision: ApprovalDecisionIntent): Promise<CommandAck> {
    if (inFlight) {
      // Same decision: share the attempt. Opposite decision: refuse locally.
      return inFlight.decision === decision
        ? inFlight.promise
        : Promise.resolve({
            accepted: false,
            commandId: '',
            code: 'AI_APPROVAL_DECISION_PENDING',
            message: `a ${inFlight.decision} decision is already being submitted`,
          })
    }

    view.update(
      derive(view.getSnapshot().local, view.getSnapshot().pendingDecision),
    )
    const current = view.getSnapshot()
    const approval = current.approval

    if (!approval || !current.canDecide) {
      return Promise.resolve({
        accepted: false,
        commandId: '',
        code: current.expired
          ? 'AI_APPROVAL_EXPIRED'
          : 'AI_APPROVAL_NOT_DECIDABLE',
        message: `approval ${options.approvalId} cannot be decided now`,
      })
    }

    view.update({
      ...derive('submitting', decision),
      error: undefined,
      errorCode: undefined,
    })

    const command = createCommand({
      commandId: createId('cmd'),
      idempotencyKey: `${approval.id}:${approval.revision}:${decision}`,
      type: 'approval.resolve',
      target: { kind: 'approval', id: approval.id },
      expectedRevision: approval.revision,
      payload: {
        decision,
        // Echo what the user saw so the host can refuse a mismatch.
        scope: approval.scope,
        operation: approval.operation,
      },
    })

    const promise = options.session
      .execute(command)
      .then(ack => {
        if (ack.accepted) {
          view.update(derive('submitted', decision))
        } else {
          view.update({
            ...derive('failed', decision),
            error: ack.message,
            errorCode: ack.code,
          })
        }
        return ack
      })
      .catch((error: unknown) => {
        // No trusted answer: the approval stays pending, never approved.
        view.update({
          ...derive('failed', decision),
          error: error instanceof Error ? error.message : String(error),
          errorCode:
            (error as { code?: string }).code ?? 'AI_COMMAND_TRANSPORT',
        })
        throw error
      })
      .finally(() => {
        inFlight = undefined
      })

    inFlight = { decision, promise }
    return promise
  }

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    approve: () => decide('approved'),
    reject: () => decide('rejected'),
    dispose(): void {
      view.dispose()
    },
  }
}
