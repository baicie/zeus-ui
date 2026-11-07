/* eslint-disable no-restricted-globals */
import type {
  ApprovalController,
  Conversation,
  ReviewController,
} from '@zeus-web/ai-core'
import type { AiElementInstance } from '@zeus-web/ai-wc'
import { createSseHostAdapter } from '@zeus-web/ai-adapters'
import {
  createAiSession,
  createApprovalController,
  createCommand,
  createComposerController,
  createConversationController,
  createReviewController,
  createTestReportController,
} from '@zeus-web/ai-core'
import {
  defineAiApprovalPrompt,
  defineAiComposer,
  defineAiConversationList,
  defineAiDiffViewer,
  defineAiFileChangeTree,
  defineAiMessageTimeline,
  defineAiTestReport,
} from '@zeus-web/ai-wc'

import './styles.css'

defineAiComposer()
defineAiMessageTimeline()
defineAiApprovalPrompt()
defineAiConversationList()
defineAiFileChangeTree()
defineAiDiffViewer()
defineAiTestReport()

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Missing #app root')

declare const __ZEUS_AI_HOST__: string

const configuredHost = __ZEUS_AI_HOST__ || undefined
const hostBaseUrl = configuredHost ?? `${location.origin}/ai-host`
const host = createSseHostAdapter({ baseUrl: hostBaseUrl })
let readOnly = false
const session = createAiSession({
  host,
  streamId: 'reference',
  snapshotScope: { kind: 'stream', id: 'reference' },
  retryDelayMs: 120,
})

let conversationId = 'workbench'
let conversation = createConversationController({ session, conversationId })
let composer = createComposerController({
  session,
  conversationId,
  parentMessageId: () => conversation.getSnapshot().leafMessageId,
})

const shell = document.createElement('main')
shell.className = 'workbench'

const header = document.createElement('header')
header.className = 'topbar'
header.innerHTML = `
  <div>
    <p class="eyebrow">Zeus Native · AI Headless V2</p>
    <h1>AI Workbench</h1>
  </div>
  <div class="status" data-testid="connection" data-connection="idle">idle</div>
`
shell.append(header)

const replayBanner = document.createElement('p')
replayBanner.className = 'replay-banner'
replayBanner.dataset.testid = 'public-replay'
replayBanner.textContent =
  'Public replay · read-only. Sending messages, proposing and approving are disabled.'
replayBanner.hidden = true
shell.append(replayBanner)

const layout = document.createElement('div')
layout.className = 'layout'

const sessionPane = document.createElement('aside')
sessionPane.className = 'sessions'
sessionPane.setAttribute('aria-label', 'Sessions')
const newConversation = document.createElement('button')
newConversation.type = 'button'
newConversation.className = 'new-conversation'
newConversation.dataset.testid = 'new-conversation'
newConversation.textContent = 'New session'
const conversationList = document.createElement(
  'zw-ai-conversation-list',
) as AiElementInstance & {
  conversations: readonly Conversation[]
  selectedId: string
}
conversationList.dataset.testid = 'conversation-list'
conversationList.className = 'conversation-list'
sessionPane.append(newConversation, conversationList)

const conversationPane = document.createElement('section')
conversationPane.className = 'conversation'
conversationPane.dataset.testid = 'conversation'
let timeline = createTimeline()
let composerElement = createComposerElement()
conversationPane.append(timeline, composerElement)

const side = document.createElement('aside')
side.className = 'side'
side.setAttribute('aria-label', 'Workspace review')
const propose = document.createElement('button')
propose.type = 'button'
propose.dataset.testid = 'propose-change'
propose.textContent = 'Request protected write'
propose.className = 'propose'
const approval = document.createElement('div')
approval.dataset.testid = 'approvals'
approval.className = 'approvals'
approval.textContent = 'No pending approvals'

const reviewHeading = document.createElement('h2')
reviewHeading.textContent = 'Changed files'
const changeTree = document.createElement(
  'zw-ai-file-change-tree',
) as AiElementInstance & { review: ReviewController | undefined }
changeTree.dataset.testid = 'change-tree'
changeTree.className = 'change-tree'
const diffViewer = document.createElement(
  'zw-ai-diff-viewer',
) as AiElementInstance & { review: ReviewController | undefined }
diffViewer.dataset.testid = 'diff-viewer'
diffViewer.className = 'diff-viewer'
diffViewer.setAttribute('layout', 'unified')
const runChecks = document.createElement('button')
runChecks.type = 'button'
runChecks.className = 'run-checks'
runChecks.dataset.testid = 'run-checks'
runChecks.textContent = 'Run checks'
const testReport = document.createElement(
  'zw-ai-test-report',
) as AiElementInstance & { controller: unknown }
testReport.dataset.testid = 'test-report'
testReport.className = 'test-report'
runChecks.addEventListener('click', () => void loadTestReport())
side.append(
  propose,
  approval,
  reviewHeading,
  changeTree,
  diffViewer,
  runChecks,
  testReport,
)

async function loadTestReport(): Promise<void> {
  runChecks.disabled = true
  testReport.controller = undefined
  try {
    const response = await fetch(`${hostBaseUrl}/test-report`, {
      method: 'POST',
    })
    const payload = (await response.json()) as {
      report?: unknown
      error?: { message?: string }
    }
    if (!response.ok || !payload.report) {
      throw new Error(
        payload.error?.message ?? `Checks failed (${response.status})`,
      )
    }
    const controller = createTestReportController({
      report: payload.report as Parameters<
        typeof createTestReportController
      >[0]['report'],
      loadOutput: async asset => {
        const content = await host.loadAsset(asset)
        const bytes =
          content instanceof Uint8Array
            ? content
            : new Uint8Array(await new Response(content).arrayBuffer())
        return new TextDecoder().decode(bytes)
      },
    })
    testReport.controller = controller
    testReport.requestRender()
  } catch (error) {
    testReport.controller = undefined
    testReport.setAttribute(
      'data-error',
      error instanceof Error ? error.message : String(error),
    )
  } finally {
    runChecks.disabled = false
  }
}
layout.append(sessionPane, conversationPane, side)
shell.append(layout)
root.append(shell)

function createTimeline(): HTMLElement {
  const element = document.createElement(
    'zw-ai-message-timeline',
  ) as AiElementInstance & { conversation: unknown; session: unknown }
  element.session = session
  element.conversation = conversation
  element.setAttribute('label', 'Workbench conversation')
  element.dataset.testid = 'timeline'
  element.classList.add('timeline')
  return element
}

function createComposerElement(): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'composer-stack'
  const element = document.createElement(
    'zw-ai-composer',
  ) as AiElementInstance & { controller: unknown }
  element.controller = composer
  element.setAttribute('label', 'Ask the agent')
  if (readOnly) element.setAttribute('disabled', '')
  element.dataset.testid = 'composer'
  element.classList.add('composer')
  const fileLabel = document.createElement('label')
  fileLabel.className = 'attach'
  fileLabel.textContent = 'Attach file'
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'text/plain,application/json,image/png,image/jpeg'
  fileInput.dataset.testid = 'attach-file'
  fileInput.disabled = readOnly
  fileLabel.append(fileInput)
  const attachStatus = document.createElement('span')
  attachStatus.className = 'attach-status'
  attachStatus.dataset.testid = 'attach-status'
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (!file) return
    void uploadAttachment(file, attachStatus)
  })
  wrapper.append(element, fileLabel, attachStatus)
  return wrapper
}

async function uploadAttachment(
  file: File,
  status: HTMLElement,
): Promise<void> {
  status.textContent = 'Uploading…'
  const localId = composer.addAttachment({
    name: file.name,
    status: 'uploading',
  })
  try {
    const data = await file.arrayBuffer()
    const response = await fetch(`${hostBaseUrl}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type || 'text/plain',
        data: bytesToBase64(new Uint8Array(data)),
      }),
    })
    const payload = (await response.json()) as {
      asset?: { id: string; mimeType: string; size?: number }
      error?: { message?: string }
    }
    if (!response.ok || !payload.asset) {
      throw new Error(
        payload.error?.message ?? `Upload failed (${response.status})`,
      )
    }
    composer.updateAttachment(localId, {
      asset: payload.asset,
      status: 'ready',
    })
    status.textContent = `${file.name} attached`
  } catch (error) {
    composer.updateAttachment(localId, { status: 'failed' })
    status.textContent =
      error instanceof Error ? error.message : 'Attachment upload failed'
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const knownConversations = new Map<string, Conversation>()
knownConversations.set(conversationId, {
  id: conversationId,
  title: 'Reference conversation',
  revision: 1,
})

function activateConversation(id: string): void {
  if (id === conversationId) return
  conversationId = id
  conversation = createConversationController({ session, conversationId })
  composer = createComposerController({
    session,
    conversationId,
    parentMessageId: () => conversation.getSnapshot().leafMessageId,
  })
  timeline.replaceWith((timeline = createTimeline()))
  composerElement.replaceWith((composerElement = createComposerElement()))
  conversationList.selectedId = id
  conversationList.conversations = [...knownConversations.values()]
  conversationList.requestRender()
  updateGlobalWorkbench()
}

let conversationCounter = 1
newConversation.addEventListener('click', () => {
  conversationCounter += 1
  const id = `workbench-${conversationCounter}`
  knownConversations.set(id, {
    id,
    title: `Session ${conversationCounter}`,
    revision: 1,
  })
  // Publish the local session in the controller's view. The Host upserts the
  // same id on the first message, so reload cannot invent a second aggregate.
  activateConversation(id)
  conversationList.requestRender()
})

conversationList.conversations = [...knownConversations.values()]
conversationList.selectedId = conversationId
conversationList.addEventListener('zw-ai-select', event => {
  const detail = (event as CustomEvent<{ conversationId?: string }>).detail
  if (detail?.conversationId) activateConversation(detail.conversationId)
})

const connection = header.querySelector<HTMLElement>(
  '[data-testid="connection"]',
)!
session.subscribe(
  view => view.connection,
  state => {
    connection.textContent = state
    connection.dataset.connection = state
  },
)
session.connect()

function applyReadOnly(): void {
  replayBanner.hidden = !readOnly
  const composerControl = composerElement.querySelector('zw-ai-composer')
  if (composerControl) {
    if (readOnly) composerControl.setAttribute('disabled', '')
    else composerControl.removeAttribute('disabled')
  }
  propose.disabled = readOnly
  runChecks.disabled = readOnly
  newConversation.disabled = readOnly
}

void fetch(`${hostBaseUrl}/health`)
  .then(response => (response.ok ? response.json() : undefined))
  .then((health: { readOnly?: unknown } | undefined) => {
    if (health?.readOnly === true) {
      readOnly = true
      applyReadOnly()
    }
  })
  .catch(() => {
    // The Host remains the security boundary; a failed health probe only
    // leaves the UI in its default enabled state and writes still return 403.
  })

function refreshApprovals(): void {
  const pending = [...session.store.getState().approvals.values()].filter(
    item => item.status === 'pending',
  )
  approval.replaceChildren()
  if (pending.length === 0) {
    approval.textContent = 'No pending approvals'
    return
  }
  for (const item of pending) {
    const prompt = document.createElement(
      'zw-ai-approval-prompt',
    ) as AiElementInstance & { controller: ApprovalController }
    prompt.controller = createApprovalController({
      session,
      approvalId: item.id,
    })
    approval.append(prompt)
  }
}

refreshApprovals()
session.store.subscribe(
  state => `${state.approvals.size}:${state.cursors.reference ?? 0}`,
  () => refreshApprovals(),
)

let review: ReviewController | undefined
let reviewedChangeSetId: string | undefined

function refreshChangeSet(): void {
  const state = session.store.getState()
  const changeSets = [...state.changeSets.values()]
  const changeSet = changeSets[changeSets.length - 1]
  if (!changeSet || changeSet.id === reviewedChangeSetId) return
  reviewedChangeSetId = changeSet.id
  review?.dispose()
  review = createReviewController({
    session,
    changeSetId: changeSet.id,
    loadDiff: async file => {
      const asset = file.diffAsset
      if (!asset) return ''
      const content = await host.loadAsset(asset)
      const bytes =
        content instanceof Uint8Array
          ? content
          : new Uint8Array(await new Response(content).arrayBuffer())
      return new TextDecoder().decode(bytes)
    },
  })
  changeTree.review = review
  diffViewer.review = review
  const first = changeSet.files[0]
  if (first) void review.selectFile(first.path)
}

refreshChangeSet()
session.store.subscribe(
  state => `${state.changeSets.size}:${state.cursors.reference ?? 0}`,
  () => refreshChangeSet(),
)

propose.addEventListener('click', () => {
  void session.execute(
    createCommand({
      commandId: `propose-${Date.now()}`,
      idempotencyKey: `propose-${Date.now()}`,
      type: 'changeset.propose',
      target: { kind: 'workspace', id: 'reference' },
      payload: {
        files: [
          {
            path: 'notes/workbench.txt',
            content: 'Approved through the Zeus Native Workbench.\n',
          },
        ],
      },
    }),
  )
})

function updateGlobalWorkbench(): void {
  Object.assign(globalThis, {
    __aiWorkbench: {
      session,
      conversation,
      composer,
      get conversationId() {
        return conversationId
      },
    },
  })
}

updateGlobalWorkbench()
