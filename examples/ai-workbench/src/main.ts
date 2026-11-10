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

import { mountByokChat } from './byok/chat-view'
import { mountProviderPanel } from './byok/provider-panel'

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

const sidebarToggle = document.createElement('button')
sidebarToggle.type = 'button'
sidebarToggle.className = 'icon-button sidebar-toggle'
sidebarToggle.setAttribute('aria-label', 'Toggle sessions')
sidebarToggle.dataset.testid = 'sidebar-toggle'
sidebarToggle.textContent = '\u2261'
/**
 * Opens or closes the session drawer. It reads the live element rather than
 * closing over `layout`, which is initialised further down the module.
 */
function toggleSessions(): void {
  document.querySelector('.layout')?.classList.toggle('sessions-open')
}
sidebarToggle.addEventListener('click', () => toggleSessions())

const brand = document.createElement('div')
brand.className = 'topbar-brand'
const brandGlyph = document.createElement('span')
brandGlyph.className = 'brand-glyph'
brandGlyph.setAttribute('aria-hidden', 'true')
brandGlyph.textContent = 'Z'
const brandName = document.createElement('h1')
brandName.textContent = 'AI Workbench'
brand.append(brandGlyph, brandName)

const modeSwitch = document.createElement('div')
modeSwitch.className = 'mode-switch'
modeSwitch.setAttribute('role', 'group')
modeSwitch.setAttribute('aria-label', 'Run mode')
const hostModeButton = document.createElement('button')
hostModeButton.type = 'button'
hostModeButton.className = 'mode-option'
hostModeButton.dataset.testid = 'mode-host'
hostModeButton.textContent = 'Host'
const byokModeButton = document.createElement('button')
byokModeButton.type = 'button'
byokModeButton.className = 'mode-option'
byokModeButton.dataset.testid = 'mode-byok'
byokModeButton.textContent = 'BYOK'
const settingsButton = document.createElement('button')
settingsButton.type = 'button'
settingsButton.className = 'mode-option'
settingsButton.dataset.testid = 'open-settings'
settingsButton.textContent = 'Settings'
modeSwitch.append(hostModeButton, byokModeButton, settingsButton)

const topbarActions = document.createElement('div')
topbarActions.className = 'topbar-actions'

const inspectorToggle = document.createElement('button')
inspectorToggle.type = 'button'
inspectorToggle.className = 'inspector-toggle'
inspectorToggle.dataset.testid = 'inspector-toggle'
inspectorToggle.setAttribute('aria-expanded', 'false')
inspectorToggle.textContent = 'Activity'

const inspectorBadge = document.createElement('span')
inspectorBadge.className = 'inspector-badge'
inspectorBadge.hidden = true
inspectorToggle.append(inspectorBadge)

const connection = document.createElement('div')
connection.className = 'status'
connection.dataset.testid = 'connection'
connection.dataset.connection = 'idle'
connection.textContent = 'idle'

const themeToggle = document.createElement('button')
themeToggle.type = 'button'
themeToggle.className = 'icon-button'
themeToggle.dataset.testid = 'theme-toggle'
themeToggle.setAttribute('aria-label', 'Toggle colour scheme')
themeToggle.textContent = '\u25D1'

topbarActions.append(inspectorToggle, connection, themeToggle)
header.append(sidebarToggle, brand, modeSwitch, topbarActions)
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

const sessionsHeader = document.createElement('div')
sessionsHeader.className = 'sessions-header'
const newConversation = document.createElement('button')
newConversation.type = 'button'
newConversation.className = 'new-conversation'
newConversation.dataset.testid = 'new-conversation'
newConversation.textContent = 'New chat'
sessionsHeader.append(newConversation)

const sessionsScroll = document.createElement('div')
sessionsScroll.className = 'sessions-scroll'
const sessionsLabel = document.createElement('p')
sessionsLabel.className = 'sessions-label'
sessionsLabel.textContent = 'Recent'
const conversationList = document.createElement(
  'zw-ai-conversation-list',
) as AiElementInstance & {
  conversations: readonly Conversation[]
  selectedId: string
}
conversationList.dataset.testid = 'conversation-list'
conversationList.className = 'conversation-list'
sessionsScroll.append(sessionsLabel, conversationList)
sessionPane.append(sessionsHeader, sessionsScroll)

const conversationPane = document.createElement('section')
conversationPane.className = 'conversation'
conversationPane.dataset.testid = 'conversation'

const conversationHead = document.createElement('div')
conversationHead.className = 'conversation-head'
const conversationTitle = document.createElement('p')
conversationTitle.className = 'conversation-title'
const conversationMode = document.createElement('span')
conversationMode.className = 'conversation-mode'
conversationMode.textContent = 'Host · SSE'
conversationHead.append(conversationTitle, conversationMode)

// Welcome block shown until the conversation has a message. It sits beside the
// timeline rather than inside it so the published element is not forked.
const welcome = document.createElement('div')
welcome.className = 'welcome'
welcome.dataset.testid = 'welcome'
const welcomeMark = document.createElement('div')
welcomeMark.className = 'welcome-mark'
welcomeMark.setAttribute('aria-hidden', 'true')
welcomeMark.textContent = 'Z'
const welcomeTitle = document.createElement('p')
welcomeTitle.className = 'welcome-title'
welcomeTitle.textContent = 'What should we build?'
const welcomeCopy = document.createElement('p')
welcomeCopy.className = 'welcome-copy'
welcomeCopy.textContent =
  'Ask the agent to make a change. Protected writes arrive as an approval, and the diff stays in the activity panel.'
welcome.append(welcomeMark, welcomeTitle, welcomeCopy)

let timeline = createTimeline()
let composerElement = createComposerElement()
conversationPane.append(conversationHead, welcome, timeline, composerElement)

const side = document.createElement('aside')
side.className = 'side'
side.setAttribute('aria-label', 'Agent activity')
// Closed by default: a chat with no agent activity gets the full width.
side.hidden = true

const sideHead = document.createElement('div')
sideHead.className = 'side-head'
const sideTitle = document.createElement('span')
sideTitle.className = 'side-section-title'
sideTitle.textContent = 'Agent activity'
const sideClose = document.createElement('button')
sideClose.type = 'button'
sideClose.className = 'icon-button'
sideClose.style.marginLeft = 'auto'
sideClose.setAttribute('aria-label', 'Close activity panel')
sideClose.dataset.testid = 'inspector-close'
sideClose.textContent = '\u00D7'
sideHead.append(sideTitle, sideClose)

// Tabs keep the four review surfaces in one panel instead of three stacked
// columns. Only the selected pane is shown; all data bindings stay live.
const sideTabs = document.createElement('div')
sideTabs.className = 'side-tabs'
sideTabs.setAttribute('role', 'tablist')
const sideBody = document.createElement('div')
sideBody.className = 'side-body'

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
const reviewPane = document.createElement('div')
reviewPane.className = 'review-pane'
reviewPane.style.display = 'flex'
reviewPane.style.flexDirection = 'column'
reviewPane.style.gap = 'var(--wb-space-3)'
reviewPane.append(reviewHeading, changeTree, diffViewer)

const testsPane = document.createElement('div')
testsPane.className = 'tests-pane'
testsPane.style.display = 'none'
testsPane.style.flexDirection = 'column'
testsPane.style.gap = 'var(--wb-space-3)'
testsPane.append(runChecks, testReport)

type SideTabId = 'activity' | 'changes' | 'tests'
const sidePanes: Array<{ id: SideTabId; label: string; pane: HTMLElement }> = [
  { id: 'activity', label: 'Approvals', pane: approval },
  { id: 'changes', label: 'Changes', pane: reviewPane },
  { id: 'tests', label: 'Tests', pane: testsPane },
]

const sideTabButtons = new Map<SideTabId, HTMLButtonElement>()
for (const entry of sidePanes) {
  const tab = document.createElement('button')
  tab.type = 'button'
  tab.className = 'side-tab'
  tab.setAttribute('role', 'tab')
  tab.dataset.testid = `side-tab-${entry.id}`
  tab.textContent = entry.label
  tab.addEventListener('click', () => selectSideTab(entry.id))
  sideTabButtons.set(entry.id, tab)
  sideTabs.append(tab)
  if (entry.id !== 'activity') entry.pane.hidden = true
  sideBody.append(entry.pane)
}

function selectSideTab(id: SideTabId): void {
  for (const entry of sidePanes) {
    const selected = entry.id === id
    const tab = sideTabButtons.get(entry.id)
    if (tab) tab.setAttribute('aria-selected', String(selected))
    // `hidden` must not fight the inline display used for the flex panes.
    entry.pane.hidden = !selected
    entry.pane.style.display = selected ? 'flex' : 'none'
  }
}

selectSideTab('activity')
side.append(sideHead, sideTabs, sideBody, propose)

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
  updateConversationTitle()
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

/* ------------------------------------------------------- host connection */
// The status pill reflects the session's own connection state; the Host stays
// the authority for what the stream contains.
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
  updateInspectorBadge()
  if (pending.length === 0) {
    approval.textContent = 'No pending approvals'
    return
  }
  // A pending approval is the one thing that must not be missed.
  openInspector('activity')
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
  () => {
    refreshChangeSet()
    updateInspectorBadge()
  },
)

inspectorToggle.addEventListener('click', () => {
  if (side.hidden) openInspector()
  else closeInspector()
})
sideClose.addEventListener('click', closeInspector)

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

/** Opens the activity panel, because an approval needs an answer. */
function openInspector(tab?: 'activity' | 'changes' | 'tests'): void {
  side.hidden = false
  layout.classList.add('inspector-open')
  inspectorToggle.setAttribute('aria-expanded', 'true')
  if (tab) selectSideTab(tab)
}

function closeInspector(): void {
  side.hidden = true
  layout.classList.remove('inspector-open')
  inspectorToggle.setAttribute('aria-expanded', 'false')
}

/** Keeps the "activity" badge in step with what is waiting on the user. */
function updateInspectorBadge(): void {
  const state = session.store.getState()
  const pending = [...state.approvals.values()].filter(
    item => item.status === 'pending',
  ).length
  const hasChanges = state.changeSets.size > 0
  const total = pending + (hasChanges ? 1 : 0)
  inspectorBadge.hidden = total === 0
  inspectorBadge.textContent = String(total)
  // Deliberately does not close the panel. A panel the user opened stays open
  // until they close it; closing it here would fight the person using it.
}

/** The welcome block yields to the conversation once a message exists. */
function updateWelcome(): void {
  const state = session.store.getState()
  // `conversationMessageIds` is a record keyed by conversation; the messages of
  // the active conversation decide whether the welcome block still applies.
  const ids = state.conversationMessageIds[conversationId] ?? []
  welcome.hidden = ids.length > 0
}

function updateConversationTitle(): void {
  conversationTitle.textContent =
    knownConversations.get(conversationId)?.title ?? 'Conversation'
}

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

updateWelcome()
updateInspectorBadge()
updateGlobalWorkbench()

/* ---------------------------------------------------- host / byok modes */
/*
 * Two run modes share this shell.
 *
 * `host` is the agent: commands go to the Host over SSE, approvals gate writes,
 * and the Host's snapshot is the only authority for what happened.
 *
 * `byok` is the user's own model: requests go from this browser to the gateway
 * they configured, and messages live only in a local store. The two never share
 * a transport, a permission model or a data store, which is why the mode is an
 * explicit switch rather than a setting buried in a menu.
 */
let mode: 'host' | 'byok' = 'host'
let disposeByok: (() => void) | undefined
let disposeSettings: (() => void) | undefined

const byokHost = document.createElement('div')
byokHost.className = 'byok-host'
byokHost.hidden = true
layout.append(byokHost)

const settingsHost = document.createElement('section')
settingsHost.className = 'settings-page'
settingsHost.dataset.testid = 'settings-page'
settingsHost.hidden = true

function setMode(next: 'host' | 'byok'): void {
  mode = next
  hostModeButton.classList.toggle('is-active', next === 'host')
  byokModeButton.classList.toggle('is-active', next === 'byok')
  hostModeButton.setAttribute('aria-pressed', String(next === 'host'))
  byokModeButton.setAttribute('aria-pressed', String(next === 'byok'))

  if (next === 'byok') {
    closeInspector()
    conversationPane.hidden = true
    if (!disposeByok) {
      // The view owns its element; it mounts into a host that stays in the grid
      // so switching modes does not reflow the shell.
      byokHost.hidden = false
      disposeByok = mountByokChat({
        mode: 'byok',
        onModeChange: () => undefined,
        host: byokHost,
      })
    }
    byokHost.hidden = false
    return
  }

  conversationPane.hidden = false
  byokHost.hidden = true
}

let settingsOpen = false

function toggleSettings(open: boolean): void {
  if (open === settingsOpen) {
    // Already in the requested state; nothing to re-render.
    if (open) return
  }
  settingsOpen = open
  settingsButton.setAttribute('aria-pressed', String(open))
  if (open && !disposeSettings) {
    disposeSettings = mountProviderPanel({ root: settingsHost })
    layout.append(settingsHost)
  }
  settingsHost.hidden = !open
  settingsButton.classList.toggle('is-active', open)
  if (open) {
    if (mode !== 'byok') setMode('byok')
    conversationPane.hidden = true
    byokHost.hidden = true
  } else if (mode === 'byok') {
    byokHost.hidden = false
  }
}

hostModeButton.addEventListener('click', () => setMode('host'))
byokModeButton.addEventListener('click', () => setMode('byok'))
settingsButton.addEventListener('click', () => toggleSettings(true))
window.addEventListener('byok:open-settings', () => toggleSettings(true))

setMode('host')
