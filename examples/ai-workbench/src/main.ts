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

import type {
  ApprovalController,
  ReviewController,
  SessionConnection,
} from '@zeus-web/ai-core'
import type { AiElementInstance } from '@zeus-web/ai-wc'
import type { ByokChatView } from './byok/chat-view'
import type { ComposerDock } from './composer-dock'
import type { WorkbenchLanguage } from './locale'

import type { WorkbenchMessageKey } from './locales/en'
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
import { conversationStore } from './byok/conversations'
import { providerStore } from './byok/profiles'
import { mountProviderPanel } from './byok/provider-panel'
import { createComposerDock } from './composer-dock'
import { createCopy, refreshOnLanguageChange } from './copy'
import { createDeferredDemoHost, isDemoBuild } from './demo-host'
import { highlightCodeBlocks } from './highlight'
import {
  applyInitialLanguage,
  getAiLocale,
  getLanguage,
  setLanguage,
  subscribeLanguage,
  t,
  WORKBENCH_LANGUAGES,
} from './locale'

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

/* The two modes share the shell and nothing else; `mode` is declared here
   because the sidebar, the composer dock and the topbar picker all read it. */
type Mode = 'host' | 'byok'
let mode: Mode = 'host'
let byokView: ByokChatView | undefined

let conversationId = 'workbench'
let conversation = createConversationController({ session, conversationId })
let composer = createComposerController({
  session,
  conversationId,
  parentMessageId: () => conversation.getSnapshot().leafMessageId,
})

/* ------------------------------------------------------------- utilities */

/**
 * Chrome copy for the shell. A language switch re-runs these bindings in
 * place; nothing is created, removed or re-parented, so focus, caret, draft
 * text, streamed output and scroll position survive.
 */
const copy = createCopy()

const CONNECTION_KEYS = {
  idle: 'workbench.connection.idle',
  connecting: 'workbench.connection.connecting',
  live: 'workbench.connection.live',
  recovering: 'workbench.connection.recovering',
  offline: 'workbench.connection.offline',
} as const satisfies Record<SessionConnection, WorkbenchMessageKey>

function connectionStatusKey(state: SessionConnection): WorkbenchMessageKey {
  return CONNECTION_KEYS[state]
}

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
copy.attr(sidebar, 'aria-label', 'workbench.sidebarLabel')

const sidebarHead = el('div', 'wb-sidebar-head')
const brandButton = el('button', 'wb-brand')
brandButton.type = 'button'
// The visible label is "Chat"; the extra words live in sr-only text so the
// accessible name still contains the visible label (axe label-content-name).
const brandScreenReader = el('span', 'sr-only')
brandScreenReader.append(copy.text('workbench.brandMenu'))
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
collapseButton.append(icon(ICONS.panel, 20))
sidebarHead.append(brandButton, collapseButton)

const sidebarScroll = el('div', 'wb-sidebar-scroll')

const newChatButton = el('button', 'wb-nav-item')
newChatButton.type = 'button'
newChatButton.dataset.testid = 'new-conversation'
newChatButton.append(icon(ICONS.compose), copy.text('workbench.newChat'))

const searchChatsButton = el('button', 'wb-nav-item')
searchChatsButton.type = 'button'
searchChatsButton.dataset.testid = 'search-chats'
searchChatsButton.setAttribute('aria-expanded', 'false')
searchChatsButton.append(icon(ICONS.search), copy.text('workbench.searchChats'))

/*
 * Search filters the conversations the reader can actually open in the mode
 * they are in: the Host's stream in Agent mode, the local BYOK rows in My
 * model. It never merges the two, because they are different stores with
 * different permissions — offering a Host row while the reader is in BYOK would
 * promise a conversation this surface cannot open, and the reverse would expose
 * local chat titles to a mode that has no business listing them.
 *
 * The field is inline in the sidebar rather than a modal: the list it filters is
 * right below it, so the result is visible while typing.
 */
const searchRow = el('div', 'wb-sidebar-search')
searchRow.hidden = true
const searchInput = el('input', 'wb-search-input')
searchInput.type = 'search'
searchInput.dataset.testid = 'search-input'
copy.attr(searchInput, 'aria-label', 'workbench.searchChats')
copy.attr(searchInput, 'placeholder', 'workbench.searchPlaceholder')
const searchClear = el('button', 'wb-search-clear')
searchClear.type = 'button'
searchClear.dataset.testid = 'search-clear'
copy.attr(searchClear, 'aria-label', 'workbench.searchClear')
searchClear.append(icon(ICONS.close, 14))
searchRow.append(searchInput, searchClear)

/*
 * The empty state has to describe the search that produced it. "No chats yet."
 * under a query that matched nothing would be a lie: the chats exist, the query
 * does not match them. `searchEmpty` is shown instead, and it says what was
 * searched.
 */
const searchEmpty = el('p', 'wb-sidebar-empty wb-search-empty')
searchEmpty.dataset.testid = 'search-empty'
searchEmpty.hidden = true

let searchQuery = ''
// The notice is rewritten where it is shown, with the query in hand. Binding it
// through `copy.custom` would tie it to the language-refresh pass, which does
// not run when the query changes — the notice would keep the previous text.
function renderSearchEmpty(): void {
  searchEmpty.textContent = t('workbench.searchEmpty', { query: searchQuery })
}

function setSearchOpen(open: boolean): void {
  searchRow.hidden = !open
  searchChatsButton.setAttribute('aria-expanded', String(open))
  if (open) {
    searchInput.focus()
    return
  }
  // Closing clears, so the list the reader returns to is the full list and not
  // a silently filtered one.
  if (searchQuery) {
    searchQuery = ''
    searchInput.value = ''
    renderConversationList()
  }
}

searchChatsButton.addEventListener('click', () => {
  setSearchOpen(Boolean(searchRow.hidden))
})
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim()
  renderConversationList()
})
searchInput.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault()
    setSearchOpen(false)
  }
})
searchClear.addEventListener('click', () => {
  searchQuery = ''
  searchInput.value = ''
  renderConversationList()
  searchInput.focus()
})

const recentLabel = el('p', 'wb-sidebar-section')
recentLabel.append(copy.text('workbench.recent'))

const conversationListRoot = el('ul', 'wb-conversation-list')
conversationListRoot.dataset.testid = 'conversation-list'

const conversationEmpty = el('p', 'wb-sidebar-empty')
conversationEmpty.append(copy.text('workbench.noChats'))

sidebarScroll.append(
  newChatButton,
  searchChatsButton,
  searchRow,
  recentLabel,
  conversationListRoot,
  conversationEmpty,
  searchEmpty,
)

const sidebarFoot = el('div', 'wb-sidebar-foot')
const settingsButton = el('button', 'wb-nav-item')
settingsButton.type = 'button'
settingsButton.dataset.testid = 'open-settings'
settingsButton.append(icon(ICONS.settings), copy.text('workbench.settings'))

const accountButton = el('button', 'wb-account')
accountButton.type = 'button'
accountButton.dataset.testid = 'account-menu'
const accountAvatar = el('span', 'wb-avatar')
accountAvatar.setAttribute('aria-hidden', 'true')
accountAvatar.textContent = 'Z'
const accountCopy = el('span', 'wb-account-copy')
const accountName = el('span', 'wb-account-name')
accountName.append(copy.text('workbench.workspaceName'))
const accountPlan = el('span', 'wb-account-plan')
accountPlan.append(copy.text('workbench.localChat'))
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
// The visible text *is* the accessible name's prefix (axe
// label-content-name-mismatch): the intent lives in sr-only text appended
// after it, never in an aria-label that would replace it.
const modelIntent = el('span', 'sr-only')
modelIntent.append(copy.text('workbench.pickerOpen'))
modelPicker.append(modelName, modelKind, modelCaret, modelIntent)

const topbarActions = el('div', 'wb-topbar-actions')

const connection = el('button', 'icon-button')
connection.type = 'button'
connection.dataset.testid = 'connection'
connection.dataset.connection = 'idle'
const connectionDot = el('span', 'wb-dot wb-dot-lg')
connectionDot.dataset.connection = 'idle'
const connectionText = el('span', 'sr-only')
connectionText.textContent = 'idle'
connection.append(connectionDot, connectionText)
copy.attr(connection, 'title', 'workbench.hostConnectionTitle')

const inspectorToggle = el('button', 'icon-button wb-activity-toggle')
inspectorToggle.type = 'button'
inspectorToggle.dataset.testid = 'inspector-toggle'
inspectorToggle.setAttribute('aria-expanded', 'false')
inspectorToggle.append(icon(ICONS.activity))
// Visible label "Activity"; sr-only adds the intent. The badge is decorative
// count data, so it is hidden from the accessible name.
const activityScreenReader = el('span', 'sr-only')
activityScreenReader.append(copy.text('workbench.activityPanelShort'))
inspectorToggle.append(activityScreenReader)
const inspectorBadge = el('span', 'wb-badge')
inspectorBadge.hidden = true
inspectorBadge.setAttribute('aria-hidden', 'true')
inspectorToggle.append(inspectorBadge)

const themeToggle = el('button', 'icon-button')
themeToggle.type = 'button'
themeToggle.dataset.testid = 'theme-toggle'
copy.attr(themeToggle, 'aria-label', 'workbench.toggleTheme')
themeToggle.append(icon(ICONS.sun, 20))

topbarActions.append(connection, inspectorToggle, themeToggle)
topbar.append(openSidebarButton, modelPicker, topbarActions)

const replayBanner = el('p', 'wb-error-line')
replayBanner.dataset.testid = 'public-replay'
replayBanner.append(copy.text('workbench.replayNotice'))
replayBanner.hidden = true

const surface = el('div', 'wb-surface')

const welcome = el('div', 'wb-welcome')
welcome.dataset.testid = 'welcome'
const welcomeTitle = el('h1', 'wb-welcome-title')
welcomeTitle.append(copy.text('workbench.welcomeTitle'))
// A suggestion that fills the composer with a real prompt; it never pretends
// to send, and it is a real action rather than a decorative chip.
welcome.append(welcomeTitle)

/*
 * Observers watching each timeline element, so a rebuild can stop the old one.
 * Declared here, above the first `createTimeline()` call: the module builds a
 * timeline during its own initialization, and a `const` below that point would
 * be in its temporal dead zone.
 */
const timelineObservers = new WeakMap<Element, MutationObserver>()

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
welcomeSuggestion.append(copy.text('workbench.welcomeSuggestion'))
welcomeSuggestion.addEventListener('click', () => {
  fillActiveComposer(t('workbench.welcomeSuggestionPrompt'))
})
const composerZone = el('div', 'wb-composer-zone is-centred')
const dock: ComposerDock = createComposerDock(composerZone)
dock.setAccessory(welcomeSuggestion)
// The Host composer is created once. `setMode('host')` below claims it in the
// dock; until then the zone carries the accessory only.
const hostComposer: ComposerDockOwner = createHostComposerOwner()

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
copy.attr(drawer, 'aria-label', 'workbench.agentActivity')
// `hidden` on a fixed element is not enough in some engines; `display: none`
// is applied by the stylesheet for [hidden], and this keeps it inert.
drawer.inert = true

const drawerHead = el('div', 'wb-drawer-head')
const drawerTitle = el('h2', 'wb-drawer-title')
drawerTitle.append(copy.text('workbench.agentActivity'))
const drawerClose = el('button', 'icon-button')
drawerClose.type = 'button'
drawerClose.dataset.testid = 'inspector-close'
copy.attr(drawerClose, 'aria-label', 'workbench.closeActivityPanel')
drawerClose.append(icon(ICONS.close, 18))
drawerClose.style.marginLeft = 'auto'
drawerHead.append(drawerTitle, drawerClose)

const drawerTabs = el('div', 'wb-drawer-tabs')
drawerTabs.setAttribute('role', 'tablist')
const drawerBody = el('div', 'wb-drawer-body')

const propose = el('button', 'wb-pill-button')
propose.type = 'button'
propose.dataset.testid = 'propose-change'
propose.append(copy.text('workbench.requestProtectedWrite'))
propose.style.border = '1px solid var(--wb-border-default)'

const approval = el('div')
approval.dataset.testid = 'approvals'

const reviewHeading = el('h2', 'wb-drawer-section-title')
reviewHeading.append(copy.text('workbench.changedFiles'))
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
runChecks.append(copy.text('workbench.runChecks'))
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
const sidePanes: Array<{
  id: SideTabId
  labelKey: WorkbenchMessageKey
  pane: HTMLElement
}> = [
  { id: 'activity', labelKey: 'workbench.tabApprovals', pane: approval },
  { id: 'changes', labelKey: 'workbench.tabChanges', pane: reviewPane },
  { id: 'tests', labelKey: 'workbench.tabTests', pane: testsPane },
]
const sideTabButtons = new Map<SideTabId, HTMLButtonElement>()
for (const entry of sidePanes) {
  const tab = el('button', 'wb-drawer-tab')
  tab.type = 'button'
  tab.setAttribute('role', 'tab')
  tab.dataset.testid = `side-tab-${entry.id}`
  tab.append(copy.text(entry.labelKey))
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
        payload.error?.message ??
          t('workbench.checksFailed', { status: response.status }),
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
  // Locale is a property: the element re-renders its own text and keeps its
  // controller subscriptions (and any streamed message) intact.
  element.locale = getAiLocale()
  element.setAttribute('label', t('workbench.timelineLabel'))
  element.dataset.testid = 'timeline'
  element.classList.add('timeline')
  /*
   * The timeline renders its own code blocks as plain text, by the same
   * framework-neutral contract the BYOK view relies on. Colouring them here
   * keeps both surfaces identical: a reader comparing Agent output with their
   * own model's should not see two different code presentations.
   *
   * An observer rather than a hook: the element owns its DOM and re-renders
   * when a message streams, and the highlighter is idempotent, so reacting to
   * the nodes appearing is enough and needs no cooperation from the component.
   */
  const observer = new MutationObserver(() => highlightCodeBlocks(element))
  observer.observe(element, {
    childList: true,
    subtree: true,
    characterData: true,
  })
  // Kept on the element so the rebuild path below can stop it. `activateConversation`
  // removes this node and creates a new timeline; an observer left running on a
  // detached element would keep re-highlighting it forever.
  timelineObservers.set(element, observer)
  return element
}

interface ComposerDockOwner {
  readonly id: 'host'
  readonly element: HTMLElement
  readonly focus: () => void
}

/**
 * The Host composer. It is created once and re-pointed at the active
 * conversation, instead of being rebuilt: rebuilding replaced the element the
 * dock owned and left the previous one with a live controller.
 */
function createHostComposerOwner(): ComposerDockOwner {
  const wrapper = el('div', 'wb-composer-stack')
  const element = document.createElement(
    'zw-ai-composer',
  ) as AiElementInstance & { controller: unknown }
  element.controller = composer
  element.locale = getAiLocale()
  element.setAttribute('label', t('workbench.composerLabel'))
  if (readOnly) element.setAttribute('disabled', '')
  element.dataset.testid = 'composer'
  element.classList.add('composer')
  const fileLabel = el('label', 'attach')
  copy.attr(fileLabel, 'aria-label', 'workbench.attachFile')
  copy.attr(fileLabel, 'title', 'workbench.attachFile')
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
    const placeholder = t('workbench.composerPlaceholder')
    if (textarea && textarea.placeholder !== placeholder) {
      textarea.placeholder = placeholder
    }
  }
  // The patcher reuses the textarea node across re-renders, so the value only
  // has to be re-applied when the language changes. A MutationObserver here
  // used to do that and was never disconnected; a copy binding is enough.
  copy.custom(syncPlaceholder)
  syncPlaceholder()

  wrapper.append(element, fileLabel, attachStatus)
  return {
    id: 'host',
    element: wrapper,
    focus: () => element.querySelector('textarea')?.focus(),
  }
}

async function uploadAttachment(
  file: File,
  status: HTMLElement,
): Promise<void> {
  status.textContent = t('workbench.uploading')
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
        payload.error?.message ??
          t('workbench.uploadFailed', { status: response.status }),
      )
    }
    composer.updateAttachment(localId, {
      asset: payload.asset,
      status: 'ready',
    })
    status.textContent = t('workbench.attached', { name: file.name })
  } catch (error) {
    composer.updateAttachment(localId, { status: 'failed' })
    status.textContent =
      error instanceof Error
        ? error.message
        : t('workbench.attachmentUploadFailed')
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
// Seeded titles are chrome copy; a title the user renames is data and is kept
// verbatim across language switches. The map remembers how each seed is built.
const seededTitles = new Map<string, { index?: number; newChat?: boolean }>()
knownConversations.set(conversationId, {
  id: conversationId,
  title: t('workbench.referenceConversation'),
})
seededTitles.set(conversationId, {})

/**
 * The sidebar lists the active mode's conversations, because they are two
 * different stores: Host conversations are the session's, BYOK conversations
 * are local rows in IndexedDB. Showing the Host's "Reference conversation"
 * while the reader is in their own model would offer a row that cannot open.
 */
/**
 * Whether a conversation matches the current query.
 *
 * Titles are data, not copy, so the match is case-insensitive substring on the
 * title the reader sees. The body is searched too for BYOK rows, where the title
 * is often generic ("New chat") and the message text is what a person actually
 * remembers.
 */
function matchesQuery(text: string): boolean {
  if (!searchQuery) return true
  return text.toLowerCase().includes(searchQuery.toLowerCase())
}

function renderConversationList(): void {
  conversationListRoot.replaceChildren()
  // The search-empty notice belongs to whichever list rendered last; each
  // branch sets it for itself.
  searchEmpty.hidden = true
  if (mode === 'byok') {
    renderByokConversationList()
    return
  }
  const visible = [...knownConversations.values()].filter(entry =>
    matchesQuery(entry.title),
  )
  conversationEmpty.hidden = knownConversations.size > 0 || !searchQuery
  if (searchQuery && visible.length === 0 && knownConversations.size > 0) {
    renderSearchEmpty()
    searchEmpty.hidden = false
    searchEmpty.dataset.query = searchQuery
  }
  for (const entry of visible) {
    const row = el('li', 'wb-conversation-row')
    row.dataset.conversationId = entry.id
    if (entry.id === conversationId) row.classList.add('is-active')
    const button = el('button', 'wb-conversation-button')
    button.type = 'button'
    button.dataset.conversationId = entry.id
    const title = el('span', 'wb-conversation-title')
    // Bound through the map, not captured: a language switch re-derives a seed
    // title in place, while a renamed title stays exactly as typed.
    copy.custom(
      () => {
        title.textContent =
          knownConversations.get(entry.id)?.title ?? entry.title
      },
      () => title,
    )
    button.append(title)
    button.addEventListener('click', () => activateConversation(entry.id))
    const menu = el('button', 'wb-conversation-menu')
    menu.type = 'button'
    copy.attr(menu, 'aria-label', 'workbench.chatOptionsFor', () => ({
      title: entry.title,
    }))
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

function renderByokConversationList(): void {
  const actions = byokView?.actions
  const entries = actions?.conversations() ?? []
  const activeId = actions?.activeConversationId()
  conversationEmpty.hidden = entries.length > 0
  // Before the view exists the store may already hold conversations; reading
  // it directly keeps the sidebar truthful on the first render.
  const all =
    entries.length > 0
      ? entries
      : conversationStore.list().map(item => ({
          id: item.id,
          title: item.title,
        }))
  /*
   * BYOK rows are matched on the title and on their message text. The stored
   * title is frequently the default "New chat" — a person looking for a thread
   * remembers what they said in it, not the label. Only this mode's own rows
   * are searched: the Host's conversations are not in this store, and mixing
   * them here would cross the permission boundary the two modes keep.
   */
  // The body search reads the store, so it only runs when a query is active.
  // `renderConversationList` sits on the mode-switch path, and reading the
  // store there on every switch (as an earlier version did) added synchronous
  // work to a path whose contract is that a switch is cheap and the draft in
  // the composer survives it.
  const storedById = searchQuery
    ? new Map(conversationStore.list().map(item => [item.id, item]))
    : undefined
  const rows = all.filter(entry => {
    if (!searchQuery) return true
    if (matchesQuery(entry.title)) return true
    const stored = storedById?.get(entry.id)
    return Boolean(stored?.turns.some(turn => matchesQuery(turn.content ?? '')))
  })
  conversationEmpty.hidden = all.length > 0 || Boolean(searchQuery)
  if (searchQuery && rows.length === 0 && all.length > 0) {
    renderSearchEmpty()
    searchEmpty.hidden = false
    searchEmpty.dataset.query = searchQuery
  }
  for (const entry of rows) {
    const row = el('li', 'wb-conversation-row')
    row.dataset.conversationId = entry.id
    if (entry.id === activeId) row.classList.add('is-active')
    const button = el('button', 'wb-conversation-button')
    button.type = 'button'
    button.dataset.conversationId = entry.id
    const title = el('span', 'wb-conversation-title')
    title.textContent = entry.title || t('workbench.newChat')
    button.append(title)
    button.addEventListener('click', () => {
      byokView?.actions.openConversation(entry.id)
      renderConversationList()
    })
    row.append(button)
    conversationListRoot.append(row)
  }
}

let openMenuElement: HTMLElement | undefined
let menuCloseCleanup: (() => void) | undefined
function closeConversationMenu(): void {
  const cleanup = menuCloseCleanup
  menuCloseCleanup = undefined
  cleanup?.()
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
  const menuCopy = createCopy()
  const stopMenuCopy = refreshOnLanguageChange(menuCopy)
  const closeMenuScope = (): void => {
    stopMenuCopy()
    menuCopy.dispose()
  }
  const rename = el('button', 'wb-menu-item')
  rename.type = 'button'
  rename.setAttribute('role', 'menuitem')
  menuCopy.node(rename, 'workbench.rename')
  rename.addEventListener('click', () => {
    closeConversationMenu()
    renameConversation(entry)
  })
  const remove = el('button', 'wb-menu-item wb-menu-item-danger')
  remove.type = 'button'
  remove.setAttribute('role', 'menuitem')
  menuCopy.node(remove, 'workbench.delete')
  remove.addEventListener('click', () => {
    closeConversationMenu()
    confirmDeleteConversation(entry)
  })
  menu.append(rename, remove)
  // The popover is transient; drop its bindings when it closes.
  menuCloseCleanup = closeMenuScope
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
  input.setAttribute('aria-label', t('workbench.chatTitle'))
  title.replaceWith(input)
  input.focus()
  input.select()
  let settled = false
  const finish = (value: string | null): void => {
    if (settled) return
    settled = true
    const next = value?.trim()
    if (next) {
      knownConversations.set(entry.id, { ...entry, title: next })
      // A renamed title is user data now: it must not be re-derived on a
      // language switch.
      seededTitles.delete(entry.id)
    }
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
  // The dialog is transient; its copy is bound to a scoped catalog so a
  // language switch while it is open relabels it in place.
  const dialogCopy = createCopy()
  const heading = el('h2', 'wb-dialog-title')
  heading.id = 'wb-delete-title'
  dialogCopy.node(heading, 'workbench.deleteChatTitle')
  const body = el('p', 'wb-dialog-copy')
  dialogCopy.node(body, 'workbench.deleteChatCopy', () => ({
    title: entry.title,
  }))
  const actions = el('div', 'wb-dialog-actions')
  const cancel = el('button', 'wb-dialog-button')
  cancel.type = 'button'
  dialogCopy.node(cancel, 'workbench.cancel')
  const confirm = el('button', 'wb-dialog-button is-destructive')
  confirm.type = 'button'
  confirm.dataset.testid = 'delete-confirm'
  dialogCopy.node(confirm, 'workbench.delete')
  actions.append(cancel, confirm)
  dialog.append(heading, body, actions)
  scrim.append(dialog)
  document.body.append(scrim)
  cancel.focus()
  let close = (): void => {}
  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') close()
  }
  const stopCopy = refreshOnLanguageChange(dialogCopy)
  close = (): void => {
    stopCopy()
    dialogCopy.dispose()
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
        title: t('workbench.newChat'),
      })
      seededTitles.set(conversationId, { newChat: true })
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
  // The composer element is not rebuilt: its controller property is re-pointed
  // at the new conversation. Rebuilding it replaced the node the dock owns and
  // left the previous element subscribed to the previous controller.
  const control = hostComposer.element.querySelector<
    AiElementInstance & { controller: unknown }
  >('zw-ai-composer')
  if (control) control.controller = composer
  timelineObservers.get(timeline)?.disconnect()
  timelineObservers.delete(timeline)
  timeline.remove()
  timeline = createTimeline()
  threadInner.append(timeline)
  renderConversationList()
  updateConversationTitle()
  updateWelcome()
}

let conversationCounter = 1
newChatButton.addEventListener('click', () => {
  // A new chat means a new chat in the mode the reader is in. Creating a Host
  // conversation while they are in BYOK is how the two surfaces used to get
  // crossed: the sidebar showed a Host session and the composer was BYOK.
  if (mode === 'byok') {
    const view = ensureByokView()
    view.actions.newConversation()
    renderConversationList()
    view.actions.focus()
    return
  }
  conversationCounter += 1
  const id = `workbench-${conversationCounter}`
  knownConversations.set(id, {
    id,
    title: t('workbench.sessionTitle', { index: conversationCounter }),
  })
  seededTitles.set(id, { index: conversationCounter })
  // Publish the local session in the controller's view. The Host upserts the
  // same id on the first message, so reload cannot invent a second aggregate.
  activateConversation(id)
  renderConversationList()
  hostComposer.focus()
})

/* ------------------------------------------------------- host connection */
/**
 * Connection copy. The transport is never rebuilt for a language switch: the
 * label is re-derived from the connection the session is already in.
 */
let connectionState: SessionConnection = 'idle'
copy.custom(() => {
  // The demo's transport is a recording replayed from memory, so it reaches
  // the recorded state rather than a live one. Reporting "connecting" there
  // would describe a state the session is not in.
  connection.setAttribute(
    'aria-label',
    isDemoBuild
      ? t('workbench.connection.replayAria')
      : t('workbench.hostConnection', {
          status: t(connectionStatusKey(connectionState)),
        }),
  )
  connection.dataset.connection = isDemoBuild ? 'live' : connectionState
  connectionDot.dataset.connection = isDemoBuild ? 'live' : connectionState
  connectionText.textContent = isDemoBuild
    ? t('workbench.connection.replay')
    : t(connectionStatusKey(connectionState))
})
session.subscribe(
  view => view.connection,
  state => {
    connectionState = state
    copy.refresh()
  },
)
session.connect()

/**
 * Read-only is a property of the *Agent* surface, not of the workbench.
 *
 * The published demo has no Host, so the Host composer, approvals and checks
 * are disabled there. BYOK talks to a gateway the reader supplies and is fully
 * interactive in the same build; disabling New chat for both modes is what
 * made the whole page look broken.
 */
function applyReadOnly(): void {
  const composerControl = hostComposer.element.querySelector('zw-ai-composer')
  if (composerControl) {
    if (readOnly) composerControl.setAttribute('disabled', '')
    else composerControl.removeAttribute('disabled')
  }
  propose.disabled = readOnly
  runChecks.disabled = readOnly
  newChatButton.disabled = readOnly && mode === 'host'
  updateReplayBanner()
}

if (isDemoBuild) {
  // The demo has no Host to probe. It is read-only by construction: the replay
  // host rejects every command, so the composer must not pretend otherwise.
  readOnly = true
  applyReadOnly()
  // Say it is a demo, not just that it is read-only: the visitor must not
  // mistake a recorded replay for a live model. The banner copy comes from the
  // same catalog entry in both languages, and it stays on the Agent surface.
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

/**
 * Approvals already present when the surface first rendered.
 *
 * The drawer must open for a request that arrives *while* the user is here —
 * that is the one thing they must not miss — but not for requests that were
 * already waiting when the page loaded. Opening it on load covers the chat
 * before the visitor has said anything, and in a replayed session every
 * request in the recording is already waiting.
 *
 * The baseline is captured *before* the first call, not on it: the store
 * subscription can fire during setup, so "the first call I see" is not
 * necessarily the first render, and seeding the set there made the second call
 * look like a new arrival.
 */
let knownApprovals: Set<string> | undefined

function refreshApprovals(): void {
  const pending = [...session.store.getState().approvals.values()].filter(
    item => item.status === 'pending',
  )
  // The baseline is the first non-empty set we ever see: at module load the
  // store is still empty, so seeding from it would make every recorded
  // approval look like it arrived while the visitor was watching.
  if (knownApprovals === undefined) {
    if (pending.length === 0) {
      approval.replaceChildren()
      approval.append(copy.text('workbench.noPendingApprovals'))
      updateInspectorBadge()
      return
    }
    knownApprovals = new Set(pending.map(item => item.id))
  }
  const arrived = pending.filter(item => !knownApprovals!.has(item.id))
  for (const item of pending) knownApprovals.add(item.id)
  for (const id of [...knownApprovals]) {
    if (!pending.some(item => item.id === id)) knownApprovals.delete(id)
  }

  approval.replaceChildren()
  updateInspectorBadge()
  if (pending.length === 0) {
    approval.append(copy.text('workbench.noPendingApprovals'))
    return
  }
  if (arrived.length > 0) openInspector('activity')
  for (const item of pending) {
    const prompt = document.createElement(
      'zw-ai-approval-prompt',
    ) as AiElementInstance & { controller: ApprovalController }
    prompt.controller = createApprovalController({
      session,
      approvalId: item.id,
    })
    prompt.locale = getAiLocale()
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
  changeTree.locale = getAiLocale()
  diffViewer.locale = getAiLocale()
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
  dock.setAccessoryVisible(empty && mode === 'host')
  // The reference centres the composer under the welcome line in an empty
  // chat, then anchors it to the bottom once the conversation starts. The
  // dock moves the whole zone, so the claimed composer and its draft follow
  // without being re-parented themselves.
  if (empty) dock.mount(welcome)
  else dock.mount(surface)
}

function updateConversationTitle(): void {
  const title =
    knownConversations.get(conversationId)?.title ?? t('workbench.newChat')
  modelPicker.title = title
}

/**
 * Test hooks. The gates need to know which conversation a controller points
 * at, and rebuilding that from the DOM would only re-test the DOM. These are
 * not part of any API surface; nothing in the app reads them.
 */
function updateGlobalWorkbench(): void {
  Object.assign(globalThis, {
    __aiWorkbench: {
      session,
      conversation,
      composer,
      dock,
      get mode() {
        return mode
      },
      get conversationId() {
        return conversationId
      },
      get byokActiveConversationId() {
        return byokView?.actions.activeConversationId()
      },
    },
  })
}

/* ---------------------------------------------------------- sidebar open */

/**
 * Sidebar toggle labels: the key is stored, not the translated string, so a
 * language switch relabels both buttons from the current state.
 */
let sidebarToggleKey: WorkbenchMessageKey = 'workbench.openSidebar'
copy.custom(() => {
  collapseButton.setAttribute('aria-label', t('workbench.closeSidebar'))
  openSidebarButton.setAttribute('aria-label', t(sidebarToggleKey))
})

function setSidebarOpen(open: boolean): void {
  const mobile = window.matchMedia('(max-width: 767px)').matches
  if (mobile) {
    shell.classList.toggle('is-sidebar-open-mobile', open)
    sidebarScrim.hidden = !open
    sidebarToggleKey = 'workbench.closeSidebar'
    openSidebarButton.setAttribute('aria-label', t(sidebarToggleKey))
    return
  }
  shell.classList.toggle('is-sidebar-collapsed', !open)
  try {
    localStorage.setItem('zeus-wb-sidebar', open ? 'open' : 'closed')
  } catch {
    // Private mode; the toggle still works for the session.
  }
  sidebarToggleKey = 'workbench.openSidebar'
  openSidebarButton.setAttribute('aria-label', t(sidebarToggleKey))
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
let settingsOpen = false
let disposeSettings: (() => void) | undefined

/*
 * The picker is the single place both the mode and the model are chosen, as
 * the reference's model selector is. Two modes are two products sharing a
 * shell, so the menu states what each one is instead of leaving a segmented
 * control that reads like a developer toggle:
 *
 *   Agent        a read-only replay of a recorded Host session
 *   My model     the OpenAI-compatible gateway this browser talks to
 */
const pickerMenu = el('div', 'wb-popover wb-picker-menu')
pickerMenu.setAttribute('role', 'menu')
pickerMenu.dataset.testid = 'model-menu'
pickerMenu.hidden = true

const agentGroupLabel = el('p', 'wb-picker-section')
copy.node(agentGroupLabel, 'workbench.pickerAgentSection')
const hostModeButton = el('button', 'wb-picker-item')
hostModeButton.type = 'button'
hostModeButton.setAttribute('role', 'menuitemradio')
hostModeButton.dataset.testid = 'mode-host'
const hostModeName = el('span', 'wb-picker-item-name')
copy.node(hostModeName, 'workbench.modeAgent')
const hostModeHint = el('span', 'wb-picker-item-hint')
copy.node(hostModeHint, 'workbench.pickerAgentHint')
hostModeButton.append(hostModeName, hostModeHint)

const modelGroupLabel = el('p', 'wb-picker-section')
copy.node(modelGroupLabel, 'workbench.pickerModelSection')
const byokModeButton = el('button', 'wb-picker-item')
byokModeButton.type = 'button'
byokModeButton.setAttribute('role', 'menuitemradio')
byokModeButton.dataset.testid = 'mode-byok'
const byokModeName = el('span', 'wb-picker-item-name')
copy.node(byokModeName, 'workbench.modeByok')
const byokModeHint = el('span', 'wb-picker-item-hint')
byokModeHint.dataset.testid = 'picker-model-hint'
const setupModelButton = el('button', 'wb-picker-item')
setupModelButton.type = 'button'
setupModelButton.setAttribute('role', 'menuitem')
setupModelButton.dataset.testid = 'picker-setup'
const setupModelName = el('span', 'wb-picker-item-name')
copy.node(setupModelName, 'workbench.pickerSetupModel')
const setupModelHint = el('span', 'wb-picker-item-hint')
copy.node(setupModelHint, 'workbench.pickerSetupModelHint')
setupModelButton.append(setupModelName, setupModelHint)
byokModeButton.append(byokModeName, byokModeHint)
pickerMenu.append(
  agentGroupLabel,
  hostModeButton,
  modelGroupLabel,
  byokModeButton,
  setupModelButton,
)
document.body.append(pickerMenu)

/* The picker's own label: what the session will answer as, not a mode name. */
function renderPickerLabel(): void {
  const provider = mode === 'byok' ? providerStore.active() : undefined
  const name =
    mode === 'byok'
      ? provider
        ? provider.name || t('byok.providerFallback')
        : t('workbench.modeByok')
      : t('workbench.modeAgent')
  modelName.textContent = name
  const detail =
    mode === 'byok'
      ? provider
        ? provider.model || t('byok.noModel')
        : t('workbench.pickerNoModel')
      : t('workbench.pickerReplay')
  modelKind.textContent = detail

  // The hint under "My model" in the menu names the active provider, so the
  // menu answers "which model am I using" without opening settings.
  byokModeHint.textContent = provider
    ? `${provider.name || t('byok.providerFallback')} · ${provider.model || t('byok.noModel')}`
    : t('workbench.pickerNoModel')
  hostModeButton.setAttribute('aria-checked', String(mode === 'host'))
  byokModeButton.setAttribute('aria-checked', String(mode === 'byok'))
  hostModeButton.classList.toggle('is-active', mode === 'host')
  byokModeButton.classList.toggle('is-active', mode === 'byok')
  setupModelButton.hidden = Boolean(provider)
}

let pickerOpen = false
/** The items a keyboard user can move between, in visual order. */
function pickerItems(): HTMLButtonElement[] {
  return [hostModeButton, byokModeButton, setupModelButton].filter(
    item => !item.hidden,
  )
}

function setPickerOpen(open: boolean, focusFirst = false): void {
  pickerOpen = open
  pickerMenu.hidden = !open
  modelPicker.setAttribute('aria-expanded', String(open))
  if (open) {
    renderPickerLabel()
    const rect = modelPicker.getBoundingClientRect()
    pickerMenu.style.top = `${rect.bottom + 6}px`
    pickerMenu.style.left = `${Math.max(8, rect.left)}px`
    if (focusFirst) pickerItems()[0]?.focus()
    setTimeout(
      () => document.addEventListener('click', onDocumentClick, true),
      0,
    )
  } else {
    document.removeEventListener('click', onDocumentClick, true)
    if (pickerMenu.contains(document.activeElement)) modelPicker.focus()
  }
}

/* Menu keyboard behaviour: Escape closes and returns focus; arrows and Home /
   End move between items, as a menu must. */
pickerMenu.addEventListener('keydown', event => {
  const items = pickerItems()
  if (items.length === 0) return
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  if (event.key === 'Escape') {
    event.preventDefault()
    setPickerOpen(false)
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    const next = index < 0 ? 0 : (index + step + items.length) % items.length
    items[next]?.focus()
    return
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    items[event.key === 'Home' ? 0 : items.length - 1]?.focus()
  }
})

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as Node | null
  if (target && (pickerMenu.contains(target) || modelPicker.contains(target))) {
    return
  }
  setPickerOpen(false)
}

modelPicker.addEventListener('click', () => setPickerOpen(!pickerOpen))
modelPicker.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    setPickerOpen(true, true)
  }
})

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
copy.attr(settingsBack, 'aria-label', 'workbench.backToChat')
settingsBack.append(icon(['m19 12H5', 'M12 19l-7-7 7-7'], 20))
const settingsTitle = el('h2', 'wb-settings-page-title')
settingsTitle.append(copy.text('workbench.settings'))
settingsHead.append(settingsBack, settingsTitle)
const settingsBody = el('div', 'wb-settings-page-body')
settingsPage.append(settingsHead, settingsBody)

/*
 * Language is a settings row, not a banner: one compact line inside the
 * existing settings page, next to the provider panel. It changes only text;
 * the Host session, SSE stream, BYOK vault and both chat controllers are
 * untouched.
 */
const languageSection = el('section', 'wb-settings-section')
languageSection.dataset.testid = 'language-settings'
const languageHead = el('div', 'wb-settings-section-head')
const languageTitle = el('h2', 'wb-settings-section-title')
languageTitle.append(copy.text('workbench.language'))
const languageCopy = el('p', 'wb-settings-section-copy')
languageCopy.append(copy.text('workbench.languageDescription'))
languageHead.append(languageTitle, languageCopy)

const languageGroup = el('div', 'wb-mode-switch')
languageGroup.setAttribute('role', 'group')
copy.attr(languageGroup, 'aria-label', 'workbench.language')
const languageButtons = new Map<WorkbenchLanguage, HTMLButtonElement>()
for (const entry of WORKBENCH_LANGUAGES) {
  const button = el('button', 'wb-segment')
  button.type = 'button'
  button.dataset.testid = `language-${entry.id}`
  button.setAttribute('lang', entry.tag)
  button.append(copy.text(entry.labelKey))
  button.addEventListener('click', () => setLanguage(entry.id))
  languageButtons.set(entry.id, button)
  languageGroup.append(button)
}
languageSection.append(languageHead, languageGroup)
settingsBody.append(languageSection)

// The provider panel keeps its own root so the language row stays above it and
// the panel can re-render without touching the setting that is not its own.
const settingsProviders = el('div')
settingsBody.append(settingsProviders)

function syncLanguageButtons(): void {
  const active = getLanguage()
  for (const [id, button] of languageButtons) {
    button.classList.toggle('is-active', id === active)
    button.setAttribute('aria-pressed', String(id === active))
  }
}
syncLanguageButtons()

/*
 * A language switch only rewrites text. Controllers, the SSE connection, the
 * BYOK vault and IndexedDB are all untouched: the AI elements get a new
 * `locale` property (which re-renders their own text in place), the shell copy
 * scope re-runs, and the document title is re-derived.
 */
function applyLanguage(): void {
  syncLanguageButtons()
  // Seed titles live in the map; refresh them before the bindings read it.
  refreshSeededTitles()
  copy.refresh()
  syncAiElements()
  updateConversationTitle()
  renderPickerLabel()
  renderConversationList()
}
subscribeLanguage(applyLanguage)

/**
 * Seed titles ("Reference conversation", "Session 2") are chrome copy that
 * lives in the conversation map, not in a text node. They are re-derived only
 * where the user has not renamed them; a user-chosen title is data and stays
 * exactly as typed.
 */
function refreshSeededTitles(): void {
  for (const [id, seed] of seededTitles) {
    const entry = knownConversations.get(id)
    if (!entry) continue
    knownConversations.set(id, {
      ...entry,
      title: seed.newChat
        ? t('workbench.newChat')
        : seed.index === undefined
          ? t('workbench.referenceConversation')
          : t('workbench.sessionTitle', { index: seed.index }),
    })
  }
}

/**
 * Hands the active locale to every mounted AI element.
 *
 * The property setter re-renders that element's own text (the keyed patcher
 * reuses nodes), so no subscription, controller, stream or scroll state is
 * touched. New elements created later read `getAiLocale()` at construction;
 * this sweep covers the ones already on screen.
 */
function syncAiElements(): void {
  const locale = getAiLocale()
  for (const element of document.querySelectorAll<AiElementInstance>(
    'zw-ai-composer, zw-ai-message-timeline, zw-ai-approval-prompt, zw-ai-file-change-tree, zw-ai-diff-viewer, zw-ai-test-report',
  )) {
    element.locale = locale
  }
}
// A sibling of the chat surface, not a child: opening settings hides the
// surface, and `[hidden]` is authoritative in the stylesheet, so nesting the
// page inside it would hide the page too. The topbar (model picker, activity,
// theme) stays reachable, as it does in the reference.
main.append(settingsPage)
settingsBack.addEventListener('click', () => toggleSettings(false))

const byokHost = el('div', 'byok-host')
byokHost.hidden = true
byokThread.append(byokHost)

/** The BYOK view is created the first time the reader opens that mode. */
function ensureByokView(): ByokChatView {
  if (byokView) return byokView
  byokView = mountByokChat({
    host: byokHost,
    composerHost: composerZone,
    onTitle: () => renderPickerLabel(),
    onTitleChange: () => {
      renderPickerLabel()
      if (mode === 'byok') renderConversationList()
    },
    onConversationsChange: () => {
      if (mode === 'byok') renderConversationList()
    },
  })
  return byokView
}

function setMode(next: Mode): void {
  if (settingsOpen) toggleSettings(false)
  if (next === mode && next === 'host') {
    // Re-selecting Agent while already there is a no-op, but the first call
    // still has to claim the Host composer, and a provider may have been
    // removed meanwhile, so the label is re-derived too.
    //
    // The menu still has to close. This branch returns before the shared
    // `setPickerOpen(false)` below, so without it a reader who opens the picker
    // and picks the mode they are already in is left looking at an open menu
    // with nothing happening — the state the production-build gate caught.
    setPickerOpen(false)
    if (dock.activeId() !== 'host') dock.claim(hostComposer)
    renderPickerLabel()
    return
  }
  setPickerOpen(false)
  mode = next
  renderPickerLabel()

  if (next === 'byok') {
    closeInspector()
    // Host-only chrome (the SSE lamp and the agent activity panel) is not
    // shown over the reader's own model: a green "live" dot or an approval
    // drawer there would describe a connection this mode does not use.
    connection.hidden = true
    inspectorToggle.hidden = true
    const view = ensureByokView()
    hideHostSurface()
    byokThread.hidden = false
    byokHost.hidden = false
    // Detach the Host composer, then hand the zone to BYOK. `claim` removes
    // the previous owner from the document, so exactly one composer is
    // mounted and only that one can take focus or a submit.
    dock.claim({
      id: 'byok',
      element: view.composer,
      focus: () => view.actions.focus(),
    })
    dock.mount(surface)
    composerZone.classList.remove('is-centred')
    dock.setAccessoryVisible(false)
    renderConversationList()
    updateReplayBanner()
    newChatButton.disabled = readOnly && mode === 'host'
    return
  }

  // Leaving BYOK detaches its composer; the view itself stays alive so its
  // conversations, streams and scroll position survive a round trip.
  connection.hidden = false
  inspectorToggle.hidden = false
  byokHost.hidden = true
  dock.release('byok')
  byokThread.hidden = true
  dock.claim(hostComposer)
  showHostSurface()
  renderConversationList()
  updateReplayBanner()
  newChatButton.disabled = readOnly && mode === 'host'
}

function hideHostSurface(): void {
  welcome.hidden = true
  thread.hidden = true
}

function showHostSurface(): void {
  updateWelcome()
}

/**
 * The replay notice belongs to the Agent surface only. Showing it while the
 * reader is in their own model would claim the whole workbench is read-only,
 * which is exactly the confusion the three states exist to remove.
 */
function updateReplayBanner(): void {
  replayBanner.hidden = !(readOnly && mode === 'host')
}

function toggleSettings(open: boolean): void {
  settingsOpen = open
  settingsButton.classList.toggle('is-active', open)
  settingsPage.hidden = !open
  surface.hidden = open
  if (open) {
    closeInspector()
    setPickerOpen(false)
    if (!disposeSettings) {
      disposeSettings = mountProviderPanel({ root: settingsProviders })
    }
  }
}

/** Fills the visible composer with a prompt, whatever mode owns it. */
function fillActiveComposer(text: string): void {
  const target = dock.activeElement()?.querySelector('textarea')
  if (!target) return
  target.value = text
  target.dispatchEvent(new Event('input', { bubbles: true }))
  target.focus()
}

hostModeButton.addEventListener('click', () => setMode('host'))
byokModeButton.addEventListener('click', () => setMode('byok'))
setupModelButton.addEventListener('click', () => {
  setPickerOpen(false)
  toggleSettings(true)
})
settingsButton.addEventListener('click', () => toggleSettings(true))
window.addEventListener('byok:open-settings', () => toggleSettings(true))
window.addEventListener('byok:providers-changed', () => {
  renderPickerLabel()
  if (mode === 'byok') renderConversationList()
})
// The picker names the active provider, so it must follow the store rather
// than only being redrawn when a mode or language changes.
providerStore.subscribe(() => {
  renderPickerLabel()
  if (mode === 'byok') renderConversationList()
})

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

applyInitialLanguage()
document.title = t('workbench.documentTitle')
applyTheme(readTheme())
renderPickerLabel()
updateReplayBanner()
setMode('host')
renderConversationList()
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
