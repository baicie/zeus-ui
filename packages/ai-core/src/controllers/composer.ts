/**
 * Composer controller (AI2-202).
 *
 * `idle → dirty → submitting → accepted | rejected` (01-ARCHITECTURE §6.2,
 * 02-INTERACTION-SPEC B1):
 *
 * - every edit bumps `draftRevision`; a submission records the revision it
 *   sent and uses one idempotency key per revision, so retrying the same
 *   draft is safe and an edited draft never reuses the old key;
 * - a duplicate submit of the same revision while one is pending returns the
 *   same promise instead of sending twice;
 * - the draft is cleared only after the host accepts, and only the parts the
 *   user did not change after submitting (a late ack never erases new text);
 * - rejection, transport failure and failed uploads keep the draft;
 * - IME composition blocks Enter-to-send and submit;
 * - attachments still uploading block submit unless the policy allows
 *   deferred assets.
 */

import type { AssetRef, EntityId } from '../domain/types'
import type { CommandAck } from '../protocol/commands'
import type { AiSession } from './session'
import type { Controller, IdGenerator } from './view-store'

import { createCommand } from '../protocol/commands'
import { createViewStore, defaultIdGenerator } from './view-store'

export interface ContextSelection {
  kind: 'file' | 'repository' | 'selection' | 'link' | 'custom'
  id: string
  label: string
}

export type AttachmentStatus = 'uploading' | 'ready' | 'failed'

export interface ComposerAttachment {
  /** Local id, stable while the attachment is in the draft. */
  id: string
  name: string
  status: AttachmentStatus
  /** Set once the upload adapter returns an authorized asset. */
  asset?: AssetRef
  /** 0–1 while uploading, when the uploader reports it. */
  progress?: number
  error?: string
}

export type ComposerPhase =
  | 'idle'
  | 'dirty'
  | 'submitting'
  | 'accepted'
  | 'rejected'

export type ComposerBlockReason =
  | 'empty'
  | 'composing'
  | 'uploading'
  | 'upload-failed'
  | 'submitting'

export interface ComposerViewState {
  text: string
  attachments: readonly ComposerAttachment[]
  context: readonly ContextSelection[]
  composing: boolean
  phase: ComposerPhase
  draftRevision: number
  /** Revision of the draft currently or last submitted. */
  submittedRevision?: number
  /** Why submit is unavailable right now, if it is. */
  blockedReason?: ComposerBlockReason
  lastError?: string
  lastErrorCode?: string
}

export interface ComposerSubmitPolicy {
  /** What a plain Enter does. Default `submit`. */
  enter?: 'submit' | 'newline'
  /** Whether Ctrl/Meta+Enter forces a submit. Default true. */
  modEnterSubmits?: boolean
  /** Allow sending attachments with an empty text. Default true. */
  allowAttachmentsOnly?: boolean
  /** Allow sending while uploads are still running. Default false. */
  allowDeferredAssets?: boolean
}

export interface ComposerControlled {
  /** Called instead of updating the text when the owner controls it. */
  onTextChange: (text: string) => void
}

export interface ComposerControllerOptions {
  session: Pick<AiSession, 'execute'>
  conversationId: EntityId
  /** Parent of the message being composed (the visible branch leaf). */
  parentMessageId?: () => EntityId | undefined
  submitPolicy?: ComposerSubmitPolicy
  initialText?: string
  /**
   * Controlled text: the owner holds the value and pushes it back with
   * `syncText`. The mode is fixed for the controller's lifetime.
   */
  controlled?: ComposerControlled
  createId?: IdGenerator
  onWarning?: (message: string) => void
}

/** Framework-neutral key press, as adapters translate it. */
export interface ComposerKeyIntent {
  key: string
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  /** `KeyboardEvent.isComposing` or keyCode 229 */
  isComposing?: boolean
  /** A suggestion menu (@ / slash) is open and owns Enter. */
  menuOpen?: boolean
}

export type ComposerKeyAction = 'submit' | 'newline' | 'none'

export interface ComposerController extends Controller<ComposerViewState> {
  setText: (text: string) => void
  /** Owner-pushed value in controlled mode. */
  syncText: (text: string) => void
  setComposing: (active: boolean) => void
  /** Start tracking an attachment; returns its local id. */
  addAttachment: (input: {
    name: string
    asset?: AssetRef
    status?: AttachmentStatus
  }) => string
  updateAttachment: (
    id: string,
    patch: Partial<Omit<ComposerAttachment, 'id'>>,
  ) => void
  removeAttachment: (id: string) => void
  setContext: (context: readonly ContextSelection[]) => void
  /** Decide what a key press means; the adapter performs the action. */
  resolveKey: (intent: ComposerKeyIntent) => ComposerKeyAction
  submit: () => Promise<CommandAck>
}

interface Submission {
  revision: number
  idempotencyKey: string
  text: string
  attachmentIds: readonly string[]
  context: readonly ContextSelection[]
  promise: Promise<CommandAck>
}

function localAck(code: string, message: string): CommandAck {
  return { accepted: false, commandId: '', code, message }
}

export function createComposerController(
  options: ComposerControllerOptions,
): ComposerController {
  const policy: Required<ComposerSubmitPolicy> = {
    enter: options.submitPolicy?.enter ?? 'submit',
    modEnterSubmits: options.submitPolicy?.modEnterSubmits ?? true,
    allowAttachmentsOnly: options.submitPolicy?.allowAttachmentsOnly ?? true,
    allowDeferredAssets: options.submitPolicy?.allowDeferredAssets ?? false,
  }
  const createId = options.createId ?? defaultIdGenerator
  const draftId = createId('draft')
  let attachmentCounter = 0
  let submission: Submission | undefined
  /** Revision whose idempotency key may be reused by a retry. */
  let retryable: { revision: number; idempotencyKey: string } | undefined

  const initialText = options.initialText ?? ''
  const view = createViewStore<ComposerViewState>({
    text: initialText,
    attachments: [],
    context: [],
    composing: false,
    phase: initialText ? 'dirty' : 'idle',
    draftRevision: 0,
  })

  function blockedReason(
    state: Omit<ComposerViewState, 'blockedReason'>,
  ): ComposerBlockReason | undefined {
    if (state.composing) return 'composing'
    if (state.phase === 'submitting') return 'submitting'
    if (state.attachments.some(item => item.status === 'failed')) {
      return 'upload-failed'
    }
    if (
      !policy.allowDeferredAssets &&
      state.attachments.some(item => item.status === 'uploading')
    ) {
      return 'uploading'
    }

    const hasText = state.text.trim().length > 0
    const hasAttachments = state.attachments.length > 0

    if (!hasText && !(policy.allowAttachmentsOnly && hasAttachments)) {
      return 'empty'
    }

    return undefined
  }

  function isEmptyDraft(state: Readonly<ComposerViewState>): boolean {
    return (
      state.text.length === 0 &&
      state.attachments.length === 0 &&
      state.context.length === 0
    )
  }

  /** Apply a draft edit: bumps the revision and recomputes derived fields. */
  function edit(
    patch: Partial<
      Pick<ComposerViewState, 'text' | 'attachments' | 'context' | 'composing'>
    >,
    bumpRevision = true,
  ): void {
    view.update(current => {
      const next = { ...current, ...patch }
      const draftRevision = bumpRevision
        ? current.draftRevision + 1
        : current.draftRevision
      const phase: ComposerPhase =
        current.phase === 'submitting'
          ? 'submitting'
          : isEmptyDraft(next)
            ? 'idle'
            : current.phase === 'rejected' && !bumpRevision
              ? 'rejected'
              : 'dirty'
      const merged = { ...next, draftRevision, phase }
      return { ...merged, blockedReason: blockedReason(merged) }
    })
  }

  view.update(current => ({ blockedReason: blockedReason(current) }))

  async function send(
    current: Readonly<ComposerViewState>,
  ): Promise<CommandAck> {
    const revision = current.draftRevision
    const idempotencyKey =
      retryable && retryable.revision === revision
        ? retryable.idempotencyKey
        : `${draftId}:${revision}`
    const command = createCommand({
      commandId: createId('cmd'),
      idempotencyKey,
      type: 'message.send',
      target: { kind: 'conversation', id: options.conversationId },
      payload: {
        text: current.text,
        attachments: current.attachments
          .map(item => item.asset)
          .filter((asset): asset is AssetRef => asset !== undefined),
        context: current.context,
        parentMessageId: options.parentMessageId?.(),
      },
    })

    retryable = { revision, idempotencyKey }

    try {
      const ack = await options.session.execute(command)

      if (ack.accepted) {
        retryable = undefined
        settleAccepted()
      } else {
        settleRejected(ack.message, ack.code)
      }

      return ack
    } catch (error) {
      settleRejected(
        error instanceof Error ? error.message : String(error),
        (error as { code?: string }).code ?? 'AI_COMMAND_TRANSPORT',
      )
      throw error
    } finally {
      submission = undefined
    }
  }

  function settleAccepted(): void {
    const sent = submission
    if (!sent) return

    view.update(current => {
      // Only what the user left untouched since submitting is cleared.
      const text = current.text === sent.text ? '' : current.text
      const attachments = current.attachments.filter(
        item => !sent.attachmentIds.includes(item.id),
      )
      const context = current.context === sent.context ? [] : current.context
      const unchanged = current.draftRevision === sent.revision
      const next = {
        ...current,
        text,
        attachments,
        context,
        phase: (isEmptyDraft({ ...current, text, attachments, context })
          ? 'accepted'
          : 'dirty') as ComposerPhase,
        draftRevision: unchanged
          ? current.draftRevision + 1
          : current.draftRevision,
        lastError: undefined,
        lastErrorCode: undefined,
      }
      return { ...next, blockedReason: blockedReason(next) }
    })
  }

  function settleRejected(message: string, code: string): void {
    view.update(current => {
      const next = {
        ...current,
        phase: 'rejected' as ComposerPhase,
        lastError: message,
        lastErrorCode: code,
      }
      return { ...next, blockedReason: blockedReason(next) }
    })
  }

  const controller: ComposerController = {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    setText(text: string): void {
      if (options.controlled) {
        options.controlled.onTextChange(text)
        return
      }
      if (text === view.getSnapshot().text) return
      edit({ text })
    },
    syncText(text: string): void {
      if (!options.controlled) {
        options.onWarning?.(
          'syncText() was called on an uncontrolled composer; use setText()',
        )
        return
      }
      if (text === view.getSnapshot().text) return
      edit({ text })
    },
    setComposing(active: boolean): void {
      if (active === view.getSnapshot().composing) return
      edit({ composing: active }, false)
    },
    addAttachment(input): string {
      attachmentCounter += 1
      const id = `${draftId}:att-${attachmentCounter}`
      edit({
        attachments: [
          ...view.getSnapshot().attachments,
          {
            id,
            name: input.name,
            status: input.status ?? (input.asset ? 'ready' : 'uploading'),
            asset: input.asset,
          },
        ],
      })
      return id
    },
    updateAttachment(id, patch): void {
      const attachments = view
        .getSnapshot()
        .attachments.map(item =>
          item.id === id ? { ...item, ...patch } : item,
        )
      edit({ attachments })
    },
    removeAttachment(id: string): void {
      const current = view.getSnapshot().attachments
      if (!current.some(item => item.id === id)) return
      edit({ attachments: current.filter(item => item.id !== id) })
    },
    setContext(context): void {
      edit({ context: [...context] })
    },
    resolveKey(intent: ComposerKeyIntent): ComposerKeyAction {
      if (intent.key !== 'Enter') return 'none'
      // The input method owns Enter while composing; a menu owns it too.
      if (intent.isComposing || view.getSnapshot().composing) return 'none'
      if (intent.menuOpen) return 'none'
      if (intent.shiftKey) return 'newline'
      if (intent.ctrlKey || intent.metaKey) {
        return policy.modEnterSubmits ? 'submit' : 'newline'
      }
      return policy.enter === 'submit' ? 'submit' : 'newline'
    },
    submit(): Promise<CommandAck> {
      const current = view.getSnapshot()

      if (submission && submission.revision === current.draftRevision) {
        return submission.promise
      }

      const reason = current.blockedReason

      if (reason) {
        return Promise.resolve(
          localAck(
            `AI_COMPOSER_${reason.toUpperCase().replace(/-/g, '_')}`,
            `composer cannot submit: ${reason}`,
          ),
        )
      }

      view.update(state => {
        const next = {
          ...state,
          phase: 'submitting' as ComposerPhase,
          submittedRevision: state.draftRevision,
          lastError: undefined,
          lastErrorCode: undefined,
        }
        return { ...next, blockedReason: blockedReason(next) }
      })

      const pending: Submission = {
        revision: current.draftRevision,
        idempotencyKey: '',
        text: current.text,
        attachmentIds: current.attachments.map(item => item.id),
        context: current.context,
        promise: Promise.resolve(localAck('', '')),
      }
      submission = pending
      pending.promise = send(current)

      return pending.promise
    },
    dispose(): void {
      view.dispose()
    },
  }

  return controller
}
