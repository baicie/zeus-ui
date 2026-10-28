/**
 * Default views for every primitive, built from the parts. Adapters call
 * these with live view models and render the result; the structure, roles
 * and handlers are therefore identical across React, Vue and Web
 * Components. Slots mark the places where each framework renders native
 * content (`message`, `step`, `content-block`, `toolbar`, …).
 */

import type {
  ApprovalController,
  ApprovalViewState,
  ArtifactPreviewState,
  ChangeSetActionsController,
  ChangeSetActionsViewState,
  ComposerController,
  ComposerViewState,
  EntityId,
  ExecutionController,
  ExecutionStep,
  ExecutionViewState,
  FileDiff,
  ReviewController,
  ReviewViewState,
  RunSwitcherController,
  RunSwitcherViewState,
  StepNode,
  TestReportController,
  TestReportViewState,
  TimelineController,
  TimelineViewState,
  ToolInvocation,
  WorkspaceController,
  WorkspaceViewState,
} from '@zeus-web/ai-core'
import type { DiffLayout } from './coding'
import type {
  ComboboxController,
  ComboboxItem,
  ComboboxViewState,
} from './combobox'
import type { ContentBlock } from './content'
import type { MessageParts } from './conversation'
import type { AiLocale } from './locale'
import type { MdBlock, MdInline } from './markdown'
import type { IdScope, PartEvent, PartProps } from './parts'
import type { TreeController, TreeNode } from './tree'
import type { ViewNode } from './view'

import {
  getApprovalPromptParts,
  getExecutionStatusParts,
  getRunSwitcherParts,
  getStepStatusParts,
  getToolInvocationParts,
} from './agent'
import {
  buildFileTree,
  getChangeSetActionsParts,
  getDiffViewerParts,
  getHunkReviewParts,
  getTestReportParts,
  getWorkspacePickerParts,
} from './coding'
import { getComboboxParts } from './combobox'
import { getAttachmentTrayParts, getComposerParts } from './composer'
import { describeCode } from './content'
import { getArtifactPreviewParts, getTimelineParts } from './conversation'
import { EN_LOCALE } from './locale'
import { part } from './parts'
import { getTreeParts } from './tree'
import { el, slot, text } from './view'

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

export interface ComposerViewOptions {
  ids: IdScope
  locale?: AiLocale
  label?: string
  menu?: {
    view: Readonly<ComboboxViewState<ComboboxItem>>
    controller: Pick<
      ComboboxController<ComboboxItem>,
      'selectIndex' | 'handleKey'
    >
  }
  disabled?: boolean
  /** Runs after each input and caret change (e.g. to sync a context picker). */
  afterInput?: (event: PartEvent) => void
}

export function composerView(
  view: Readonly<ComposerViewState>,
  controller: Pick<
    ComposerController,
    'setText' | 'setComposing' | 'resolveKey' | 'submit' | 'removeAttachment'
  >,
  options: ComposerViewOptions,
): ViewNode {
  const locale = options.locale ?? EN_LOCALE
  const menu = options.menu
  const parts = getComposerParts(view, controller, {
    ids: options.ids,
    locale,
    label: options.label,
    disabled: options.disabled,
    menuOpen: () => menu?.view.open === true,
    onMenuKey: event => menu?.controller.handleKey(event) === true,
  })
  const tray = getAttachmentTrayParts(view.attachments, controller, {
    ids: options.ids,
    locale,
  })
  const combobox = menu
    ? getComboboxParts(menu.view, menu.controller, {
        ids: options.ids,
        label: locale.contextPickerLabel,
        emptyText: locale.noSuggestions,
      })
    : undefined

  const afterInput = options.afterInput
  const textareaOn = afterInput
    ? {
        ...parts.textarea.on,
        input: (event: PartEvent) => {
          parts.textarea.on?.input?.(event)
          afterInput(event)
        },
      }
    : parts.textarea.on

  // A <textarea> may not take role="combobox" (ARIA in HTML). It stays a
  // multi-line textbox that owns a popup listbox, as mention pickers do:
  // aria-haspopup / aria-controls / aria-autocomplete / aria-activedescendant.
  const textareaAttrs = combobox
    ? {
        ...parts.textarea.attrs,
        'aria-haspopup': 'listbox',
        'aria-autocomplete': combobox.input.attrs['aria-autocomplete'],
        'aria-controls': combobox.input.attrs['aria-controls'],
        'aria-activedescendant': combobox.input.attrs['aria-activedescendant'],
      }
    : parts.textarea.attrs

  return el(
    'div',
    { ...parts.root, attrs: { ...parts.root.attrs, 'data-zw-ai': 'composer' } },
    [
      view.attachments.length > 0 &&
        el(
          'ul',
          tray.root,
          tray.items.map((item, index) =>
            el(
              'li',
              item.item,
              [
                el('span', item.name),
                item.progress && el('span', item.progress),
                el('button', item.remove),
              ],
              view.attachments[index].id,
            ),
          ),
        ),
      el('textarea', {
        ...parts.textarea,
        attrs: textareaAttrs,
        on: textareaOn,
      }),
      combobox &&
        el('ul', combobox.listbox, [
          ...combobox.options.map((option, index) =>
            el('li', option, undefined, `option-${index}`),
          ),
          combobox.empty && el('li', combobox.empty),
        ]),
      el('div', part({ 'data-part': 'toolbar' }), [
        slot('toolbar'),
        el('button', parts.submit),
      ]),
      el('div', parts.status),
    ],
  )
}

// ---------------------------------------------------------------------------
// Message content
// ---------------------------------------------------------------------------

export interface ContentViewOptions {
  /** Load remote Markdown images. Default false (no data exfiltration). */
  allowRemoteImages?: boolean
  copy?: (text: string) => void
  locale?: AiLocale
}

function inlineView(
  nodes: readonly MdInline[],
  options: ContentViewOptions,
): ViewNode[] {
  return nodes.map(node => {
    switch (node.type) {
      case 'text':
        return text(node.text)
      case 'break':
        return el('br')
      case 'code':
        return el('code', part({}, undefined, node.text))
      case 'strong':
        return el('strong', undefined, inlineView(node.children, options))
      case 'emphasis':
        return el('em', undefined, inlineView(node.children, options))
      case 'link': {
        const external = !node.href.startsWith('#')
        return el(
          'a',
          part({
            href: node.href,
            title: node.title,
            target: external ? '_blank' : undefined,
            rel: external ? 'noopener noreferrer nofollow' : undefined,
          }),
          inlineView(node.children, options),
        )
      }
      case 'image':
        return options.allowRemoteImages
          ? el(
              'img',
              part({
                src: node.src,
                alt: node.alt,
                loading: 'lazy',
                referrerpolicy: 'no-referrer',
              }),
            )
          : el(
              'a',
              part({
                href: node.src,
                target: '_blank',
                rel: 'noopener noreferrer nofollow',
              }),
              [text(node.alt ? `[${node.alt}]` : '[image]')],
            )
    }
    // Exhaustive above; satisfies array-callback-return.
    return text('')
  })
}

export function codeBlockView(
  code: string,
  lang: string | undefined,
  closed: boolean,
  options: ContentViewOptions,
): ViewNode {
  const model = describeCode(code, lang, closed)
  const locale = options.locale ?? EN_LOCALE
  return el(
    'figure',
    part({
      'data-part': 'code',
      'data-language': model.language,
      'aria-busy': model.streaming ? 'true' : undefined,
    }),
    [
      el('figcaption', part({}), [
        model.language ? text(model.language) : undefined,
        options.copy &&
          el(
            'button',
            part(
              { type: 'button', 'aria-label': locale.copy },
              { click: () => options.copy?.(model.copyText) },
              locale.copy,
            ),
          ),
      ]),
      el('pre', part({ tabindex: 0 }), [
        el('code', part({}, undefined, model.copyText)),
      ]),
    ],
  )
}

export function markdownView(
  blocks: readonly MdBlock[],
  options: ContentViewOptions,
): ViewNode[] {
  return blocks.map((block, index) => {
    const key = `b${index}`
    switch (block.type) {
      case 'paragraph':
        return el('p', undefined, inlineView(block.children, options), key)
      case 'heading':
        return el(
          `h${block.level}`,
          undefined,
          inlineView(block.children, options),
          key,
        )
      case 'code':
        return {
          ...codeBlockView(block.text, block.lang, block.closed, options),
          key,
        } as ViewNode
      case 'blockquote':
        return el(
          'blockquote',
          undefined,
          markdownView(block.children, options),
          key,
        )
      case 'hr':
        return el('hr', undefined, undefined, key)
      case 'list':
        return el(
          block.ordered ? 'ol' : 'ul',
          block.ordered && block.start !== undefined && block.start !== 1
            ? part({ start: block.start })
            : undefined,
          block.items.map((item, itemIndex) =>
            el('li', undefined, markdownView(item, options), `i${itemIndex}`),
          ),
          key,
        )
    }
    // Exhaustive above; satisfies array-callback-return.
    return text('')
  })
}

/** Default rendering of one content block; adapters may replace it via the `content-block` slot. */
export function contentBlockView(
  block: ContentBlock,
  options: ContentViewOptions,
): ViewNode {
  switch (block.kind) {
    case 'markdown':
      return el(
        'div',
        part({ 'data-part': 'markdown' }),
        markdownView(block.blocks, options),
        block.partId,
      )
    case 'text':
      return el(
        'p',
        part({ 'data-part': 'text' }, undefined, block.text),
        undefined,
        block.partId,
      )
    case 'json':
      return codeBlockView(block.text, 'json', true, options)
    case 'image':
      // Assets are authorized by the host; the adapter's slot loads them.
      return slot('asset-image', block, block.partId, [
        el(
          'span',
          part(
            { role: 'img', 'aria-label': block.alt || block.asset.mimeType },
            undefined,
            block.alt || block.asset.mimeType,
          ),
        ),
      ])
    case 'file':
      return el(
        'span',
        part(
          { 'data-part': 'file', 'data-mime': block.asset.mimeType },
          undefined,
          block.name,
        ),
        undefined,
        block.partId,
      )
    case 'reference':
      return el(
        'cite',
        part({ 'data-source-id': block.sourceId }, undefined, block.label),
        undefined,
        block.partId,
      )
    case 'artifact':
      return el(
        'span',
        part(
          { 'data-artifact-id': block.artifactId },
          undefined,
          block.artifactId,
        ),
        undefined,
        block.partId,
      )
  }
}

export function messageContentView(
  blocks: readonly ContentBlock[],
  options: ContentViewOptions,
): ViewNode {
  return el(
    'div',
    part({ 'data-part': 'content' }),
    blocks.map(block =>
      slot('content-block', block, block.partId, [
        contentBlockView(block, options),
      ]),
    ),
  )
}

// ---------------------------------------------------------------------------
// Message + timeline
// ---------------------------------------------------------------------------

export function messageView(
  parts: MessageParts,
  content: ViewNode,
  options: { liveText?: string } = {},
): ViewNode {
  void options
  return el(
    'div',
    { ...parts.root, attrs: { ...parts.root.attrs, 'data-zw-ai': 'message' } },
    [
      el('header', part({}), [el('span', parts.author)]),
      content,
      el('footer', part({ 'data-part': 'actions' }), [
        parts.branch &&
          el('span', part({ 'data-part': 'branch' }), [
            el('button', parts.branch.previous),
            el('span', parts.branch.position),
            el('button', parts.branch.next),
          ]),
        el('button', parts.copy),
        parts.edit && el('button', parts.edit),
        parts.regenerate && el('button', parts.regenerate),
        slot('message-actions'),
      ]),
    ],
  )
}

export function timelineView(
  view: Readonly<TimelineViewState>,
  controller: Pick<TimelineController, 'jumpToLatest'> &
    Partial<Pick<TimelineController, 'pin'>>,
  options: {
    ids: IdScope
    label: string
    busy: boolean
    announcement: string
    onFocusItem?: (messageId: EntityId) => void
    locale?: AiLocale
  },
): ViewNode {
  const parts = getTimelineParts(view, controller, {
    ...options,
    onItemFocus: id => controller.pin?.(id),
  })
  const item = (id: EntityId, index: number): ViewNode =>
    el(
      'article',
      parts.item(id, index),
      [slot('message', { messageId: id }, id)],
      id,
    )
  const items: ViewNode[] = view.range
    ? view.range.segments.flatMap((segment, index) =>
        segment.kind === 'pad'
          ? [
              el(
                'div',
                part({
                  'aria-hidden': 'true',
                  'data-part': 'spacer',
                  style: `height:${Math.round(segment.height)}px`,
                }),
                undefined,
                `pad-${index}`,
              ),
            ]
          : view.itemIds
              .slice(segment.start, segment.end)
              .map((id, offset) => item(id, segment.start + offset)),
      )
    : view.itemIds.map((id, index) => item(id, index))

  return el('div', part({ 'data-zw-ai': 'timeline' }), [
    el(
      'div',
      {
        ...parts.root,
        attrs: { ...parts.root.attrs, 'data-part': 'scroller' },
      },
      items,
    ),
    parts.jumpToLatest && el('button', parts.jumpToLatest),
    el('div', {
      ...parts.live,
      attrs: {
        ...parts.live.attrs,
        'data-part': 'live',
        style:
          'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)',
      },
    }),
  ])
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export function executionStatusView(
  view: Readonly<ExecutionViewState>,
  controller: Pick<ExecutionController, 'request'>,
  options: { locale?: AiLocale } = {},
): ViewNode {
  const parts = getExecutionStatusParts(view, controller, options)
  return el(
    'div',
    {
      ...parts.root,
      attrs: { ...parts.root.attrs, 'data-zw-ai': 'execution-status' },
    },
    [
      el('span', parts.badge),
      ...parts.actions.map(entry =>
        el('button', entry.props, undefined, entry.action),
      ),
      parts.error && el('span', parts.error),
    ],
  )
}

export function stepTreeView(
  roots: readonly TreeNode[],
  tree: TreeController,
  options: { ids: IdScope; label: string },
): ViewNode {
  const parts = getTreeParts(roots, tree, options)
  return el(
    'ul',
    {
      ...parts.root,
      attrs: { ...parts.root.attrs, 'data-zw-ai': 'step-list' },
    },
    parts.nodes.map(({ node, props }) =>
      el(
        'li',
        props,
        [
          slot('step', { stepId: node.id, level: node.level }, node.id, [
            text(node.label),
          ]),
        ],
        node.id,
      ),
    ),
  )
}

export function stepRowView(
  step: ExecutionStep,
  options: { locale?: AiLocale } = {},
): ViewNode {
  const parts = getStepStatusParts(step, options)
  return el('span', part({ 'data-part': 'step' }), [
    el('span', parts.label),
    text(' '),
    el('span', parts.status),
  ])
}

export function toolInvocationView(
  tool: ToolInvocation,
  expanded: boolean,
  onToggle: () => void,
  options: { ids: IdScope; locale?: AiLocale },
): ViewNode {
  const parts = getToolInvocationParts(tool, expanded, onToggle, options)
  return el(
    'div',
    { ...parts.root, attrs: { ...parts.root.attrs, 'data-zw-ai': 'tool' } },
    [
      el('span', parts.summary),
      text(' '),
      el('span', parts.status),
      el('button', parts.toggle),
      el('div', parts.details, [
        expanded && el('pre', part({}, undefined, parts.preview)),
      ]),
    ],
  )
}

/** Render a step node with its tool, used as the default `step` slot. */
export function stepWithToolView(
  node: StepNode | undefined,
  toolExpanded: boolean,
  onToggleTool: () => void,
  options: { ids: IdScope; locale?: AiLocale },
): ViewNode {
  if (!node) return text('')
  return el('div', part({}), [
    stepRowView(node.step, options),
    node.tool &&
      toolInvocationView(node.tool, toolExpanded, onToggleTool, options),
  ])
}

export function approvalPromptView(
  view: Readonly<ApprovalViewState>,
  controller: Pick<ApprovalController, 'approve' | 'reject'>,
  options: Parameters<typeof getApprovalPromptParts>[2],
): ViewNode {
  const parts = getApprovalPromptParts(view, controller, options)
  return el(
    'section',
    { ...parts.root, attrs: { ...parts.root.attrs, 'data-zw-ai': 'approval' } },
    [
      el('h2', parts.title),
      el('p', parts.summary),
      el(
        'dl',
        part({}),
        parts.details.flatMap(detail => [
          el(
            'dt',
            part({}, undefined, detail.label),
            undefined,
            `${detail.key}-t`,
          ),
          el(
            'dd',
            part({ 'data-detail': detail.key }, undefined, detail.value),
            undefined,
            `${detail.key}-d`,
          ),
        ]),
      ),
      el('p', parts.status),
      parts.confirmation &&
        el('div', part({ 'data-part': 'confirmation' }), [
          el('label', parts.confirmation.label),
          el('input', parts.confirmation.input),
        ]),
      parts.error && el('p', parts.error),
      el('div', part({ 'data-part': 'actions' }), [
        el('button', parts.reject),
        el('button', parts.approve),
      ]),
    ],
  )
}

export function runSwitcherView(
  view: Readonly<RunSwitcherViewState>,
  controller: Pick<RunSwitcherController, 'select'>,
  options: Parameters<typeof getRunSwitcherParts>[2],
): ViewNode {
  const parts = getRunSwitcherParts(view, controller, options)
  return el(
    'div',
    {
      ...parts.root,
      attrs: { ...parts.root.attrs, 'data-zw-ai': 'run-switcher' },
    },
    parts.tabs.map(tab =>
      el(
        'button',
        tab.props,
        [el('span', tab.notes), tab.badge && el('span', tab.badge)],
        tab.executionId,
      ),
    ),
  )
}

// ---------------------------------------------------------------------------
// Coding
// ---------------------------------------------------------------------------

export function workspacePickerView(
  view: Readonly<WorkspaceViewState>,
  controller: Pick<WorkspaceController, 'select'>,
  options: { ids: IdScope; locale?: AiLocale },
): ViewNode {
  const parts = getWorkspacePickerParts(view, controller, options)
  return el(
    'ul',
    {
      ...parts.root,
      attrs: { ...parts.root.attrs, 'data-zw-ai': 'workspace-picker' },
    },
    parts.options.map((option, index) =>
      el('li', option, undefined, view.workspaces[index].id),
    ),
  )
}

export function fileTreeView(
  review: Readonly<ReviewViewState>,
  tree: TreeController,
  options: { ids: IdScope; locale?: AiLocale },
): ViewNode {
  const locale = options.locale ?? EN_LOCALE
  const roots = buildFileTree(review.changeSet?.files ?? [])
  const parts = getTreeParts(roots, tree, {
    ids: options.ids,
    label: locale.fileTreeLabel,
  })
  const files = new Map(
    (review.changeSet?.files ?? []).map(file => [file.path, file]),
  )

  return el(
    'ul',
    {
      ...parts.root,
      attrs: { ...parts.root.attrs, 'data-zw-ai': 'file-tree' },
    },
    parts.nodes.map(({ node, props }) => {
      const file = files.get(node.id)
      return el(
        'li',
        {
          ...props,
          attrs: {
            ...props.attrs,
            'aria-current':
              node.id === review.selectedPath ? 'true' : undefined,
            'data-status': file?.status,
          },
        },
        [
          text(node.label),
          file?.stats &&
            el(
              'span',
              part(
                { 'aria-hidden': 'true' },
                undefined,
                ` +${file.stats.additions} −${file.stats.deletions}`,
              ),
            ),
        ],
        node.id,
      )
    }),
  )
}

export function diffView(
  diff: FileDiff,
  layout: DiffLayout,
  review: Pick<ReviewController, 'selectHunk' | 'markReviewed'> & {
    getSnapshot: () => Pick<
      ReviewViewState,
      'selectedHunkId' | 'reviewed' | 'comments'
    >
  },
  options: {
    ids: IdScope
    locale?: AiLocale
    onFocusRow?: (rowId: string) => void
  },
): ViewNode {
  const parts = getDiffViewerParts(diff, layout, review, options)
  const locale = options.locale ?? EN_LOCALE
  // Comments whose hunk is gone after a new revision have no row to sit on;
  // list them so they never silently disappear.
  const hunkIds = new Set(diff.hunks.map(hunk => hunk.id))
  const comments = review.getSnapshot().comments
  const orphaned = comments.filter(
    comment => comment.path === diff.path && !hunkIds.has(comment.hunkId),
  )
  const reviewed = review.getSnapshot().reviewed

  return el(
    'div',
    { ...parts.root, attrs: { ...parts.root.attrs, 'data-zw-ai': 'diff' } },
    [
      el(
        'div',
        part({ role: 'table', 'aria-label': diff.path }),
        parts.rows.map(({ row, props }) =>
          row.type === 'hunk'
            ? el(
                'div',
                // A row may only own cells: the header text, the review
                // checkbox and the comment area each get one.
                { attrs: { ...props.attrs, role: 'row' }, on: props.on },
                [
                  el(
                    'span',
                    part(
                      { role: 'rowheader', 'data-part': 'hunk-header' },
                      undefined,
                      row.header,
                    ),
                  ),
                  el('span', part({ role: 'cell' }), [
                    el(
                      'input',
                      getHunkReviewParts(
                        row.hunkId,
                        Boolean(reviewed[row.hunkId]),
                        review,
                        options,
                      ).checkbox,
                    ),
                  ]),
                  el('span', part({ role: 'cell' }), [
                    slot('hunk-actions', { hunkId: row.hunkId }),
                  ]),
                ],
                row.id,
              )
            : el(
                'div',
                {
                  ...props,
                  attrs: {
                    ...props.attrs,
                    role: 'row',
                    'data-kind': row.cells.map(cell => cell.kind).join(' '),
                  },
                },
                // Unified rows: two line numbers, the text once. Split rows:
                // number + text per side.
                (layout === 'unified'
                  ? [
                      { ...row.cells[0], text: undefined },
                      { ...row.cells[1], text: row.cells[0].text },
                    ]
                  : row.cells
                ).flatMap((cell, index) => [
                  el(
                    'span',
                    part(
                      {
                        role: 'cell',
                        'data-part': 'line-number',
                        'aria-hidden': 'true',
                      },
                      undefined,
                      cell.number === undefined ? '' : String(cell.number),
                    ),
                    undefined,
                    `n${index}`,
                  ),
                  cell.text !== undefined &&
                    el(
                      'span',
                      part(
                        { role: 'cell', 'data-kind': cell.kind },
                        undefined,
                        cell.text,
                      ),
                      undefined,
                      `t${index}`,
                    ),
                ]),
                row.id,
              ),
        ),
      ),
      parts.truncated && el('p', parts.truncated),
      orphaned.length > 0 &&
        el(
          'section',
          part({
            'data-part': 'outdated-comments',
            'aria-label': locale.commentOutdated,
          }),
          orphaned.map(comment =>
            el(
              'p',
              part({ 'data-outdated': '', 'data-status': comment.status }),
              [
                el(
                  'span',
                  part({ role: 'note' }, undefined, locale.commentOutdated),
                ),
                text(` ${comment.body}`),
              ],
              comment.id,
            ),
          ),
        ),
    ],
  )
}

export function testReportView(
  view: Readonly<TestReportViewState>,
  controller: Pick<TestReportController, 'toggle'>,
  options: { ids: IdScope; locale?: AiLocale },
): ViewNode {
  const parts = getTestReportParts(view, controller, options)
  return el('section', part({ 'data-zw-ai': 'test-report' }), [
    el('p', parts.summary),
    el(
      'ul',
      part({ role: 'list' }),
      parts.cases.map(entry =>
        el(
          'li',
          entry.row,
          [
            entry.location && el('code', entry.location),
            entry.toggle && el('button', entry.toggle),
            entry.output && el('pre', entry.output),
          ],
          entry.caseId,
        ),
      ),
    ),
  ])
}

export function changeSetActionsView(
  view: Readonly<ChangeSetActionsViewState>,
  controller: Pick<ChangeSetActionsController, 'request'>,
  options: { locale?: AiLocale } = {},
): ViewNode {
  const parts = getChangeSetActionsParts(view, controller, options)
  return el('div', part({ 'data-zw-ai': 'changeset-actions' }), [
    el('span', parts.status),
    ...parts.actions.map(entry =>
      el('button', entry.props, undefined, entry.action),
    ),
    parts.error && el('span', parts.error),
  ])
}

export function artifactPreviewView(
  preview: ArtifactPreviewState | undefined,
  options: ContentViewOptions = {},
): ViewNode {
  const parts = getArtifactPreviewParts(preview, options)
  return el(
    'section',
    {
      ...parts.root,
      attrs: { ...parts.root.attrs, 'data-zw-ai': 'artifact-preview' },
    },
    [
      parts.message && el('p', parts.message),
      preview?.status === 'ready' && preview.kind === 'text'
        ? el('pre', part({ tabindex: 0 }, undefined, preview.text ?? ''))
        : preview?.status === 'ready'
          ? slot('artifact-binary', preview)
          : undefined,
    ],
  )
}

/** Utility for adapters: wrap a part with extra attributes. */
export function withAttrs(
  props: PartProps,
  attrs: Record<string, string | number | boolean | undefined>,
): PartProps {
  return { ...props, attrs: { ...props.attrs, ...attrs } }
}

// ---------------------------------------------------------------------------
// Hunk comments (AiHunkReview)
// ---------------------------------------------------------------------------

export interface HunkCommentsViewOptions {
  ids: IdScope
  locale?: AiLocale
  draft: string
  onDraft: (value: string) => void
  onAdd: () => void
  onSubmit: (commentId: string) => void
}

export function hunkCommentsView(
  comments: ReviewViewState['comments'],
  hunkId: string,
  options: HunkCommentsViewOptions,
): ViewNode {
  const locale = options.locale ?? EN_LOCALE
  const inputId = options.ids.id(`comment-${hunkId}`)
  const own = comments.filter(comment => comment.hunkId === hunkId)

  return el(
    'div',
    part({ 'data-part': 'hunk-comments', 'data-hunk-id': hunkId }),
    [
      el(
        'ul',
        part({ role: 'list' }),
        own.map(comment =>
          el(
            'li',
            part({
              'data-status': comment.status,
              'data-outdated': comment.outdated ? '' : undefined,
            }),
            [
              text(comment.body),
              comment.outdated &&
                el(
                  'p',
                  part({ role: 'note' }, undefined, locale.commentOutdated),
                ),
              comment.status === 'draft' &&
                !comment.outdated &&
                el(
                  'button',
                  part(
                    { type: 'button' },
                    { click: () => options.onSubmit(comment.id) },
                    'Submit',
                  ),
                ),
              comment.error &&
                el('p', part({ role: 'alert' }, undefined, comment.error)),
            ],
            comment.id,
          ),
        ),
      ),
      el('label', part({ for: inputId }, undefined, locale.addComment)),
      el(
        'textarea',
        part(
          { id: inputId, value: options.draft },
          { input: event => options.onDraft(event.value ?? '') },
        ),
      ),
      el(
        'button',
        part(
          { type: 'button', disabled: options.draft.trim() === '' },
          { click: () => options.onAdd() },
          locale.addComment,
        ),
      ),
    ],
  )
}
