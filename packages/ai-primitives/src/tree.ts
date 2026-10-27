/**
 * Treeview model (WAI-ARIA APG treeview), shared by `AiStepList`,
 * `AiPlanOutline` and `AiFileChangeTree`.
 *
 * Keyboard: Up/Down move through visible nodes, Right expands or enters the
 * first child, Left collapses or goes to the parent, Home/End jump, Enter /
 * Space select, `*` expands all siblings. One node is in the tab sequence
 * (roving tabindex); expansion is local view state.
 */

import type { Controller } from '@zeus-web/ai-core'
import type { IdScope, PartEvent, PartProps } from './parts'

import { createViewStore } from '@zeus-web/ai-core'
import { ariaBool, part } from './parts'

export interface TreeNode {
  id: string
  label: string
  children: readonly TreeNode[]
}

export interface FlatTreeNode {
  id: string
  label: string
  level: number
  parentId?: string
  hasChildren: boolean
  expanded: boolean
  posinset: number
  setsize: number
}

export interface TreeViewState {
  expanded: ReadonlySet<string>
  focusedId?: string
  selectedId?: string
}

export interface TreeController extends Controller<TreeViewState> {
  flatten: (roots: readonly TreeNode[]) => FlatTreeNode[]
  toggle: (id: string, expanded?: boolean) => void
  focus: (id: string) => void
  select: (id: string) => void
  handleKey: (roots: readonly TreeNode[], event: PartEvent) => void
}

export interface TreeOptions {
  /** Expanded on creation; default: everything collapsed. */
  initiallyExpanded?: Iterable<string>
  onSelect?: (id: string) => void
  /** Move DOM focus; adapters pass a function that focuses the node element. */
  onFocus?: (id: string) => void
}

export function createTreeController(
  options: TreeOptions = {},
): TreeController {
  const view = createViewStore<TreeViewState>({
    expanded: new Set(options.initiallyExpanded ?? []),
  })

  function flatten(roots: readonly TreeNode[]): FlatTreeNode[] {
    const expanded = view.getSnapshot().expanded
    const result: FlatTreeNode[] = []

    function walk(
      nodes: readonly TreeNode[],
      level: number,
      parentId?: string,
    ): void {
      nodes.forEach((node, index) => {
        const isExpanded = expanded.has(node.id)
        result.push({
          id: node.id,
          label: node.label,
          level,
          parentId,
          hasChildren: node.children.length > 0,
          expanded: isExpanded,
          posinset: index + 1,
          setsize: nodes.length,
        })
        if (isExpanded) walk(node.children, level + 1, node.id)
      })
    }

    walk(roots, 1)
    return result
  }

  function toggle(id: string, value?: boolean): void {
    const expanded = new Set(view.getSnapshot().expanded)
    const next = value ?? !expanded.has(id)
    if (next === expanded.has(id)) return
    if (next) expanded.add(id)
    else expanded.delete(id)
    view.update({ expanded })
  }

  function focus(id: string): void {
    view.update({ focusedId: id })
    options.onFocus?.(id)
  }

  function select(id: string): void {
    view.update({ selectedId: id, focusedId: id })
    options.onSelect?.(id)
  }

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    flatten,
    toggle,
    focus,
    select,
    handleKey(roots, event): void {
      const nodes = flatten(roots)
      if (nodes.length === 0) return

      const focusedId = view.getSnapshot().focusedId ?? nodes[0].id
      const index = Math.max(
        0,
        nodes.findIndex(node => node.id === focusedId),
      )
      const current = nodes[index]
      let handled = true

      switch (event.key) {
        case 'ArrowDown':
          focus(nodes[Math.min(nodes.length - 1, index + 1)].id)
          break
        case 'ArrowUp':
          focus(nodes[Math.max(0, index - 1)].id)
          break
        case 'Home':
          focus(nodes[0].id)
          break
        case 'End':
          focus(nodes[nodes.length - 1].id)
          break
        case 'ArrowRight':
          if (current.hasChildren && !current.expanded) toggle(current.id, true)
          else if (current.hasChildren) focus(nodes[index + 1].id)
          break
        case 'ArrowLeft':
          if (current.hasChildren && current.expanded) toggle(current.id, false)
          else if (current.parentId) focus(current.parentId)
          break
        case 'Enter':
        case ' ':
          select(current.id)
          break
        case '*': {
          const siblings = nodes.filter(
            node => node.parentId === current.parentId && node.hasChildren,
          )
          const expanded = new Set(view.getSnapshot().expanded)
          for (const node of siblings) expanded.add(node.id)
          view.update({ expanded })
          break
        }
        default:
          handled = false
      }

      if (handled) event.preventDefault()
    },
    dispose(): void {
      view.dispose()
    },
  }
}

export function getTreeParts(
  roots: readonly TreeNode[],
  controller: TreeController,
  options: { ids: IdScope; label: string },
): { root: PartProps; nodes: { node: FlatTreeNode; props: PartProps }[] } {
  const state = controller.getSnapshot()
  const nodes = controller.flatten(roots)
  const focusable = state.focusedId ?? state.selectedId ?? nodes[0]?.id

  return {
    root: part(
      { role: 'tree', 'aria-label': options.label },
      { keydown: event => controller.handleKey(roots, event) },
    ),
    nodes: nodes.map(node => ({
      node,
      props: part(
        {
          id: options.ids.id(`node-${node.id}`),
          role: 'treeitem',
          tabindex: node.id === focusable ? 0 : -1,
          'aria-level': node.level,
          'aria-posinset': node.posinset,
          'aria-setsize': node.setsize,
          'aria-expanded': node.hasChildren
            ? ariaBool(node.expanded)
            : undefined,
          'aria-selected': ariaBool(node.id === state.selectedId),
          'data-node-id': node.id,
        },
        {
          click: () => {
            if (node.hasChildren) controller.toggle(node.id)
            controller.select(node.id)
          },
        },
      ),
    })),
  }
}
