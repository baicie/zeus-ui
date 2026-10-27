/**
 * Review controller (AI2-404) over the diff index (AI2-402).
 *
 * Review progress is local (`unreviewed → reviewed`), apply is a host fact
 * (01-ARCHITECTURE §6.4). This controller never applies anything:
 *
 * - file diffs load lazily, per file, when selected or requested, and are
 *   cached per change-set revision;
 * - comments anchor to `{ path, hunkId, changeSetRevision }`. When the change
 *   set moves to a new revision and the anchored hunk no longer exists, the
 *   comment is marked `outdated` instead of silently re-attaching to
 *   unrelated lines (02-INTERACTION-SPEC B6);
 * - submitting a comment is a `review.comment` command; marking a hunk
 *   reviewed is local and never approves an apply.
 */

import type { FileDiff } from '../diff/parser'
import type { ChangedFile, ChangeSet, EntityId } from '../domain/types'
import type { CommandAck } from '../protocol/commands'
import type { AiSession } from './session'
import type { Controller, IdGenerator } from './view-store'

import { parseUnifiedDiff } from '../diff/parser'
import { createCommand } from '../protocol/commands'
import { createViewStore, defaultIdGenerator } from './view-store'

export type FileDiffStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface FileDiffEntry {
  status: FileDiffStatus
  /** Change-set revision the entry was loaded for. */
  revision?: number
  diff?: FileDiff
  error?: string
}

export type ReviewCommentStatus =
  | 'draft'
  | 'submitting'
  | 'submitted'
  | 'failed'

export interface ReviewComment {
  id: string
  path: string
  hunkId: string
  changeSetRevision: number
  body: string
  status: ReviewCommentStatus
  outdated: boolean
  error?: string
}

export interface ReviewProgress {
  reviewed: number
  total: number
}

export interface ReviewViewState {
  changeSetId: EntityId
  changeSet?: ChangeSet
  selectedPath?: string
  selectedHunkId?: string
  diffs: Readonly<Record<string, FileDiffEntry>>
  /** Hunk ids the user marked as read. Local progress only. */
  reviewed: Readonly<Record<string, true>>
  progress: ReviewProgress
  comments: readonly ReviewComment[]
}

export interface ReviewControllerOptions {
  session: Pick<AiSession, 'store' | 'execute'>
  changeSetId: EntityId
  /** Fetch a file's unified diff text (usually via `host.loadAsset`). */
  loadDiff: (file: ChangedFile, changeSet: ChangeSet) => Promise<string>
  createId?: IdGenerator
}

export interface ReviewController extends Controller<ReviewViewState> {
  selectFile: (path: string) => Promise<void>
  selectHunk: (hunkId: string | undefined) => void
  /** Load a file's diff without selecting it (e.g. to prefetch). */
  ensureDiff: (path: string) => Promise<void>
  markReviewed: (hunkId: string, reviewed?: boolean) => void
  addComment: (path: string, hunkId: string, body: string) => string
  editComment: (commentId: string, body: string) => void
  submitComment: (commentId: string) => Promise<CommandAck>
}

type DiffRecord = Readonly<Record<string, FileDiffEntry>>

function knownHunks(diffs: DiffRecord): Set<string> {
  const ids = new Set<string>()
  for (const entry of Object.values(diffs)) {
    for (const hunk of entry.diff?.hunks ?? []) ids.add(hunk.id)
  }
  return ids
}

function progressOf(
  diffs: DiffRecord,
  reviewed: Readonly<Record<string, true>>,
): ReviewProgress {
  const known = knownHunks(diffs)
  return {
    reviewed: Object.keys(reviewed).filter(id => known.has(id)).length,
    total: known.size,
  }
}

/** Re-evaluate comment anchors against the diffs loaded for `revision`. */
function reanchor(
  comments: readonly ReviewComment[],
  diffs: DiffRecord,
  revision: number | undefined,
): readonly ReviewComment[] {
  return comments.map(comment => {
    if (revision === undefined || comment.changeSetRevision === revision) {
      return comment.outdated ? { ...comment, outdated: false } : comment
    }

    const entry = diffs[comment.path]
    if (!entry || entry.status !== 'ready' || entry.revision !== revision) {
      return comment
    }

    const stillThere =
      entry.diff?.hunks.some(hunk => hunk.id === comment.hunkId) ?? false
    return stillThere === !comment.outdated
      ? comment
      : { ...comment, outdated: !stillThere }
  })
}

export function createReviewController(
  options: ReviewControllerOptions,
): ReviewController {
  const { store } = options.session
  const createId = options.createId ?? defaultIdGenerator
  const loading = new Map<string, Promise<void>>()

  function currentChangeSet(): ChangeSet | undefined {
    return store.getState().changeSets[options.changeSetId]
  }

  const view = createViewStore<ReviewViewState>({
    changeSetId: options.changeSetId,
    changeSet: currentChangeSet(),
    diffs: {},
    reviewed: {},
    progress: { reviewed: 0, total: 0 },
    comments: [],
  })

  function setDiffs(diffs: DiffRecord, revision: number | undefined): void {
    const current = view.getSnapshot()
    view.update({
      diffs,
      progress: progressOf(diffs, current.reviewed),
      comments: reanchor(current.comments, diffs, revision),
    })
  }

  const controller: ReviewController = {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    ensureDiff(path): Promise<void> {
      const changeSet = currentChangeSet()
      const file = changeSet?.files.find(entry => entry.path === path)
      if (!changeSet || !file) return Promise.resolve()

      const existing = view.getSnapshot().diffs[path]
      if (
        existing?.status === 'ready' &&
        existing.revision === changeSet.revision
      ) {
        return Promise.resolve()
      }

      const key = `${changeSet.revision}:${path}`
      const pending = loading.get(key)
      if (pending) return pending

      const setEntry = (entry: FileDiffEntry): void => {
        // Ignore answers for a revision that is no longer current.
        if (currentChangeSet()?.revision !== changeSet.revision) return
        setDiffs(
          { ...view.getSnapshot().diffs, [path]: entry },
          changeSet.revision,
        )
      }

      setEntry({ status: 'loading', revision: changeSet.revision })

      const promise = options
        .loadDiff(file, changeSet)
        .then(text => {
          if (file.binary) {
            setEntry({
              status: 'ready',
              revision: changeSet.revision,
              diff: { path, binary: true, hunks: [], truncated: false },
            })
            return
          }

          const parsed = parseUnifiedDiff(text, { path })

          if (!parsed.ok) {
            setEntry({
              status: 'error',
              revision: changeSet.revision,
              error: parsed.message,
            })
            return
          }

          setEntry({
            status: 'ready',
            revision: changeSet.revision,
            diff: parsed.files.find(entry => entry.path === path) ??
              parsed.files[0] ?? {
                path,
                binary: false,
                hunks: [],
                truncated: false,
              },
          })
        })
        .catch((error: unknown) => {
          setEntry({
            status: 'error',
            revision: changeSet.revision,
            error: error instanceof Error ? error.message : String(error),
          })
        })
        .finally(() => loading.delete(key))

      loading.set(key, promise)
      return promise
    },
    selectFile(path): Promise<void> {
      view.update({ selectedPath: path, selectedHunkId: undefined })
      return controller.ensureDiff(path)
    },
    selectHunk(hunkId): void {
      view.update({ selectedHunkId: hunkId })
    },
    markReviewed(hunkId, reviewed = true): void {
      const current = view.getSnapshot()
      if (Boolean(current.reviewed[hunkId]) === reviewed) return

      const next: Record<string, true> = { ...current.reviewed }
      if (reviewed) next[hunkId] = true
      else delete next[hunkId]

      view.update({ reviewed: next, progress: progressOf(current.diffs, next) })
    },
    addComment(path, hunkId, body): string {
      const id = createId('comment')
      const revision = currentChangeSet()?.revision ?? 0
      view.update(current => ({
        comments: [
          ...current.comments,
          {
            id,
            path,
            hunkId,
            changeSetRevision: revision,
            body,
            status: 'draft',
            outdated: false,
          },
        ],
      }))
      return id
    },
    editComment(commentId, body): void {
      view.update(current => ({
        comments: current.comments.map(comment =>
          comment.id === commentId && comment.status !== 'submitted'
            ? { ...comment, body, status: 'draft' as const }
            : comment,
        ),
      }))
    },
    submitComment(commentId): Promise<CommandAck> {
      const comment = view
        .getSnapshot()
        .comments.find(entry => entry.id === commentId)

      if (
        !comment ||
        !currentChangeSet() ||
        comment.outdated ||
        comment.status === 'submitting' ||
        comment.status === 'submitted'
      ) {
        return Promise.resolve({
          accepted: false,
          commandId: '',
          code: comment?.outdated
            ? 'AI_REVIEW_COMMENT_OUTDATED'
            : 'AI_REVIEW_COMMENT_UNAVAILABLE',
          message: `comment ${commentId} cannot be submitted`,
        })
      }

      const setStatus = (status: ReviewCommentStatus, error?: string): void => {
        view.update(current => ({
          comments: current.comments.map(entry =>
            entry.id === commentId ? { ...entry, status, error } : entry,
          ),
        }))
      }

      setStatus('submitting')

      return options.session
        .execute(
          createCommand({
            commandId: createId('cmd'),
            idempotencyKey: `${commentId}:${comment.changeSetRevision}`,
            type: 'review.comment',
            target: { kind: 'changeset', id: options.changeSetId },
            expectedRevision: comment.changeSetRevision,
            payload: {
              path: comment.path,
              hunkId: comment.hunkId,
              changeSetRevision: comment.changeSetRevision,
              body: comment.body,
            },
          }),
        )
        .then(ack => {
          setStatus(
            ack.accepted ? 'submitted' : 'failed',
            ack.accepted ? undefined : ack.message,
          )
          return ack
        })
        .catch((error: unknown) => {
          setStatus(
            'failed',
            error instanceof Error ? error.message : String(error),
          )
          throw error
        })
    },
    dispose(): void {
      view.dispose()
    },
  }

  view.onDispose(
    store.subscribe(
      state => state.changeSets[options.changeSetId],
      changeSet => {
        const current = view.getSnapshot()
        const revisionChanged =
          changeSet?.revision !== current.changeSet?.revision

        view.update({ changeSet })

        if (!revisionChanged) return

        // A new revision invalidates loaded diffs; they reload lazily, and
        // comments are re-anchored once the new hunks are known.
        setDiffs({}, changeSet?.revision)
        if (current.selectedPath)
          void controller.ensureDiff(current.selectedPath)
      },
    ),
  )

  return controller
}
