# @zeus-web/virtual

`@zeus-web/virtual` 是 Zeus Web 的**虚拟滚动基础层**，为后续高级组件（Chat、DataGrid、Agent Console 等）提供：

- 固定高度与已测量高度的混合虚拟化算法
- overscan range 计算
- `scrollToIndex` / `scrollToOffset` 跳转能力
- size cache 与 `requestAnimationFrame` 合并调度
- `<zw-virtual-list>` Web Component 适配层

## Phase 1 定位

`zw-virtual-list` 在 Phase 1 中只负责：

```txt
- 滚动容器（viewport）的布局
- 总尺寸占位（spacer）
- 可见 range + overscan range 的计算与状态
- `range-change` / `scroll-offset-change` 事件派发
- 暴露 getRange / getItems / scrollToIndex / scrollToOffset / measure 等命令式 API
```

**`zw-virtual-list` 不直接渲染 item 节点**。它只提供 viewport、spacer、当前 range 状态，并通过 `range-change` 事件把当前可见项列表交给业务层或上层高级组件。

业务层或上层高级组件应通过以下方式渲染可见项：

```ts
zw.addEventListener('range-change', event => {
  const { items } = event.detail
  // 在 items container 中渲染 items
})
```

或者直接调用 `element.getItems()` 拿到当前 range 对应的 `VirtualItem[]`。

需要把 range 直接挂载到 DOM 时，使用独立的 renderer。它接收
`VirtualItem[]`，只创建当前 range 的节点，按稳定 `key` 复用节点，并移除离开
range 的节点：

```ts
import {
  createDomVirtualListRenderer,
  type VirtualItem,
} from '@zeus-web/virtual'

const renderer = createDomVirtualListRenderer({
  container: document.querySelector('#items')!,
  createNode(item: VirtualItem) {
    const node = document.createElement('div')
    return node
  },
  updateNode(node, item) {
    const element = node as HTMLElement
    element.textContent = `Item ${item.index + 1}`
    element.style.position = 'absolute'
    element.style.transform = `translateY(${item.start}px)`
    element.style.height = `${item.size}px`
  },
})

list.addEventListener('range-change', event => {
  renderer.render(event.detail.items)
})

// Renderer owns only the nodes it creates. Call dispose() when the host goes away.
renderer.dispose()
```

`updateNode` runs for newly created and reused nodes, so a renderer can refresh
content and positioning after a measured size or item offset changes. Stable keys
retain their DOM nodes; duplicate keys are rejected. The optional `disposeNode`
callback releases row-level resources when items leave the range or the renderer
is disposed.

`<Slot />` 只负责把调用方的 children 投影到 `zw-virtual-list` 的 items 容器，
不会读取 range，也不会自动虚拟化 children。使用 Slot 时，调用方仍需监听
`range-change` 并通过 renderer 或自己的 renderer 只挂载事件提供的 items。renderer
应使用专用容器；它不会清空或移除容器中未由自己创建的节点。

Chat / DataGrid / Agent Console 等后续阶段会基于该能力封装自己的 item 渲染策略，但**不在本包内提供默认 item renderer**。

## 包结构

```txt
packages/advanced/virtual/
  src/
    index.ts          公共 API 入口
    types.ts          核心类型（VirtualRange / VirtualItem / Virtualizer 等）
    core/             框架无关的 TypeScript engine
      range.ts
      size-cache.ts
      scheduler.ts
      virtualizer.ts
      virtual-list-renderer.ts
    components/       Zeus defineElement Web Component 适配层
      virtual-list.tsx
```

`src/core` 纯 TypeScript，可以被其他 advanced 包直接复用，方便单元测试；`src/components` 只负责把 core engine 包装成 `<zw-virtual-list>` Web Component。

## 公共 API

```ts
import {
  createVirtualizer,
  createRafScheduler,
  SizeCache,
} from '@zeus-web/virtual'
import { VirtualList } from '@zeus-web/virtual/wc/auto'
```

高级组件（`@zeus-web/chat`、`@zeus-web/data-grid`）应通过 `createVirtualizer` 复用 range / measure / scroll 能力，再叠加自己的渲染策略。
