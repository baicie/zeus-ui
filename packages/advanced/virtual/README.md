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
