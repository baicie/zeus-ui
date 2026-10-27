/**
 * Step / tool projections (AI2-302).
 *
 * Executions own a flat, host-ordered step index; nesting comes from
 * `parentStepId`. These selectors turn that into what a step list renders,
 * with the same memoization rules as `selectors.ts`: results are cached per
 * input record in `WeakMap`s, so unrelated commits return the same object.
 *
 * Renderers should list ids with `selectStepChildIds` and let each step
 * subscribe to its own entity; then one step update re-renders one row
 * instead of the whole tree.
 */

import type { EntityId, ExecutionStep, ToolInvocation } from '../domain/types'
import type { AiState } from './state'

export interface StepNode {
  step: ExecutionStep
  tool?: ToolInvocation
  depth: number
  children: readonly StepNode[]
}

const ROOT = ''
const EMPTY_IDS: readonly EntityId[] = Object.freeze([])

const childIdMemo = new WeakMap<
  readonly EntityId[],
  { steps: object; byParent: ReadonlyMap<string, readonly EntityId[]> }
>()

function childIdsByParent(
  state: AiState,
  executionId: EntityId,
): ReadonlyMap<string, readonly EntityId[]> {
  const ids = state.executionStepIds[executionId]
  if (!ids) return new Map()

  const memo = childIdMemo.get(ids)
  if (memo && memo.steps === state.steps) return memo.byParent

  const byParent = new Map<string, EntityId[]>()
  for (const id of ids) {
    const parent = state.steps.get(id)?.parentStepId ?? ROOT
    const list = byParent.get(parent)
    if (list) list.push(id)
    else byParent.set(parent, [id])
  }

  // Keep previous arrays when their content did not change.
  if (memo) {
    for (const [parent, list] of byParent) {
      const previous = memo.byParent.get(parent)
      if (
        previous &&
        previous.length === list.length &&
        previous.every((id, index) => id === list[index])
      ) {
        byParent.set(parent, previous as EntityId[])
      }
    }
  }

  childIdMemo.set(ids, { steps: state.steps, byParent })
  return byParent
}

/** Direct children of a step (or the roots when `parentStepId` is omitted). */
export function selectStepChildIds(
  state: AiState,
  executionId: EntityId,
  parentStepId?: EntityId,
): readonly EntityId[] {
  return (
    childIdsByParent(state, executionId).get(parentStepId ?? ROOT) ?? EMPTY_IDS
  )
}

/** The tool a step drives, by explicit link or by the tool's `stepId`. */
export function selectStepTool(
  state: AiState,
  stepId: EntityId,
): ToolInvocation | undefined {
  const step = state.steps.get(stepId)
  if (!step) return undefined

  if (step.toolInvocationId)
    return state.toolInvocations.get(step.toolInvocationId)

  return state.toolInvocations
    .values()
    .find(
      tool => tool.stepId === stepId && tool.executionId === step.executionId,
    )
}

const treeMemo = new WeakMap<
  readonly EntityId[],
  { steps: object; tools: object; tree: readonly StepNode[] }
>()

/** Nested step tree with tools attached; stable while inputs are unchanged. */
export function selectStepTree(
  state: AiState,
  executionId: EntityId,
): readonly StepNode[] {
  const ids = state.executionStepIds[executionId]
  if (!ids) return []

  const memo = treeMemo.get(ids)
  if (
    memo &&
    memo.steps === state.steps &&
    memo.tools === state.toolInvocations
  ) {
    return memo.tree
  }

  const byParent = childIdsByParent(state, executionId)

  function build(parent: string, depth: number): StepNode[] {
    return (byParent.get(parent) ?? []).flatMap(id => {
      const step = state.steps.get(id)
      return step
        ? [
            {
              step,
              tool: selectStepTool(state, id),
              depth,
              children: build(id, depth + 1),
            },
          ]
        : []
    })
  }

  const tree = build(ROOT, 0)
  treeMemo.set(ids, { steps: state.steps, tools: state.toolInvocations, tree })
  return tree
}

/** Tool invocations of an execution, in insertion order. */
export function selectExecutionTools(
  state: AiState,
  executionId: EntityId,
): readonly ToolInvocation[] {
  return state.toolInvocations
    .values()
    .filter(tool => tool.executionId === executionId)
}
