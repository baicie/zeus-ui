import type { VirtualItem } from '../types'

/**
 * The smallest host contract needed to place renderer-owned nodes.
 *
 * `insertNode` must place `node` immediately before `reference`, or append it
 * when `reference` is null. The renderer never clears a host container and
 * never owns nodes it did not create.
 */
export interface VirtualListRendererOptions<TNode, TData = unknown> {
  createNode: (item: VirtualItem<TData>) => TNode
  insertNode: (
    node: TNode,
    reference: TNode | null,
    item: VirtualItem<TData>,
    index: number,
  ) => void
  removeNode: (node: TNode, item: VirtualItem<TData>) => void
  updateNode: (node: TNode, item: VirtualItem<TData>) => void
}

export interface VirtualListRenderResult<TNode, TData = unknown> {
  items: readonly VirtualItem<TData>[]
  nodes: readonly TNode[]
}

export interface VirtualListRenderer<TNode, TData = unknown> {
  /** Apply one virtual range and mount exactly the supplied items. */
  render: (
    items: readonly VirtualItem<TData>[],
  ) => VirtualListRenderResult<TNode, TData>
  getMountedCount: () => number
  getMountedItems: () => readonly VirtualItem<TData>[]
  getMountedNodes: () => readonly TNode[]
  getNode: (key: string) => TNode | undefined
  dispose: () => void
}

interface MountedRecord<TNode, TData> {
  item: VirtualItem<TData>
  node: TNode
}

/**
 * Reconciles a virtual range into renderer-owned nodes.
 *
 * The virtualizer owns range calculation; this object owns node lifecycle.
 * A key that remains in the next range keeps its node identity, while keys
 * that leave the range are removed and disposed by the host adapter.
 */
export function createVirtualListRenderer<TNode, TData = unknown>(
  options: VirtualListRendererOptions<TNode, TData>,
): VirtualListRenderer<TNode, TData> {
  let records = new Map<string, MountedRecord<TNode, TData>>()
  let orderedRecords: MountedRecord<TNode, TData>[] = []
  let disposed = false

  function assertActive(): void {
    if (disposed) {
      throw new Error('Virtual list renderer has been disposed.')
    }
  }

  function render(
    items: readonly VirtualItem<TData>[],
  ): VirtualListRenderResult<TNode, TData> {
    assertActive()

    const nextKeys = new Set<string>()
    for (const item of items) {
      if (nextKeys.has(item.key)) {
        throw new Error(
          `Virtual list renderer received duplicate key "${item.key}".`,
        )
      }

      nextKeys.add(item.key)
    }

    const nextRecords: MountedRecord<TNode, TData>[] = []

    for (const item of items) {
      const previous = records.get(item.key)
      const node = previous?.node ?? options.createNode(item)
      options.updateNode(node, item)
      nextRecords.push({ item, node })
    }

    for (const previous of orderedRecords) {
      if (!nextKeys.has(previous.item.key)) {
        options.removeNode(previous.node, previous.item)
      }
    }

    const currentRecords = orderedRecords.filter(record =>
      nextKeys.has(record.item.key),
    )

    for (let index = 0; index < nextRecords.length; index += 1) {
      const next = nextRecords[index]
      const reference = currentRecords[index]?.node ?? null

      if (reference !== next.node) {
        options.insertNode(next.node, reference, next.item, index)
        const previousIndex = currentRecords.findIndex(
          record => record.node === next.node,
        )
        if (previousIndex >= 0) currentRecords.splice(previousIndex, 1)
        currentRecords.splice(index, 0, {
          item: next.item,
          node: next.node,
        })
      }
    }

    orderedRecords = nextRecords
    records = new Map(nextRecords.map(record => [record.item.key, record]))

    return {
      items: nextRecords.map(record => record.item),
      nodes: nextRecords.map(record => record.node),
    }
  }

  function dispose(): void {
    if (disposed) return

    for (const record of orderedRecords) {
      options.removeNode(record.node, record.item)
    }

    records.clear()
    orderedRecords = []
    disposed = true
  }

  return {
    render,
    getMountedCount: () => orderedRecords.length,
    getMountedItems: () => orderedRecords.map(record => record.item),
    getMountedNodes: () => orderedRecords.map(record => record.node),
    getNode: key => records.get(key)?.node,
    dispose,
  }
}

export interface DomVirtualListRendererOptions<TData = unknown> {
  /** A dedicated container for renderer-owned nodes. Existing children stay untouched. */
  container: Element | DocumentFragment
  createNode: (item: VirtualItem<TData>) => Node
  updateNode: (node: Node, item: VirtualItem<TData>) => void
  disposeNode?: (node: Node, item: VirtualItem<TData>) => void
}

/** DOM adapter for the generic renderer. It does not inspect or virtualize `<Slot />`. */
export function createDomVirtualListRenderer<TData = unknown>(
  options: DomVirtualListRendererOptions<TData>,
): VirtualListRenderer<Node, TData> {
  return createVirtualListRenderer<Node, TData>({
    createNode: options.createNode,
    updateNode: options.updateNode,
    insertNode(node, reference) {
      options.container.insertBefore(node, reference)
    },
    removeNode(node, item) {
      if (node.parentNode === options.container) {
        options.container.removeChild(node)
      }
      options.disposeNode?.(node, item)
    },
  })
}
