/**
 * Agent surface parts: `AiExecutionStatus`, `AiStepList`, `AiPlanOutline`,
 * `AiToolInvocation`, `AiApprovalPrompt`, `AiRunSwitcher`
 * (AI2-304 – AI2-306).
 *
 * Status is always encoded as text *and* `data-status` (never colour only).
 * The approval prompt shows what will be done, to which target, the scope,
 * the risk and the expiry before any button; approve stays disabled until a
 * host-required confirmation phrase is typed. Tool inputs are shown only as
 * a redacted, size-limited preview.
 */

import type {
  ApprovalController,
  ApprovalViewState,
  EntityId,
  ExecutionAction,
  ExecutionController,
  ExecutionStep,
  ExecutionViewState,
  RunSwitcherController,
  RunSwitcherViewState,
  StepNode,
  ToolInvocation,
} from '@zeus-web/ai-core'
import type { AiLocale } from './locale'
import type { IdScope, PartProps } from './parts'
import type { TreeNode } from './tree'

import { formatJson } from './content'
import { navigateIndex } from './keyboard'
import { EN_LOCALE } from './locale'
import { ariaBool, part } from './parts'

// ---------------------------------------------------------------------------
// Execution status
// ---------------------------------------------------------------------------

export function getExecutionStatusParts(
  view: Readonly<ExecutionViewState>,
  controller: Pick<ExecutionController, 'request'>,
  options: { locale?: AiLocale } = {},
): {
  root: PartProps
  badge: PartProps
  actions: { action: ExecutionAction; props: PartProps }[]
  error?: PartProps
} {
  const locale = options.locale ?? EN_LOCALE
  const label = view.pendingAction
    ? locale.executionPending[view.pendingAction]
    : view.status
      ? locale.executionStatus[view.status]
      : ''

  return {
    root: part({
      role: 'status',
      'data-status': view.status,
      'data-pending': view.pendingAction,
    }),
    badge: part({ 'data-status': view.status }, undefined, label),
    actions: view.availableActions.map(action => ({
      action,
      props: part(
        { type: 'button', 'data-action': action },
        { click: () => void controller.request(action).catch(() => {}) },
        locale.executionAction[action],
      ),
    })),
    error: view.lastError
      ? part({ role: 'alert' }, undefined, view.lastError)
      : undefined,
  }
}

// ---------------------------------------------------------------------------
// Steps / plan
// ---------------------------------------------------------------------------

/** Step tree → tree nodes. `kinds` limits it, e.g. to plan steps. */
export function stepTreeNodes(
  nodes: readonly StepNode[],
  kinds?: readonly ExecutionStep['kind'][],
): TreeNode[] {
  return nodes
    .filter(node => !kinds || kinds.includes(node.step.kind))
    .map(node => ({
      id: node.step.id,
      label: node.step.label,
      children: stepTreeNodes(node.children, kinds),
    }))
}

export function getStepStatusParts(
  step: ExecutionStep,
  options: { locale?: AiLocale } = {},
): { label: PartProps; status: PartProps } {
  const locale = options.locale ?? EN_LOCALE
  return {
    label: part({ 'data-kind': step.kind }, undefined, step.label),
    status: part(
      { 'data-status': step.status },
      undefined,
      locale.stepStatus[step.status],
    ),
  }
}

// ---------------------------------------------------------------------------
// Tool invocation
// ---------------------------------------------------------------------------

const SECRET_KEY =
  /pass(?:word)?|secret|token|api[-_]?key|authorization|cookie|credential|private[-_]?key/i

/**
 * Defence in depth for tool previews: the host already redacts, but the UI
 * still masks secret-looking keys, bounds depth and length, and never
 * renders the value as markup.
 */
export function redactPreview(
  value: unknown,
  options: { maxChars?: number; maxDepth?: number } = {},
): { text: string; truncated: boolean } {
  const maxDepth = options.maxDepth ?? 6

  function walk(entry: unknown, depth: number): unknown {
    if (depth > maxDepth) return '…'
    if (Array.isArray(entry))
      return entry.slice(0, 100).map(item => walk(item, depth + 1))
    if (entry && typeof entry === 'object') {
      const result: Record<string, unknown> = {}
      for (const [key, inner] of Object.entries(entry)) {
        result[key] = SECRET_KEY.test(key) ? '••••••' : walk(inner, depth + 1)
      }
      return result
    }
    if (
      typeof entry === 'string' &&
      /^(?:sk|ghp|xox[bp])[-_][\w-]{10,}$/.test(entry)
    ) {
      return '••••••'
    }
    return entry
  }

  return formatJson(walk(value, 0), options.maxChars ?? 4000)
}

export function getToolInvocationParts(
  tool: ToolInvocation,
  expanded: boolean,
  onToggle: () => void,
  options: { ids: IdScope; locale?: AiLocale },
): {
  root: PartProps
  summary: PartProps
  status: PartProps
  toggle: PartProps
  details: PartProps
  preview: string
} {
  const locale = options.locale ?? EN_LOCALE
  const detailsId = options.ids.id(`tool-${tool.id}`)

  return {
    root: part({ 'data-status': tool.status, 'data-tool': tool.toolName }),
    summary: part({}, undefined, `${tool.toolName}: ${tool.summary}`),
    status: part(
      { 'data-status': tool.status },
      undefined,
      locale.toolStatus[tool.status],
    ),
    toggle: part(
      {
        type: 'button',
        'aria-expanded': ariaBool(expanded),
        'aria-controls': detailsId,
      },
      { click: onToggle },
      expanded ? locale.hideDetails : locale.showDetails,
    ),
    details: part({ id: detailsId, hidden: !expanded }),
    preview:
      expanded && tool.inputPreview !== undefined
        ? redactPreview(tool.inputPreview).text
        : '',
  }
}

// ---------------------------------------------------------------------------
// Approval prompt
// ---------------------------------------------------------------------------

export interface ApprovalPromptOptions {
  ids: IdScope
  locale?: AiLocale
  /** Host-required phrase for high-risk approvals; approve waits for it. */
  confirmationPhrase?: string
  /** Current text of the confirmation input (adapter state). */
  confirmationInput?: string
  onConfirmationInput?: (value: string) => void
  /** Close without deciding; the approval stays pending. */
  onDismiss?: () => void
  /** `dialog` for a modal, `region` for an inline card. Default `dialog`. */
  presentation?: 'dialog' | 'region'
}

export interface ApprovalPromptParts {
  root: PartProps
  title: PartProps
  summary: PartProps
  details: { label: string; value: string; key: string }[]
  status: PartProps
  confirmation?: { label: PartProps; input: PartProps }
  approve: PartProps
  reject: PartProps
  error?: PartProps
}

export function getApprovalPromptParts(
  view: Readonly<ApprovalViewState>,
  controller: Pick<ApprovalController, 'approve' | 'reject'>,
  options: ApprovalPromptOptions,
): ApprovalPromptParts {
  const locale = options.locale ?? EN_LOCALE
  const approval = view.approval
  const titleId = options.ids.id('approval-title')
  const summaryId = options.ids.id('approval-summary')
  const confirmId = options.ids.id('approval-confirm')
  const phrase = options.confirmationPhrase
  const confirmed = !phrase || options.confirmationInput === phrase
  const disabled = !view.canDecide

  const details = approval
    ? [
        { key: 'operation', label: 'Action', value: approval.operation.kind },
        { key: 'target', label: 'Target', value: approval.operation.target },
        {
          key: 'scope',
          label: 'Scope',
          value: locale.approvalScope[approval.scope],
        },
        {
          key: 'risk',
          label: 'Risk',
          value: locale.approvalRisk[approval.risk],
        },
        ...(approval.expiresAt
          ? [
              {
                key: 'expires',
                label: 'Expires',
                value: locale.formatTime(approval.expiresAt),
              },
            ]
          : []),
        ...(approval.operation.preview !== undefined
          ? [
              {
                key: 'preview',
                label: 'Details',
                value: redactPreview(approval.operation.preview).text,
              },
            ]
          : []),
      ]
    : []

  return {
    root: part(
      {
        role:
          (options.presentation ?? 'dialog') === 'dialog'
            ? 'alertdialog'
            : 'region',
        'aria-modal':
          (options.presentation ?? 'dialog') === 'dialog' ? 'true' : undefined,
        'aria-labelledby': titleId,
        'aria-describedby': summaryId,
        'data-status': view.displayStatus,
        'data-risk': approval?.risk,
      },
      {
        keydown: event => {
          // Escape closes the prompt; it never counts as a rejection.
          if (event.key === 'Escape' && options.onDismiss) {
            event.preventDefault()
            options.onDismiss()
          }
        },
      },
    ),
    title: part(
      { id: titleId },
      undefined,
      approval?.title ?? locale.approvalTitle,
    ),
    summary: part({ id: summaryId }, undefined, approval?.summary ?? ''),
    details,
    status: part(
      {
        role: 'status',
        'aria-live': 'polite',
        'data-status': view.displayStatus,
      },
      undefined,
      view.displayStatus ? locale.approvalStatus[view.displayStatus] : '',
    ),
    confirmation: phrase
      ? {
          label: part(
            { for: confirmId },
            undefined,
            locale.confirmPhrase(phrase),
          ),
          input: part(
            {
              id: confirmId,
              value: options.confirmationInput ?? '',
              autocomplete: 'off',
              spellcheck: 'false',
              disabled,
            },
            {
              input: event => options.onConfirmationInput?.(event.value ?? ''),
            },
          ),
        }
      : undefined,
    approve: part(
      {
        type: 'button',
        'data-action': 'approve',
        disabled: disabled || !confirmed,
        'aria-describedby': summaryId,
      },
      { click: () => void controller.approve().catch(() => {}) },
      locale.approve,
    ),
    reject: part(
      { type: 'button', 'data-action': 'reject', disabled },
      { click: () => void controller.reject().catch(() => {}) },
      locale.reject,
    ),
    error: view.error
      ? part({ role: 'alert' }, undefined, view.error)
      : undefined,
  }
}

// ---------------------------------------------------------------------------
// Run switcher
// ---------------------------------------------------------------------------

export function getRunSwitcherParts(
  view: Readonly<RunSwitcherViewState>,
  controller: Pick<RunSwitcherController, 'select'>,
  options: {
    ids: IdScope
    locale?: AiLocale
    title: (executionId: EntityId) => string
    onFocusTab?: (executionId: EntityId) => void
  },
): {
  root: PartProps
  tabs: { executionId: EntityId; props: PartProps; badge?: PartProps }[]
} {
  const locale = options.locale ?? EN_LOCALE
  const ids = view.runs.map(run => run.executionId)

  return {
    root: part({ role: 'tablist', 'aria-label': locale.runSwitcherLabel }),
    tabs: view.runs.map((run, index) => {
      const selected = run.executionId === view.selectedExecutionId
      const notes = [
        locale.executionStatus[run.status],
        run.unread > 0 ? locale.unread(run.unread) : '',
        run.pendingApprovals > 0
          ? locale.pendingApprovals(run.pendingApprovals)
          : '',
      ].filter(Boolean)

      return {
        executionId: run.executionId,
        props: part(
          {
            id: options.ids.id(`run-${run.executionId}`),
            role: 'tab',
            'aria-selected': ariaBool(selected),
            tabindex: selected ? 0 : -1,
            'data-status': run.status,
            'aria-description': notes.join(', '),
          },
          {
            click: () => controller.select(run.executionId),
            keydown: event => {
              const next = navigateIndex(event.key, index, ids.length, {
                orientation: 'horizontal',
                wrap: true,
              })
              if (next === undefined) return
              event.preventDefault()
              controller.select(ids[next])
              options.onFocusTab?.(ids[next])
            },
          },
          options.title(run.executionId),
        ),
        badge:
          run.pendingApprovals > 0 || run.unread > 0
            ? part(
                { 'aria-hidden': 'true' },
                undefined,
                String(run.pendingApprovals || run.unread),
              )
            : undefined,
      }
    }),
  }
}
