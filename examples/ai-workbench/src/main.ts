/* eslint-disable no-restricted-globals */
/**
 * AI Workbench shell — a ChatGPT-style chat surface.
 *
 * Layout (see `styles/layout.css` for the measured geometry):
 *
 *   sidebar  brand · New chat · Search · Recent conversations · account
 *   main     topbar (toggle + model picker + connection + actions)
 *            thread  (centred 768px column; welcome line when empty)
 *            composer (anchored bottom, same column)
 *
 * Agent capabilities (approvals, changed files, diffs, test reports, SSE
 * status) are **not** part of this surface. They live in an Inspector drawer
 * that is mounted only when the user opens it, so the default chat is never
 * compressed by a permanent third column.
 *
 * Two chat modes share the shell:
 *
 * - `host`  — the reference Agent Host. Commands go over SSE, approvals gate
 *             writes, and the Host snapshot is the only authority.
 * - `byok`  — the user's own OpenAI-compatible gateway. Requests go from this
 *             browser to the gateway they configured; messages live only in a
 *             local IndexedDB store. The two never share a transport, a
 *             permission model or a data store.
 */

import type { ApprovalController, ReviewController } from '@zeus-web/ai-core'
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
import { createDeferredDemoHost, isDemoBuild } from './demo-host'

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
declare const __ZEUS_AI_DEMO__: boolean
declare const __ZEUS_AI_DEMO_BASE__: string

const configuredHost = __ZEUS_AI_HOST__ || undefined
const hostBaseUrl = configuredHost ?? `${location.origin}/ai-host`
// The Pages demo replays a recording instead of talking to a Host; production
// keeps the real SSE adapter. `isDemoBuild` is a build-time constant, so the
// unused branch is eliminated from both bundles.
const host = isDemoBuild
  ? createDeferredDemoHost()
  : createSseHostAdapter({ baseUrl: hostBaseUrl })
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

/* ------------------------------------------------------------- utilities */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  testId?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (testId) node.dataset.testid = testId
  return node
}

/** Inline SVG icon in the same 24px, 1.75px-stroke language as the reference. */
function icon(paths: readonly string[], size = 18): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.75')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  for (const d of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', d)
    svg.append(path)
  }
  return svg
}

const ICONS = {
  panel: [
    'M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5z',
    'M9 3v18',
  ],
  compose: [
    'M12 3H5.5A2.5 2.5 0 0 0 3 5.5v13A2.5 2.5 0 0 0 5.5 21h13a2.5 2.5 0 0 0 2.5-2.5V12',
    'M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
  ],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'm20 20-3.6-3.6'],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  ],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z'],
  sun: [
    'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M12 2v2',
    'M12 20v2',
    'm4.9 4.9 1.4 1.4',
    'm17.7 17.7 1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'm6.3 17.7-1.4 1.4',
    'm19.1 4.9-1.4 1.4',
  ],
  chevronDown: ['m6 9 6 6 6-6'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  sparkle: [
    'M12 3v4',
    'M12 17v4',
    'M3 12h4',
    'M17 12h4',
    'm5.6 5.6 2.8 2.8',
    'm15.6 15.6 2.8 2.8',
    'm18.4 5.6-2.8 2.8',
    'm8.4 15.6-2.8 2.8',
  ],
} as const

/* --------------------------------------------------------------- sidebar */

const shell = el('div', 'wb-shell')
shell.dataset.testid = 'workbench'

const sidebar = el('aside', 'wb-sidebar')
sidebar.setAttribute('aria-label', 'Chats')

const sidebarHead = el('div', 'wb-sidebar-head')
const brandButton = el('button', 'wb-brand')
brandButton.type = 'button'
// The visible label is "Chat"; the extra words live in sr-only text so the
// accessible name still contains the visible label (axe label-content-name).
const brandScreenReader = el('span', 'sr-only')
brandScreenReader.textContent = 'Chat menu'
const brandMark = el('span', 'wb-brand-mark')
brandMark.setAttribute('aria-hidden', 'true')
brandMark.textContent = 'Z'
const brandName = el('h1', 'wb-brand-name')
brandName.textContent = 'Chat'
const brandCaret = icon(ICONS.chevronDown, 14)
brandCaret.classList.add('wb-brand-caret')
brandButton.append(brandMark, brandName, brandCaret, brandScreenReader)

const collapseButton = el('button', 'icon-button')
collapseButton.type = 'button'
collapseButton.dataset.testid = 'sidebar-collapse'
collapseButton.setAttribute('aria-label', 'Close sidebar')
collapseButton.append(icon(ICONS.panel, 20))
sidebarHead.append(brandButton, collapseButton)

const sidebarScroll = el('div', 'wb-sidebar-scroll')

const newChatButton = el('button', 'wb-nav-item')
newChatButton.type = 'button'
newChatButton.dataset.testid = 'new-conversation'
newChatButton.append(icon(ICONS.compose), document.createTextNode('New chat'))

const searchChatsButton = el('button', 'wb-nav-item')
searchChatsButton.type = 'button'
searchChatsButton.dataset.testid = 'search-chats'
searchChatsButton.append(
  icon(ICONS.search),
  document.createTextNode('Search chats'),
)

const recentLabel = el('p', 'wb-sidebar-section')
recentLabel.textContent = 'Recent'

const conversationListRoot = el('ul', 'wb-conversation-list')
conversationListRoot.dataset.testid = 'conversation-list'

const conversationEmpty = el('p', 'wb-sidebar-empty')
conversationEmpty.textContent = 'No chats yet.'

sidebarScroll.append(
  newChatButton,
  searchChatsButton,
  recentLabel,
  conversationListRoot,
  conversationEmpty,
)

const sidebarFoot = el('div', 'wb-sidebar-foot')
const settingsButton = el('button', 'wb-nav-item')
settingsButton.type = 'button'
settingsButton.dataset.testid = 'open-settings'
settingsButton.append(icon(ICONS.settings), document.createTextNode('Settings'))

const accountButton = el('button', 'wb-account')
accountButton.type = 'button'
accountButton.dataset.testid = 'account-menu'
const accountAvatar = el('span', 'wb-avatar')
accountAvatar.setAttribute('aria-hidden', 'true')
accountAvatar.textContent = 'Z'
const accountCopy = el('span', 'wb-account-copy')
const accountName = el('span', 'wb-account-name')
accountName.textContent = 'Zeus workspace'
const accountPlan = el('span', 'wb-account-plan')
accountPlan.textContent = 'Local chat'
accountCopy.append(accountName, accountPlan)
accountButton.append(accountAvatar, accountCopy)

sidebarFoot.append(settingsButton, accountButton)
sidebar.append(sidebarHead, sidebarScroll, sidebarFoot)

const sidebarScrim = el('div', 'wb-sidebar-scrim')
sidebarScrim.hidden = true
sidebarScrim.addEventListener('click', () => setSidebarOpen(false))

/* ------------------------------------------------------------------ main */

const main = el('main', 'wb-main')

const topbar = el('header', 'wb-topbar')
const openSidebarButton = el('button', 'wb-sidebar-toggle')
openSidebarButton.type = 'button'
openSidebarButton.dataset.testid = 'sidebar-toggle'
openSidebarButton.setAttribute('aria-label', 'Open sidebar')
openSidebarButton.append(icon(ICONS.panel, 20))

const modelPicker = el('button', 'wb-model-picker')
modelPicker.type = 'button'
modelPicker.dataset.testid = 'model-picker'
modelPicker.setAttribute('aria-haspopup', 'menu')
modelPicker.setAttribute('aria-expanded', 'false')
const modelName = el('span')
modelName.dataset.testid = 'model-name'
modelName.textContent = 'Zeus'
const modelKind = el('span', 'wb-model-kind')
const modelCaret = icon(ICONS.chevronDown, 16)
modelPicker.append(modelName, modelKind, modelCaret)

const topbarActions = el('div', 'wb-topbar-actions')

const connection = el('button', 'icon-button')
connection.type = 'button'
connection.dataset.testid = 'connection'
connection.dataset.connection = 'idle'
connection.setAttribute('aria-label', 'Host connection: idle')
const connectionDot = el('span', 'wb-dot wb-dot-lg')
connectionDot.dataset.connection = 'idle'
const connectionText = el('span', 'sr-only')
connectionText.textContent = 'idle'
connection.append(connectionDot, connectionText)
connection.title = 'Host connection'

const inspectorToggle = el('button', 'icon-button wb-activity-toggle')
inspectorToggle.type = 'button'
inspectorToggle.dataset.testid = 'inspector-toggle'
inspectorToggle.setAttribute('aria-expanded', 'false')
inspectorToggle.append(icon(ICONS.activity))
// Visible label "Activity"; sr-only adds the intent. The badge is decorative
// count data, so it is hidden from the accessible name.
const activityScreenReader = el('span', 'sr-only')
activityScreenReader.textContent = 'panel'
inspectorToggle.append(activityScreenReader)
const inspectorBadge = el('span', 'wb-badge')
inspectorBadge.hidden = true
inspectorBadge.setAttribute('aria-hidden', 'true')
inspectorToggle.append(inspectorBadge)

const themeToggle = el('button', 'icon-button')
themeToggle.type = 'button'
themeToggle.dataset.testid = 'theme-toggle'
themeToggle.setAttribute('aria-label', 'Toggle colour scheme')
themeToggle.append(icon(ICONS.sun, 20))

topbarActions.append(connection, inspectorToggle, themeToggle)
topbar.append(openSidebarButton, modelPicker, topbarActions)

const replayBanner = el('p', 'wb-error-line')
replayBanner.dataset.testid = 'public-replay'
replayBanner.textContent =
  'Public replay · read-only. Sending messages, proposing and approving are disabled.'
replayBanner.hidden = true

const surface = el('div', 'wb-surface')

const welcome = el('div', 'wb-welcome')
welcome.dataset.testid = 'welcome'
const welcomeTitle = el('h1', 'wb-welcome-title')
welcomeTitle.textContent = 'Where should we begin?'
// A suggestion that fills the composer with a real prompt; it never pretends
// to send, and it is a real action rather than a decorative chip.
welcome.append(welcomeTitle)

let timeline = createTimeline()

const thread = el('div', 'wb-thread')
thread.dataset.testid = 'thread'
thread.hidden = true
const threadInner = el('div', 'wb-thread-inner')
threadInner.append(timeline)
thread.append(threadInner)

const welcomeSuggestion = el('button', 'wb-suggestion')
welcomeSuggestion.type = 'button'
welcomeSuggestion.dataset.testid = 'welcome-suggestion'
welcomeSuggestion.textContent = 'What can you do?'
welcomeSuggestion.addEventListener('click', () => {
  fillActiveComposer('What can you do in this workspace?')
})
const composerZone = el('div', 'wb-composer-zone is-centred')
let composerElement = createComposerElement()
composerZone.append(composerElement, welcomeSuggestion)

surface.append(welcome, thread, composerZone)
main.append(topbar, replayBanner, surface)
shell.append(sidebar, sidebarScrim, main)
root.append(shell)

/* --------------------------------------------------------------- drawer */

const drawerScrim = el('div', 'wb-drawer-scrim')
drawerScrim.hidden = true
drawerScrim.addEventListener('click', () => closeInspector())

const drawer = el('aside', 'wb-drawer')
drawer.dataset.testid = 'inspector'
drawer.hidden = true
// A complementary landmark, not a dialog: at wide viewports this docks beside
// the chat as a real split, and `role=dialog` on an <aside> is disallowed ARIA.
drawer.setAttribute('role', 'complementary')
drawer.setAttribute('aria-label', 'Agent activity')
// `hidden` on a fixed element is not enough in some engines; `display: none`
// is applied by the stylesheet for [hidden], and this keeps it inert.
drawer.inert = true

const drawerHead = el('div', 'wb-drawer-head')
const drawerTitle = el('h2', 'wb-drawer-title')
drawerTitle.textContent = 'Agent activity'
const drawerClose = el('button', 'icon-button')
drawerClose.type = 'button'
drawerClose.dataset.testid = 'inspector-close'
drawerClose.setAttribute('aria-label', 'Close activity panel')
drawerClose.append(icon(ICONS.close, 18))
drawerClose.style.marginLeft = 'auto'
drawerHead.append(drawerTitle, drawerClose)

const drawerTabs = el('div', 'wb-drawer-tabs')
drawerTabs.setAttribute('role', 'tablist')
const drawerBody = el('div', 'wb-drawer-body')

const propose = el('button', 'wb-pill-button')
propose.type = 'button'
propose.dataset.testid = 'propose-change'
propose.textContent = 'Request protected write'
propose.style.border = '1px solid var(--wb-border-default)'

const approval = el('div')
approval.dataset.testid = 'approvals'
approval.textContent = 'No pending approvals'

const reviewHeading = el('h2', 'wb-drawer-section-title')
reviewHeading.textContent = 'Changed files'
const changeTree = document.createElement(
  'zw-ai-file-change-tree',
) as AiElementInstance & { review: ReviewController | undefined }
changeTree.dataset.testid = 'change-tree'
const diffViewer = document.createElement(
  'zw-ai-diff-viewer',
) as AiElementInstance & { review: ReviewController | undefined }
diffViewer.dataset.testid = 'diff-viewer'
diffViewer.setAttribute('layout', 'unified')
const runChecks = el('button', 'wb-pill-button')
runChecks.type = 'button'
runChecks.dataset.testid = 'run-checks'
runChecks.textContent = 'Run checks'
runChecks.style.border = '1px solid var(--wb-border-default)'
const testReport = document.createElement(
  'zw-ai-test-report',
) as AiElementInstance & { controller: unknown }
testReport.dataset.testid = 'test-report'
runChecks.addEventListener('click', () => void loadTestReport())

const reviewPane = el('div')
reviewPane.style.display = 'flex'
reviewPane.style.flexDirection = 'column'
reviewPane.style.gap = '12px'
reviewPane.append(reviewHeading, changeTree, diffViewer)

const testsPane = el('div')
testsPane.style.display = 'none'
testsPane.style.flexDirection = 'column'
testsPane.style.gap = '12px'
testsPane.append(runChecks, testReport)

type SideTabId = 'activity' | 'changes' | 'tests'
const sidePanes: Array<{ id: SideTabId; label: string; pane: HTMLElement }> = [
  { id: 'activity', label: 'Approvals', pane: approval },
  { id: 'changes', label: 'Changes', pane: reviewPane },
  { id: 'tests', label: 'Tests', pane: testsPane },
]
const sideTabButtons = new Map<SideTabId, HTMLButtonElement>()
for (const entry of sidePanes) {
  const tab = el('button', 'wb-drawer-tab')
  tab.type = 'button'
  tab.setAttribute('role', 'tab')
  tab.dataset.testid = `side-tab-${entry.id}`
  tab.textContent = entry.label
  tab.addEventListener('click', () => selectSideTab(entry.id))
  sideTabButtons.set(entry.id, tab)
  drawerTabs.append(tab)
  if (entry.id !== 'activity') entry.pane.hidden = true
  drawerBody.append(entry.pane)
}

function selectSideTab(id: SideTabId): void {
  for (const entry of sidePanes) {
    const selected = entry.id === id
    const tab = sideTabButtons.get(entry.id)
    if (tab) tab.setAttribute('aria-selected', String(selected))
    entry.pane.hidden = !selected
    entry.pane.style.display = selected ? 'flex' : 'none'
  }
}
selectSideTab('activity')

drawerBody.append(propose)
drawer.append(drawerHead, drawerTabs, drawerBody)
// The drawer lives inside the shell so it can dock as a flex column beside the
// chat on wide viewports (see layout.css); narrow viewports keep it fixed.
shell.append(drawerScrim, drawer)

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

/* ----------------------------------------------------------- conversation */

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
  const wrapper = el('div', 'wb-composer-stack')
  const element = document.createElement(
    'zw-ai-composer',
  ) as AiElementInstance & { controller: unknown }
  element.controller = composer
  element.setAttribute('label', 'Ask the agent')
  if (readOnly) element.setAttribute('disabled', '')
  element.dataset.testid = 'composer'
  element.classList.add('composer')
  const fileLabel = el('label', 'attach')
  fileLabel.setAttribute('aria-label', 'Attach file')
  fileLabel.title = 'Attach file'
  fileLabel.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'text/plain,application/json,image/png,image/jpeg'
  fileInput.dataset.testid = 'attach-file'
  fileInput.disabled = readOnly
  fileLabel.append(fileInput)
  const attachStatus = el('span', 'attach-status')
  attachStatus.dataset.testid = 'attach-status'
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (!file) return
    void uploadAttachment(file, attachStatus)
  })
  // The published composer has no placeholder attribute; set it on the
  // textarea it renders and re-apply if the element re-renders its view.
  const syncPlaceholder = (): void => {
    const textarea = element.querySelector('textarea')
    if (textarea && textarea.placeholder !== 'Ask anything') {
      textarea.placeholder = 'Ask anything'
    }
  }
  new MutationObserver(syncPlaceholder).observe(element, {
    childList: true,
    subtree: true,
  })
  syncPlaceholder()

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

/* --------------------------------------------------------- conversations */

interface LocalSession {
  readonly id: string
  readonly title: string
}

const knownConversations = new Map<string, LocalSession>()
knownConversations.set(conversationId, {
  id: conversationId,
  title: 'Reference conversation',
})

function renderConversationList(): void {
  conversationListRoot.replaceChildren()
  const entries = [...knownConversations.values()]
  conversationEmpty.hidden = entries.length > 0
  for (const entry of entries) {
    const row = el('li', 'wb-conversation-row')
    row.dataset.conversationId = entry.id
    if (entry.id === conversationId) row.classList.add('is-active')
    const button = el('button', 'wb-conversation-button')
    button.type = 'button'
    button.dataset.conversationId = entry.id
    const title = el('span', 'wb-conversation-title')
    title.textContent = entry.title
    button.append(title)
    button.addEventListener('click', () => activateConversation(entry.id))
    const menu = el('button', 'wb-conversation-menu')
    menu.type = 'button'
    menu.setAttribute('aria-label', `Chat options for ${entry.title}`)
    menu.setAttribute('aria-haspopup', 'menu')
    menu.setAttribute('aria-expanded', 'false')
    menu.append(icon(ICONS.more, 16))
    menu.addEventListener('click', event => {
      event.stopPropagation()
      openConversationMenu(entry, menu)
    })
    row.addEventListener(
      'click',
      event => {
        // A click that lands in the inline rename field must not navigate.
        if ((event.target as HTMLElement).closest('.wb-conversation-input')) {
          event.stopPropagation()
        }
      },
      true,
    )
    row.append(button, menu)
    conversationListRoot.append(row)
  }
}

let openMenuElement: HTMLElement | undefined
function closeConversationMenu(): void {
  openMenuElement?.remove()
  openMenuElement = undefined
  document
    .querySelectorAll('.wb-conversation-menu[aria-expanded="true"]')
    .forEach(node => node.setAttribute('aria-expanded', 'false'))
  document.removeEventListener('click', closeConversationMenu, true)
}

function openConversationMenu(entry: LocalSession, anchor: HTMLElement): void {
  closeConversationMenu()
  anchor.setAttribute('aria-expanded', 'true')
  const menu = el('div', 'wb-popover')
  menu.setAttribute('role', 'menu')
  menu.dataset.testid = 'conversation-menu'
  const rename = el('button', 'wb-menu-item')
  rename.type = 'button'
  rename.setAttribute('role', 'menuitem')
  rename.textContent = 'Rename'
  rename.addEventListener('click', () => {
    closeConversationMenu()
    renameConversation(entry)
  })
  const remove = el('button', 'wb-menu-item wb-menu-item-danger')
  remove.type = 'button'
  remove.setAttribute('role', 'menuitem')
  remove.textContent = 'Delete'
  remove.addEventListener('click', () => {
    closeConversationMenu()
    confirmDeleteConversation(entry)
  })
  menu.append(rename, remove)
  const rect = anchor.getBoundingClientRect()
  menu.style.position = 'fixed'
  menu.style.top = `${rect.bottom + 4}px`
  menu.style.left = `${Math.max(8, rect.right - 160)}px`
  document.body.append(menu)
  openMenuElement = menu
  setTimeout(() => {
    document.addEventListener('click', closeConversationMenu, true)
  }, 0)
}

/**
 * Inline rename. The reference renames in place rather than through a browser
 * prompt, and an inline field keeps focus in the sidebar and is cancellable
 * with Escape.
 */
function renameConversation(entry: LocalSession): void {
  const row = [
    ...conversationListRoot.querySelectorAll<HTMLElement>(
      '.wb-conversation-row',
    ),
  ].find(item => item.dataset.conversationId === entry.id)
  const title = row?.querySelector<HTMLElement>('.wb-conversation-title')
  if (!row || !title) return
  const input = el('input', 'wb-conversation-input')
  input.value = entry.title
  input.setAttribute('aria-label', 'Chat title')
  title.replaceWith(input)
  input.focus()
  input.select()
  let settled = false
  const finish = (value: string | null): void => {
    if (settled) return
    settled = true
    const next = value?.trim()
    if (next) knownConversations.set(entry.id, { ...entry, title: next })
    renderConversationList()
    if (entry.id === conversationId) updateConversationTitle()
  }
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault()
      finish(input.value)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      finish(null)
    }
  })
  input.addEventListener('blur', () => finish(input.value))
}

/**
 * In-app delete confirmation. A `window.confirm` would block the page and
 * cannot be styled; the reference uses an in-surface dialog for destructive
 * actions.
 */
function confirmDeleteConversation(entry: LocalSession): void {
  const scrim = el('div', 'wb-dialog-scrim')
  const dialog = el('div', 'wb-dialog')
  dialog.setAttribute('role', 'alertdialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-labelledby', 'wb-delete-title')
  const heading = el('h2', 'wb-dialog-title')
  heading.id = 'wb-delete-title'
  heading.textContent = 'Delete chat?'
  const copy = el('p', 'wb-dialog-copy')
  copy.textContent = `“${entry.title}” will be removed from this list. This cannot be undone.`
  const actions = el('div', 'wb-dialog-actions')
  const cancel = el('button', 'wb-dialog-button')
  cancel.type = 'button'
  cancel.textContent = 'Cancel'
  const confirm = el('button', 'wb-dialog-button is-destructive')
  confirm.type = 'button'
  confirm.dataset.testid = 'delete-confirm'
  confirm.textContent = 'Delete'
  actions.append(cancel, confirm)
  dialog.append(heading, copy, actions)
  scrim.append(dialog)
  document.body.append(scrim)
  cancel.focus()
  let close = (): void => {}
  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') close()
  }
  close = (): void => {
    scrim.remove()
    document.removeEventListener('keydown', onKey)
  }
  document.addEventListener('keydown', onKey)
  cancel.addEventListener('click', close)
  scrim.addEventListener('click', event => {
    if (event.target === scrim) close()
  })
  confirm.addEventListener('click', () => {
    close()
    deleteAttempt(entry.id)
  })
}

/**
 * Deleting a Host conversation is a Host concern; the snapshot is the only
 * authority. For a local id that has never been sent, dropping it from the
 * sidebar is enough. We never claim a server-side delete here.
 */
function deleteAttempt(id: string): void {
  knownConversations.delete(id)
  if (id === conversationId) {
    const next = [...knownConversations.keys()][0]
    if (next) {
      activateConversation(next)
    } else {
      conversationId = 'workbench'
      knownConversations.set(conversationId, {
        id: conversationId,
        title: 'New chat',
      })
      activateConversation(conversationId)
    }
  }
  renderConversationList()
}

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
  threadInner.append(timeline)
  composerElement.replaceWith((composerElement = createComposerElement()))
  composerZone.replaceChildren(composerElement)
  renderConversationList()
  updateConversationTitle()
  updateWelcome()
}

let conversationCounter = 1
newChatButton.addEventListener('click', () => {
  conversationCounter += 1
  const id = `workbench-${conversationCounter}`
  knownConversations.set(id, {
    id,
    title: `Session ${conversationCounter}`,
  })
  // Publish the local session in the controller's view. The Host upserts the
  // same id on the first message, so reload cannot invent a second aggregate.
  activateConversation(id)
  renderConversationList()
})

/* ------------------------------------------------------- host connection */
session.subscribe(
  view => view.connection,
  state => {
    // The demo's transport is a recording replayed from memory, so it reaches
    // the recorded state rather than a live one. Reporting "connecting" there
    // would describe a state the session is not in.
    const shown = isDemoBuild ? 'replay' : state
    connection.dataset.connection = isDemoBuild ? 'live' : state
    connectionDot.dataset.connection = isDemoBuild ? 'live' : state
    connectionText.textContent = shown
    connection.setAttribute(
      'aria-label',
      isDemoBuild
        ? 'Host connection: replaying a recording'
        : `Host connection: ${state}`,
    )
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
  newChatButton.disabled = readOnly
}

if (isDemoBuild) {
  // The demo has no Host to probe. It is read-only by construction: the replay
  // host rejects every command, so the composer must not pretend otherwise.
  readOnly = true
  applyReadOnly()
  // Say it is a demo, not just that it is read-only: the visitor must not
  // mistake a recorded replay for a live model.
  replayBanner.textContent =
    '只读演示 · 回放真实 Host 录制的事件流，不能发送消息、提案或审批。'
  replayBanner.hidden = false
} else {
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
}

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
  if (drawer.hidden) openInspector()
  else closeInspector()
})
drawerClose.addEventListener('click', closeInspector)

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

/** Opens the activity drawer. It is an overlay; the chat column keeps its width. */
function openInspector(tab?: SideTabId): void {
  drawer.hidden = false
  drawer.inert = false
  drawerScrim.hidden = false
  shell.classList.add('is-inspector-open')
  inspectorToggle.setAttribute('aria-expanded', 'true')
  if (tab) selectSideTab(tab)
  drawerClose.focus()
}

function closeInspector(): void {
  drawer.hidden = true
  drawer.inert = true
  drawerScrim.hidden = true
  shell.classList.remove('is-inspector-open')
  inspectorToggle.setAttribute('aria-expanded', 'false')
  inspectorToggle.focus()
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
}

/** The welcome block yields to the conversation once a message exists. */
function updateWelcome(): void {
  const state = session.store.getState()
  const ids = state.conversationMessageIds[conversationId] ?? []
  const empty = ids.length === 0
  welcome.hidden = !empty
  thread.hidden = empty
  composerZone.classList.toggle('is-centred', empty)
  // The reference centres the composer under the welcome line in an empty
  // chat, then anchors it to the bottom once the conversation starts. Moving
  // the same element keeps the draft text and focus across that transition.
  // The chip is created inside the composer zone once, so it follows the zone
  // between the centred welcome and the bottom anchor without re-parenting.
  welcomeSuggestion.hidden = !empty
  if (empty) {
    if (composerZone.parentElement !== welcome) welcome.append(composerZone)
  } else if (composerZone.parentElement !== surface) {
    surface.append(composerZone)
  }
}

function updateConversationTitle(): void {
  const title = knownConversations.get(conversationId)?.title ?? 'New chat'
  modelPicker.title = title
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

/* ---------------------------------------------------------- sidebar open */

function setSidebarOpen(open: boolean): void {
  const mobile = window.matchMedia('(max-width: 767px)').matches
  if (mobile) {
    shell.classList.toggle('is-sidebar-open-mobile', open)
    sidebarScrim.hidden = !open
    collapseButton.setAttribute('aria-label', 'Close sidebar')
    openSidebarButton.setAttribute('aria-label', 'Close sidebar')
    return
  }
  shell.classList.toggle('is-sidebar-collapsed', !open)
  try {
    localStorage.setItem('zeus-wb-sidebar', open ? 'open' : 'closed')
  } catch {
    // Private mode; the toggle still works for the session.
  }
  collapseButton.setAttribute('aria-label', 'Close sidebar')
  openSidebarButton.setAttribute('aria-label', 'Open sidebar')
}

openSidebarButton.addEventListener('click', () => {
  const mobile = window.matchMedia('(max-width: 767px)').matches
  if (mobile)
    setSidebarOpen(!shell.classList.contains('is-sidebar-open-mobile'))
  else setSidebarOpen(shell.classList.contains('is-sidebar-collapsed'))
})
collapseButton.addEventListener('click', () => setSidebarOpen(false))

try {
  if (localStorage.getItem('zeus-wb-sidebar') === 'closed')
    setSidebarOpen(false)
} catch {
  // Ignore storage failures.
}

/* ------------------------------------------------------- host / byok modes */
/*
 * `host` is the agent: commands go to the Host over SSE, approvals gate writes,
 * and the Host's snapshot is the only authority for what happened.
 *
 * `byok` is the user's own model: requests go from this browser to the gateway
 * they configured, and messages live only in a local store. The mode pill in
 * the topbar is the single explicit switch.
 */
type Mode = 'host' | 'byok'
let mode: Mode = 'host'

let settingsOpen = false
let disposeByok: (() => void) | undefined
let disposeSettings: (() => void) | undefined

/* The Host composer is detached and re-attached when switching modes so the
   BYOK view can own the same composer slot without duplicating the element. */
const hostComposerStack = composerElement

const modeSwitch = el('div', 'wb-mode-switch')
modeSwitch.setAttribute('role', 'group')
modeSwitch.setAttribute('aria-label', 'Run mode')
const hostModeButton = el('button', 'wb-segment')
hostModeButton.type = 'button'
hostModeButton.dataset.testid = 'mode-host'
hostModeButton.textContent = 'Agent'
const byokModeButton = el('button', 'wb-segment')
byokModeButton.type = 'button'
byokModeButton.dataset.testid = 'mode-byok'
byokModeButton.textContent = 'My model'
modeSwitch.append(hostModeButton, byokModeButton)
topbarActions.prepend(modeSwitch)

/* The BYOK thread is the same scroll column as the Host thread: both render
   inside `.wb-thread` so the reading width and scroll behaviour are shared. */
const byokThread = el('div', 'wb-thread')
byokThread.dataset.testid = 'byok-thread-host'
byokThread.hidden = true
surface.insertBefore(byokThread, composerZone)

/*
 * Settings is a page inside the chat shell, as in the reference: the sidebar
 * stays, the chat surface is replaced, and a back control returns to it. A
 * modal was rejected because it covered the mode switch and the chat, which is
 * exactly the "settings console" shape this rebuild removes.
 */
const settingsPage = el('div', 'wb-settings-page')
settingsPage.hidden = true
settingsPage.dataset.testid = 'settings-page'
const settingsHead = el('div', 'wb-settings-page-head')
const settingsBack = el('button', 'icon-button')
settingsBack.type = 'button'
settingsBack.dataset.testid = 'settings-back'
settingsBack.setAttribute('aria-label', 'Back to chat')
settingsBack.append(icon(['m19 12H5', 'M12 19l-7-7 7-7'], 20))
const settingsTitle = el('h2', 'wb-settings-page-title')
settingsTitle.textContent = 'Settings'
settingsHead.append(settingsBack, settingsTitle)
const settingsBody = el('div', 'wb-settings-page-body')
settingsPage.append(settingsHead, settingsBody)
// Mounted inside the chat surface, not over the whole main column: the topbar
// (mode switch, activity, theme) stays reachable, as it does in the reference.
surface.append(settingsPage)
settingsBack.addEventListener('click', () => toggleSettings(false))

const byokHost = el('div', 'byok-host')
byokHost.hidden = true
byokThread.append(byokHost)

function setMode(next: Mode): void {
  if (settingsOpen) toggleSettings(false)
  mode = next
  hostModeButton.classList.toggle('is-active', next === 'host')
  byokModeButton.classList.toggle('is-active', next === 'byok')
  hostModeButton.setAttribute('aria-pressed', String(next === 'host'))
  byokModeButton.setAttribute('aria-pressed', String(next === 'byok'))

  if (next === 'byok') {
    closeInspector()
    // The empty Host state owns the composer zone (it centres it under the
    // welcome line). BYOK always renders in the chat column, so re-home the
    // zone before hiding the welcome block.
    if (composerZone.parentElement !== surface) surface.append(composerZone)
    hideHostSurface()
    byokThread.hidden = byokHost.hidden = false
    if (!disposeByok) {
      disposeByok = mountByokChat({
        mode: 'byok',
        onModeChange: () => undefined,
        host: byokHost,
        composerHost: composerZone,
        onTitle: title => {
          modelPicker.title = title
        },
      })
    }
    byokHost.hidden = false
    return
  }

  disposeByok?.()
  disposeByok = undefined
  byokHost.replaceChildren()
  byokThread.hidden = true
  showHostSurface()
}

function hideHostSurface(): void {
  welcome.hidden = true
  thread.hidden = true
}

function showHostSurface(): void {
  // Re-attach the Host composer (and the suggestion chip, which lives in the
  // same zone), then let `updateWelcome` decide where the zone lives: centred in
  // the welcome block, or pinned under the thread.
  composerZone.replaceChildren(hostComposerStack, welcomeSuggestion)
  updateWelcome()
}

function toggleSettings(open: boolean): void {
  settingsOpen = open
  settingsButton.classList.toggle('is-active', open)
  settingsPage.hidden = !open
  surface.hidden = open
  if (open) {
    closeInspector()
    if (!disposeSettings) {
      disposeSettings = mountProviderPanel({ root: settingsBody })
    }
  }
}

/** Fills the visible composer with a prompt, whatever mode owns it. */
function fillActiveComposer(text: string): void {
  const target = composerZone.querySelector('textarea')
  if (!target) return
  target.value = text
  target.dispatchEvent(new Event('input', { bubbles: true }))
  target.focus()
}

hostModeButton.addEventListener('click', () => setMode('host'))
byokModeButton.addEventListener('click', () => setMode('byok'))
settingsButton.addEventListener('click', () => toggleSettings(true))
window.addEventListener('byok:open-settings', () => toggleSettings(true))

/* --------------------------------------------------------------- theme */

function applyTheme(next: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = next
  themeToggle.replaceChildren(
    icon(next === 'dark' ? ICONS.moon : ICONS.sun, 20),
  )
  try {
    localStorage.setItem('zeus-wb-theme', next)
  } catch {
    // Ignore storage failures.
  }
}

function readTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem('zeus-wb-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Fall through to the system preference.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

themeToggle.addEventListener('click', () => {
  applyTheme(
    document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark',
  )
})

applyTheme(readTheme())
renderConversationList()
setMode('host')
// The welcome block yields the moment the active conversation has a message.
// The store is the Host's authority, so this also covers reconnect/replay.
session.store.subscribe(
  state => `${state.conversationMessageIds[conversationId]?.length ?? 0}`,
  () => {
    if (mode === 'host') updateWelcome()
  },
)
updateWelcome()
updateInspectorBadge()
updateConversationTitle()
updateGlobalWorkbench()
