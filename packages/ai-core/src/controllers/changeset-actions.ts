/**
 * Change-set actions (AI2-405).
 *
 * Applying code changes is a host operation. The UI sends `changeset.apply`
 * bound to the change set id, its `baseRevision`, its workspace and the
 * revision the user reviewed (`expectedRevision`); the host re-checks auth,
 * scope and the base before writing anything. The status shown is always
 * the host's (`ready → applying → applied | conflicted | rejected`).
 *
 * A conflict is recoverable: `rebase` asks the host for a fresh change set
 * against the current base, which comes back as a new revision to review.
 */

import type { ChangeSet, ChangeSetStatus, EntityId } from '../domain/types'
import type { CommandAck } from '../protocol/commands'
import type { AiSession } from './session'
import type { Controller, IdGenerator } from './view-store'

import { createCommand } from '../protocol/commands'
import { createViewStore, defaultIdGenerator, sameItems } from './view-store'

export type ChangeSetAction = 'apply' | 'discard' | 'rebase'

export interface ChangeSetActionsViewState {
  changeSetId: EntityId
  status?: ChangeSetStatus
  pendingAction?: ChangeSetAction
  availableActions: readonly ChangeSetAction[]
  conflicted: boolean
  lastError?: string
  lastErrorCode?: string
}

export interface ChangeSetActionsOptions {
  session: Pick<AiSession, 'store' | 'execute'>
  changeSetId: EntityId
  createId?: IdGenerator
}

export interface ChangeSetActionsController extends Controller<ChangeSetActionsViewState> {
  request: (action: ChangeSetAction) => Promise<CommandAck>
}

const ACTION_SOURCES: Readonly<
  Record<ChangeSetAction, readonly ChangeSetStatus[]>
> = {
  apply: ['ready'],
  discard: ['draft', 'ready', 'conflicted'],
  rebase: ['conflicted'],
}

export function availableChangeSetActions(
  changeSet: ChangeSet | undefined,
): ChangeSetAction[] {
  if (!changeSet) return []
  return (Object.keys(ACTION_SOURCES) as ChangeSetAction[]).filter(action =>
    ACTION_SOURCES[action].includes(changeSet.status),
  )
}

export function createChangeSetActions(
  options: ChangeSetActionsOptions,
): ChangeSetActionsController {
  const { store } = options.session
  const createId = options.createId ?? defaultIdGenerator
  let inFlight:
    | { action: ChangeSetAction; promise: Promise<CommandAck> }
    | undefined

  function read(
    pendingAction: ChangeSetAction | undefined,
  ): Omit<ChangeSetActionsViewState, 'lastError' | 'lastErrorCode'> {
    const changeSet = store.getState().changeSets[options.changeSetId]
    return {
      changeSetId: options.changeSetId,
      status: changeSet?.status,
      pendingAction,
      availableActions: pendingAction
        ? []
        : availableChangeSetActions(changeSet),
      conflicted: changeSet?.status === 'conflicted',
    }
  }

  const view = createViewStore<ChangeSetActionsViewState>(read(undefined))

  view.onDispose(
    store.subscribe(
      state => state.changeSets[options.changeSetId],
      changeSet => {
        const current = view.getSnapshot()
        // Any host-side movement of the change set settles a pending intent.
        const pending =
          current.pendingAction && changeSet?.status !== current.status
            ? undefined
            : current.pendingAction
        const next = read(pending)
        view.update({
          ...next,
          availableActions: sameItems(
            current.availableActions,
            next.availableActions,
          )
            ? current.availableActions
            : next.availableActions,
        })
      },
    ),
  )

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    request(action): Promise<CommandAck> {
      if (inFlight) {
        return inFlight.action === action
          ? inFlight.promise
          : Promise.resolve({
              accepted: false,
              commandId: '',
              code: 'AI_CHANGESET_ACTION_PENDING',
              message: `${inFlight.action} is already in flight`,
            })
      }

      const changeSet = store.getState().changeSets[options.changeSetId]

      if (
        !changeSet ||
        !availableChangeSetActions(changeSet).includes(action)
      ) {
        return Promise.resolve({
          accepted: false,
          commandId: '',
          code: 'AI_CHANGESET_ACTION_UNAVAILABLE',
          message: `${action} is not available for change set ${options.changeSetId}`,
        })
      }

      view.update({
        pendingAction: action,
        availableActions: [],
        lastError: undefined,
        lastErrorCode: undefined,
      })

      const promise = options.session
        .execute(
          createCommand({
            commandId: createId('cmd'),
            idempotencyKey: `${changeSet.id}:${action}:${changeSet.revision}`,
            type: `changeset.${action}`,
            target: { kind: 'changeset', id: changeSet.id },
            expectedRevision: changeSet.revision,
            payload: {
              changeSetId: changeSet.id,
              workspaceId: changeSet.workspaceId,
              baseRevision: changeSet.baseRevision,
            },
          }),
        )
        .then(ack => {
          if (!ack.accepted) {
            view.update({
              ...read(undefined),
              lastError: ack.message,
              lastErrorCode: ack.code,
            })
          }
          return ack
        })
        .catch((error: unknown) => {
          view.update({
            ...read(undefined),
            lastError: error instanceof Error ? error.message : String(error),
            lastErrorCode:
              (error as { code?: string }).code ?? 'AI_COMMAND_TRANSPORT',
          })
          throw error
        })
        .finally(() => {
          inFlight = undefined
        })

      inFlight = { action, promise }
      return promise
    },
    dispose(): void {
      view.dispose()
    },
  }
}
