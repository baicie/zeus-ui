/**
 * Artifacts, previews and citations (AI2-210).
 *
 * - Which preview an artifact gets is decided from its MIME type by an
 *   allowlist. Plain text and raster images can be shown inline; HTML, SVG
 *   and anything scriptable only through a sandboxed renderer; everything
 *   else is download-only. Model output is never injected as markup.
 * - Citations are `reference` parts. A source the application cannot
 *   resolve degrades to its label instead of disappearing, and only
 *   `http(s)` links are ever offered.
 */

import type { Artifact, EntityId } from '../domain/types'
import type { AiState } from '../store/state'
import type { AiSession } from './session'
import type { Controller } from './view-store'

import { createViewStore, sameItems } from './view-store'

export type PreviewKind = 'text' | 'image' | 'sandboxed' | 'download-only'

const TEXT_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/x-diff',
]
const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
]
const SANDBOX_TYPES = ['text/html', 'image/svg+xml', 'application/xhtml+xml']

export function classifyPreview(mimeType: string): PreviewKind {
  const type = mimeType.split(';')[0].trim().toLowerCase()
  if (TEXT_TYPES.includes(type)) return 'text'
  if (IMAGE_TYPES.includes(type)) return 'image'
  if (SANDBOX_TYPES.includes(type)) return 'sandboxed'
  return 'download-only'
}

/** Only absolute http(s) URLs may become links; everything else is text. */
export function safeExternalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

export type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error' | 'blocked'

export interface ArtifactPreviewState {
  artifactId: EntityId
  kind: PreviewKind
  status: PreviewStatus
  /** Decoded text for `text` previews. */
  text?: string
  /** Bytes for `image` / `sandboxed` previews; the renderer builds a URL. */
  bytes?: Uint8Array
  error?: string
}

export interface ArtifactViewState {
  artifactIds: readonly EntityId[]
  selectedId?: EntityId
  preview?: ArtifactPreviewState
}

export interface ArtifactControllerOptions {
  session: Pick<AiSession, 'store' | 'host'>
  /** Limit to one execution's artifacts. */
  executionId?: EntityId
  /** Whether a sandboxed renderer is installed. Default false. */
  sandboxAvailable?: boolean
  /** Refuse to load previews larger than this. Default 2 MiB. */
  maxPreviewBytes?: number
}

export interface ArtifactController extends Controller<ArtifactViewState> {
  select: (artifactId: EntityId | undefined) => Promise<void>
}

async function readAll(
  content: Uint8Array | ReadableStream<Uint8Array>,
  limit: number,
): Promise<Uint8Array> {
  if (content instanceof Uint8Array) {
    if (content.byteLength > limit) throw new Error('preview too large')
    return content
  }

  const reader = content.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw new Error('preview too large')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export function createArtifactController(
  options: ArtifactControllerOptions,
): ArtifactController {
  const { store, host } = options.session
  const limit = options.maxPreviewBytes ?? 2 * 1024 * 1024
  let loadToken = 0

  function listIds(): EntityId[] {
    const artifacts = store.getState().artifacts
    return artifacts
      .values()
      .filter(
        artifact =>
          options.executionId === undefined ||
          artifact.executionId === options.executionId,
      )
      .map(artifact => artifact.id)
  }

  const view = createViewStore<ArtifactViewState>({ artifactIds: listIds() })

  view.onDispose(
    store.subscribe(
      state => state.artifacts,
      () => {
        const next = listIds()
        if (!sameItems(view.getSnapshot().artifactIds, next)) {
          view.update({ artifactIds: next })
        }
      },
    ),
  )

  async function load(artifact: Artifact, token: number): Promise<void> {
    const kind = classifyPreview(artifact.asset.mimeType)
    const base = { artifactId: artifact.id, kind }

    if (
      kind === 'download-only' ||
      (kind === 'sandboxed' && !options.sandboxAvailable)
    ) {
      view.update({ preview: { ...base, status: 'blocked' } })
      return
    }

    if ((artifact.asset.size ?? 0) > limit) {
      view.update({
        preview: { ...base, status: 'blocked', error: 'preview too large' },
      })
      return
    }

    view.update({ preview: { ...base, status: 'loading' } })

    try {
      const bytes = await readAll(await host.loadAsset(artifact.asset), limit)
      if (token !== loadToken) return
      view.update({
        preview:
          kind === 'text'
            ? {
                ...base,
                status: 'ready',
                text: new TextDecoder().decode(bytes),
              }
            : { ...base, status: 'ready', bytes },
      })
    } catch (error) {
      if (token !== loadToken) return
      view.update({
        preview: {
          ...base,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    async select(artifactId): Promise<void> {
      loadToken += 1
      const token = loadToken
      const artifact = artifactId
        ? store.getState().artifacts.get(artifactId)
        : undefined
      view.update({ selectedId: artifact?.id, preview: undefined })
      if (artifact) await load(artifact, token)
    },
    dispose(): void {
      loadToken += 1
      view.dispose()
    },
  }
}

export interface CitationSource {
  title?: string
  url?: string
}

export interface Citation {
  partId: string
  sourceId: string
  label: string
  /** Present only for resolvable http(s) sources. */
  url?: string
  /** The application could not resolve the source; show the label only. */
  missing: boolean
}

/** Citations of one message, in part order. */
export function selectMessageCitations(
  state: Pick<AiState, 'messages'>,
  messageId: EntityId,
  resolveSource: (sourceId: string) => CitationSource | undefined = () =>
    undefined,
): Citation[] {
  const message = state.messages.get(messageId)
  if (!message) return []

  const citations: Citation[] = []

  for (const part of message.parts as readonly {
    id: string
    kind: string
    sourceId?: string
    label?: string
  }[]) {
    if (part.kind !== 'reference' || part.sourceId === undefined) continue
    const source = resolveSource(part.sourceId)
    citations.push({
      partId: part.id,
      sourceId: part.sourceId,
      label: source?.title ?? part.label ?? part.sourceId,
      url: safeExternalUrl(source?.url),
      missing: source === undefined,
    })
  }

  return citations
}
