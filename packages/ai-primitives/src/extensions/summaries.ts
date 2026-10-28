/**
 * `AiThinkingSummary`, `AiCostSummary`, `AiCommandPalette` and
 * `AiParallelRunBoard` (AI2-512).
 *
 * - The thinking summary only shows a summary the host chose to publish
 *   (01-ARCHITECTURE §9.3, 02-INTERACTION-SPEC G): it never exposes private
 *   model reasoning, and it is collapsed by default.
 * - The cost summary formats numbers the host reports with the host's
 *   locale and currency; it does not compute prices.
 * - The command palette is the shared combobox over host-declared commands;
 *   choosing one hands the command id back to the application.
 * - The parallel run board groups `RunSummary`s by status so many runs can
 *   be watched at once; it is read-only and never stops a run.
 */

import type { ExecutionStatus, RunSummary } from '@zeus-web/ai-core'
import type { ComboboxController, ComboboxItem } from '../combobox'
import type { IdScope, PartProps } from '../parts'

import { createCombobox } from '../combobox'
import { ariaBool, part } from '../parts'

export function getThinkingSummaryParts(
  summary: string | undefined,
  expanded: boolean,
  onToggle: () => void,
  options: { ids: IdScope; label?: string },
): { toggle: PartProps; body: PartProps } | undefined {
  if (!summary) return undefined
  const bodyId = options.ids.id('thinking-summary')
  return {
    toggle: part(
      {
        type: 'button',
        'aria-expanded': ariaBool(expanded),
        'aria-controls': bodyId,
      },
      { click: onToggle },
      options.label ?? 'How this answer was produced',
    ),
    body: part({ id: bodyId, hidden: !expanded }, undefined, summary),
  }
}

export interface UsageReport {
  inputTokens?: number
  outputTokens?: number
  /** Cost in the smallest unit the host chose, with its currency. */
  cost?: { amount: number; currency: string }
}

export function formatUsage(usage: UsageReport, locale = 'en'): string {
  const number = new Intl.NumberFormat(locale)
  const parts: string[] = []
  if (usage.inputTokens !== undefined)
    parts.push(`${number.format(usage.inputTokens)} in`)
  if (usage.outputTokens !== undefined)
    parts.push(`${number.format(usage.outputTokens)} out`)
  if (usage.cost) {
    parts.push(
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: usage.cost.currency,
      }).format(usage.cost.amount),
    )
  }
  return parts.join(' · ')
}

export function getCostSummaryParts(
  usage: UsageReport,
  locale?: string,
): { root: PartProps } {
  return {
    root: part(
      { role: 'note', 'aria-label': 'Usage' },
      undefined,
      formatUsage(usage, locale),
    ),
  }
}

export interface PaletteCommand extends ComboboxItem {
  shortcut?: string
}

export function createCommandPalette(options: {
  commands: () => readonly PaletteCommand[]
  onRun: (commandId: string) => void
}): ComboboxController<PaletteCommand> {
  return createCombobox<PaletteCommand>({
    items: options.commands,
    onSelect: command => options.onRun(command.id),
  })
}

export interface RunBoardColumn {
  status: ExecutionStatus
  runs: readonly RunSummary[]
}

const BOARD_ORDER: readonly ExecutionStatus[] = [
  'awaiting-approval',
  'running',
  'paused',
  'queued',
  'failed',
  'cancelled',
  'completed',
]

/** Columns in attention order: runs waiting on a person come first. */
export function groupRunsForBoard(
  runs: readonly RunSummary[],
): RunBoardColumn[] {
  return BOARD_ORDER.map(status => ({
    status,
    runs: runs.filter(run => run.status === status),
  })).filter(column => column.runs.length > 0)
}
