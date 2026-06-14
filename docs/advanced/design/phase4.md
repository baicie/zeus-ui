# Phase 4：Chat Virtual Thread Integration

## 目标

Phase 4 将 `@zeus-web/chat` 与 `@zeus-web/virtual` 集成，使 `zw-chat-thread` 的 `virtual` 属性从静态标记升级为真实虚拟线程能力。

本阶段仍保持 headless-first。`zw-chat-thread` 只负责滚动容器、总尺寸占位、range 计算、items 计算、滚动方法和事件派发，不直接渲染 `zw-chat-message`。

## 范围

本阶段新增：

```txt
packages/advanced/chat/src/core/thread-virtualizer.ts
packages/advanced/chat/__tests__/thread-virtualizer.spec.ts
packages/advanced/chat/__tests__/chat-thread-virtual.spec.ts
docs/advanced/design/phase4.md
```

本阶段修改：

```txt
packages/advanced/chat/package.json
packages/advanced/chat/src/types.ts
packages/advanced/chat/src/core/index.ts
packages/advanced/chat/src/components/chat-thread.tsx
```

## 非目标

本阶段不做：

1. 不在 `zw-chat-thread` 中自动渲染 `zw-chat-message`。
2. 不做动态高度完整优化。
3. 不做 reverse chat list。
4. 不实现 Markdown 渲染。
5. 不实现代码高亮。
6. 不接模型服务。
7. 不做 provider transport。
8. 不修改 registry styled templates。

## API

### Props

`zw-chat-thread` 支持：

```txt
count?: number
loading?: boolean
empty?: boolean
virtual?: boolean
estimate-size?: number
overscan?: number
aria-label?: string
```

### Events

`zw-chat-thread` 新增：

```txt
range-change
scroll-offset-change
```

`range-change` detail：

```ts
interface ChatThreadRangeChangeDetail {
  range: ChatThreadVirtualRange
  items: ChatThreadVirtualItem[]
  scrollOffset: number
  viewportSize: number
  totalSize: number
}
```

`scroll-offset-change` detail：

```ts
interface ChatThreadScrollOffsetChangeDetail {
  offset: number
  nativeEvent: Event
}
```

### Methods

`zw-chat-thread` 暴露：

```txt
scrollToBottom(options?: ScrollIntoViewOptions): void
getRange(): ChatThreadVirtualRange
getItems(): ChatThreadVirtualItem[]
getTotalSize(): number
scrollToIndex(index: number, align?: 'start' | 'center' | 'end'): void
scrollToOffset(offset: number): void
measure(index?: number, size?: number): void
resetMeasurements(): void
```

## Headless 渲染策略

`zw-chat-thread` 只提供：

1. viewport
2. spacer
3. range
4. items
5. scroll methods
6. range-change event

上层负责根据 `range-change` 或 `getItems()` 渲染可见消息。

## 测量策略

`measure(index, size)` 会更新内部 virtualizer 的 item size。

即使 range 没有变化，只要 item 的 `start / size / end` 或 `totalSize` 变化，也必须更新 snapshot 并触发 `range-change`。否则外部通过 `getItems()` 拿到的 item 会是旧数据。

## 验收

```bash
pnpm --filter @zeus-web/virtual test
pnpm --filter @zeus-web/chat check
pnpm --filter @zeus-web/chat test
pnpm --filter @zeus-web/chat build

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm check:product-contract
```
