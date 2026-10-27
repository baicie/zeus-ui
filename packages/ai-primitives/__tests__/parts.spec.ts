/**
 * Primitive parts: intent wiring, ARIA and keyboard models (no DOM).
 */

import type { ApprovalViewState, ComposerViewState } from '@zeus-web/ai-core'

import {
  createComposerController,
  createTimelineController,
} from '@zeus-web/ai-core'
import { describe, expect, it, vi } from 'vitest'
import {
  getApprovalPromptParts,
  getRunSwitcherParts,
  redactPreview,
} from '../src/agent'
import { adjacentHunk, buildFileTree, diffRows } from '../src/coding'
import { createCombobox, getComboboxParts } from '../src/combobox'
import { getComposerParts } from '../src/composer'
import { createContextPicker, detectTrigger } from '../src/context-picker'
import { feedTarget, getTimelineParts } from '../src/conversation'
import { formatUsage, groupRunsForBoard } from '../src/extensions/summaries'
import { createVoiceInput } from '../src/extensions/voice'
import { createIdScope, syntheticEvent } from '../src/parts'
import { createTreeController, getTreeParts } from '../src/tree'

function composer() {
  const execute = vi.fn(async (command: { commandId: string }) => ({
    accepted: true as const,
    commandId: command.commandId,
    operationId: 'op',
  }))
  const controller = createComposerController({
    session: { execute },
    conversationId: 'conv-1',
  })
  return { controller, execute }
}

describe('composer parts (AI2-206)', () => {
  it('maps input, IME and Enter to controller intents', () => {
    const { controller, execute } = composer()
    const ids = createIdScope()
    const parts = () =>
      getComposerParts(controller.getSnapshot(), controller, { ids })

    parts().textarea.on!.input!(syntheticEvent({ value: '你好' }))
    parts().textarea.on!.compositionstart!(syntheticEvent())
    const composing = syntheticEvent({ key: 'Enter', isComposing: true })
    parts().textarea.on!.keydown!(composing)
    expect(composing.defaultPrevented).toBe(false)
    expect(execute).not.toHaveBeenCalled()

    parts().textarea.on!.compositionend!(syntheticEvent({ value: '你好' }))
    const enter = syntheticEvent({ key: 'Enter' })
    parts().textarea.on!.keydown!(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(execute).toHaveBeenCalledOnce()
  })

  it('disables submit with an explanation instead of failing silently', () => {
    const { controller } = composer()
    controller.addAttachment({ name: 'a.png' })
    const parts = getComposerParts(controller.getSnapshot(), controller, {
      ids: createIdScope(),
    })

    expect(parts.submit.attrs.disabled).toBe(true)
    expect(parts.status.text).toContain('upload')
    expect(parts.textarea.attrs['aria-describedby']).toBe(parts.status.attrs.id)
  })

  it('reports a rejected submit as an alert', () => {
    const view = {
      text: 'x',
      attachments: [],
      context: [],
      composing: false,
      phase: 'rejected',
      draftRevision: 1,
      lastError: 'quota exceeded',
    } as ComposerViewState
    const parts = getComposerParts(view, composer().controller, {
      ids: createIdScope(),
    })
    expect(parts.status).toMatchObject({
      attrs: { role: 'alert' },
      text: 'quota exceeded',
    })
    expect(parts.textarea.attrs['aria-invalid']).toBe('true')
  })
})

describe('context picker (AI2-207, APG combobox)', () => {
  it('detects triggers only at word starts', () => {
    expect(detectTrigger('ask @rea', 8)).toEqual({
      trigger: '@',
      start: 4,
      query: 'rea',
    })
    expect(detectTrigger('mail me at a@b.c', 16)).toBeUndefined()
    expect(detectTrigger('/te', 3)).toEqual({
      trigger: '/',
      start: 0,
      query: 'te',
    })
    expect(detectTrigger('path /usr', 9)).toBeUndefined()
  })

  it('owns Enter and arrows while open and inserts a token', () => {
    const { controller } = composer()
    let caret = 0
    const picker = createContextPicker({
      composer: controller,
      caret: () => caret,
      items: () => [
        { id: 'readme', label: 'README.md', kind: 'file', trigger: '@' },
        { id: 'reducer', label: 'reducers.ts', kind: 'file', trigger: '@' },
      ],
    })

    controller.setText('look at @re')
    caret = 11
    picker.sync()
    expect(picker.menuOpen()).toBe(true)

    const down = syntheticEvent({ key: 'ArrowDown' })
    expect(picker.combobox.handleKey(down)).toBe(true)
    expect(
      controller.resolveKey({ key: 'Enter', menuOpen: picker.menuOpen() }),
    ).toBe('none')
    picker.combobox.handleKey(syntheticEvent({ key: 'Enter' }))

    expect(controller.getSnapshot().text).toBe('look at @reducers.ts ')
    expect(controller.getSnapshot().context).toEqual([
      { kind: 'file', id: 'reducer', label: 'reducers.ts' },
    ])
    expect(picker.menuOpen()).toBe(false)
  })

  it('exposes combobox semantics with an active descendant', () => {
    const box = createCombobox({
      items: () => [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
      onSelect: () => {},
    })
    box.open()
    box.handleKey(syntheticEvent({ key: 'ArrowDown' }))
    const parts = getComboboxParts(box.getSnapshot(), box, {
      ids: createIdScope(),
      label: 'Add context',
      emptyText: 'none',
    })

    expect(parts.input.attrs).toMatchObject({
      role: 'combobox',
      'aria-expanded': 'true',
      'aria-activedescendant': parts.options[1].attrs.id,
    })
    expect(parts.options[1].attrs['aria-selected']).toBe('true')
    expect(box.handleKey(syntheticEvent({ key: 'Escape' }))).toBe(true)
    expect(box.getSnapshot().open).toBe(false)
    // IME keys are never consumed.
    box.open()
    expect(
      box.handleKey(syntheticEvent({ key: 'Enter', isComposing: true })),
    ).toBe(false)
  })
})

describe('timeline parts (AI2-208, APG feed)', () => {
  it('marks the feed busy, numbers articles and moves by page keys', () => {
    const timeline = createTimelineController({
      initialItemIds: ['a', 'b', 'c'],
    })
    const onFocusItem = vi.fn()
    const parts = getTimelineParts(timeline.getSnapshot(), timeline, {
      ids: createIdScope(),
      label: 'Conversation',
      busy: true,
      announcement: 'Generating response',
      onFocusItem,
    })

    expect(parts.root.attrs).toMatchObject({
      role: 'feed',
      'aria-busy': 'true',
    })
    expect(parts.item('b', 1).attrs).toMatchObject({
      role: 'article',
      'aria-posinset': 2,
      'aria-setsize': 3,
    })
    parts.item('b', 1).on!.keydown!(syntheticEvent({ key: 'PageDown' }))
    expect(onFocusItem).toHaveBeenCalledWith('c')
    expect(parts.live.attrs['aria-live']).toBe('polite')
    expect(feedTarget(['a', 'b'], 'a', 'End')).toBe('b')
  })
})

describe('tree parts (APG treeview)', () => {
  const roots = buildFileTree([
    { path: 'src/a.ts', status: 'modified' },
    { path: 'src/lib/b.ts', status: 'added' },
    { path: 'README.md', status: 'modified' },
  ])

  it('builds directories and navigates with arrows', () => {
    expect(roots.map(node => node.id)).toEqual(['README.md', 'dir:src'])
    const tree = createTreeController()
    tree.focus('dir:src')
    tree.handleKey(roots, syntheticEvent({ key: 'ArrowRight' }))
    expect(tree.getSnapshot().expanded.has('dir:src')).toBe(true)
    tree.handleKey(roots, syntheticEvent({ key: 'ArrowRight' }))
    expect(tree.getSnapshot().focusedId).toBe('src/a.ts')
    tree.handleKey(roots, syntheticEvent({ key: 'ArrowLeft' }))
    expect(tree.getSnapshot().focusedId).toBe('dir:src')

    const parts = getTreeParts(roots, tree, {
      ids: createIdScope(),
      label: 'Files',
    })
    const src = parts.nodes.find(entry => entry.node.id === 'dir:src')!
    expect(src.props.attrs).toMatchObject({
      role: 'treeitem',
      'aria-expanded': 'true',
      'aria-level': 1,
      tabindex: 0,
    })
    expect(
      parts.nodes.filter(entry => entry.props.attrs.tabindex === 0),
    ).toHaveLength(1)
  })
})

describe('approval prompt parts (AI2-304)', () => {
  const view: ApprovalViewState = {
    approvalId: 'a1',
    approval: {
      id: 'a1',
      executionId: 'e1',
      title: 'Run shell',
      summary: 'Runs pnpm test',
      operation: {
        kind: 'shell',
        target: 'ws-1: pnpm test',
        preview: { env: { API_TOKEN: 'secret' } },
      },
      scope: 'once',
      risk: 'high',
      expiresAt: '2026-01-01T00:05:00.000Z',
      status: 'pending',
      revision: 1,
    },
    displayStatus: 'pending',
    local: 'idle',
    expired: false,
    canDecide: true,
  }

  it('shows action, target, scope, risk and expiry and redacts secrets', () => {
    const parts = getApprovalPromptParts(
      view,
      { approve: vi.fn(), reject: vi.fn() },
      { ids: createIdScope() },
    )
    expect(parts.details.map(detail => detail.key)).toEqual([
      'operation',
      'target',
      'scope',
      'risk',
      'expires',
      'preview',
    ])
    expect(parts.details.find(detail => detail.key === 'scope')?.value).toBe(
      'This one time only',
    )
    expect(
      parts.details.find(detail => detail.key === 'preview')?.value,
    ).not.toContain('secret')
    expect(parts.root.attrs).toMatchObject({
      role: 'alertdialog',
      'aria-modal': 'true',
    })
  })

  it('waits for a confirmation phrase and treats Escape as dismiss, not reject', async () => {
    const reject = vi.fn(async () => ({
      accepted: true as const,
      commandId: '',
      operationId: '',
    }))
    const onDismiss = vi.fn()
    const parts = getApprovalPromptParts(
      view,
      { approve: vi.fn(), reject },
      {
        ids: createIdScope(),
        confirmationPhrase: 'run it',
        confirmationInput: 'run',
        onDismiss,
      },
    )

    expect(parts.approve.attrs.disabled).toBe(true)
    parts.root.on!.keydown!(syntheticEvent({ key: 'Escape' }))
    expect(onDismiss).toHaveBeenCalled()
    expect(reject).not.toHaveBeenCalled()
  })

  it('redacts secret-looking keys and tokens', () => {
    const { text } = redactPreview({
      password: 'p',
      nested: { authorization: 'Bearer x' },
      key: 'sk-abcdefghijklmnop',
      ok: 1,
    })
    expect(text).not.toMatch(/Bearer|sk-abc|"p"/)
    expect(text).toContain('"ok": 1')
  })
})

describe('run switcher parts (AI2-306, APG tabs)', () => {
  it('uses roving tabindex and arrow navigation', () => {
    const select = vi.fn()
    const parts = getRunSwitcherParts(
      {
        runs: [
          {
            executionId: 'e1',
            status: 'running',
            unread: 0,
            pendingApprovals: 0,
          },
          {
            executionId: 'e2',
            status: 'awaiting-approval',
            unread: 2,
            pendingApprovals: 1,
          },
        ],
        selectedExecutionId: 'e1',
        pendingApprovalTotal: 1,
      },
      { select },
      { ids: createIdScope(), title: id => id },
    )

    expect(parts.tabs.map(tab => tab.props.attrs.tabindex)).toEqual([0, -1])
    expect(parts.tabs[1].props.attrs['aria-label']).toContain(
      'awaiting approval',
    )
    parts.tabs[0].props.on!.keydown!(syntheticEvent({ key: 'ArrowRight' }))
    expect(select).toHaveBeenCalledWith('e2')
  })
})

describe('diff rows (AI2-403)', () => {
  const diff = {
    path: 'a.ts',
    binary: false,
    truncated: false,
    hunks: [
      {
        id: 'h1',
        header: '@@ -1,2 +1,2 @@',
        oldStart: 1,
        oldLines: 2,
        newStart: 1,
        newLines: 2,
        lines: [
          { kind: 'delete' as const, text: 'a', oldLine: 1 },
          { kind: 'add' as const, text: 'b', newLine: 1 },
          { kind: 'context' as const, text: 'c', oldLine: 2, newLine: 2 },
        ],
      },
    ],
  }

  it('lays out unified and split rows with stable anchors', () => {
    expect(diffRows(diff, 'unified').map(row => row.id)).toEqual([
      'h1-h',
      'h1-0',
      'h1-1',
      'h1-2',
    ])
    const split = diffRows(diff, 'split')
    expect(split[1].cells.map(cell => cell.text)).toEqual(['a', 'b'])
    expect(adjacentHunk(diff.hunks, undefined, 1)).toBe('h1')
  })
})

describe('extensions (AI2-512)', () => {
  it('feeds final recognized speech into the draft without sending', () => {
    const { controller, execute } = composer()
    controller.setText('Summarize')
    let handlers!: Parameters<
      NonNullable<Parameters<typeof createVoiceInput>[0]['recognizer']>['start']
    >[0]
    const voice = createVoiceInput({
      composer: controller,
      recognizer: { start: h => (handlers = h), stop: () => handlers.onEnd() },
    })

    voice.toggle()
    handlers.onText('the diff', false)
    expect(voice.getSnapshot()).toMatchObject({
      state: 'listening',
      interim: 'the diff',
    })
    handlers.onText('the diff', true)
    voice.toggle()

    expect(controller.getSnapshot().text).toBe('Summarize the diff')
    expect(voice.getSnapshot().state).toBe('idle')
    expect(execute).not.toHaveBeenCalled()
  })

  it('reports voice as unavailable without a recognizer', () => {
    expect(
      createVoiceInput({ composer: composer().controller }).getSnapshot().state,
    ).toBe('unavailable')
  })

  it('formats usage and orders the run board by attention', () => {
    expect(
      formatUsage({
        inputTokens: 1200,
        outputTokens: 30,
        cost: { amount: 0.5, currency: 'USD' },
      }),
    ).toBe('1,200 in · 30 out · $0.50')
    expect(
      groupRunsForBoard([
        {
          executionId: 'a',
          status: 'completed',
          unread: 0,
          pendingApprovals: 0,
        },
        {
          executionId: 'b',
          status: 'awaiting-approval',
          unread: 0,
          pendingApprovals: 1,
        },
      ]).map(column => column.status),
    ).toEqual(['awaiting-approval', 'completed'])
  })
})
