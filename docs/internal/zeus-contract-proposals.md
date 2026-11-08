# Zeus 契约变更提案（PR-24 产出）

本文件记录 PR-24 在 zeus-ui 侧实测到、需要在 zeus 仓修改或确认的契约问题。**三仓合并窗口内不修改 zeus 仓**，因此这里只写提案与证据，由编排会话带到 zeus 仓 PR。

每条包含：现象、复现方式、影响面、建议方案。证据全部来自本仓库实际运行结果。

---

## Z-1 `prop:name` 不做属性名归一化（高优先级）

**现象**

Zeus DOM 编译器把 `prop:<name>` 的 `<name>` 原样作为属性名写入元素：

| 源码                              | 编译产物                                       | 结果                                        |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| `prop:selectionMode={v}`          | `$zeusBindProp(el, "selectionMode", () => v)`  | ✅ 命中 `selectionMode` 属性                |
| `prop:selection-mode={v}`         | `$zeusBindProp(el, "selection-mode", () => v)` | ❌ 元素上没有 `selection-mode` 属性，值丢失 |
| `prop:columns={v}`                | `$zeusBindProp(el, "columns", () => v)`        | ✅                                          |
| `selectionMode={v}`（无 `prop:`） | `$zeusBindAttr(el, "selectionMode", ...)`      | ❌ 写成 `selectionmode` 属性，元素不读      |

**复现**

```js
import { transformModule } from '@zeus-js/compiler'
transformModule({
  source: `export const A = p => <zw-data-grid prop:selection-mode={p.mode} />`,
  filename: 'probe.native.tsx',
  target: 'dom',
  runtimeModule: '@zeus-js/runtime-dom',
  delegateEvents: true,
  sourceMap: false,
}).code
// → $zeusBindProp($zeusEl, "selection-mode", () => (p.mode))
```

在 `e2e/contract/native-hosts.native.tsx` 里用 `prop:selection-mode` 时 `selection-change` 永不触发；改成 `prop:selectionMode` 后立即通过。

**影响面**

- 所有「camelCase 属性、kebab-case attr」并存的自定义元素（本仓库 DataGrid 的 `selectionMode`、`rowHeight`、`overscanColumns`、`keyboardNavigation` 等）。
- 用户会自然地把 HTML 属性写法（kebab）套到 `prop:` 上——这是最常见的误解，错误静默无声。

**建议方案**（任一）

1. 编译器输出前对 `prop:` 名字做 kebab→camel 转换（`selection-mode` → `selectionMode`）。
2. 编译期报错：`prop:` 只接受 camelCase，遇到含 `-` 的名字给出 `ZEUS_INVALID_PROP_NAME` 诊断。
3. 若保持现状，在 Zeus 文档里显式写明，并由 `component-analyzer` 在类型层把 `prop:` 名字约束成字面量联合。

**倾向**：方案 2。报错比静默丢值安全，且不改变现有正确代码的行为。

---

## Z-2 事件属性命名规则：`on` + 原样标识符，不做 camel→kebab

**现象**

编译器把 `on` 之后的标识符**整体转小写**作为监听的事件名：

| JSX 写法              | 监听的事件名       | 对 `value-change` 是否有效                   |
| --------------------- | ------------------ | -------------------------------------------- |
| `onvalue-change={fn}` | `value-change`     | ✅                                           |
| `onValueChange={fn}`  | `valuechange`      | ❌                                           |
| `on:value-change`     | 编译错误           | —（`ZEUS_UNSUPPORTED_NAMESPACED_ATTRIBUTE`） |
| `onselection-change`  | `selection-change` | ✅                                           |

来源：`e2e/contract/native-hosts.native.tsx` 头注释与逐条实测；`transformModule` 对 `onValueChange` 输出了 `$zeusBindEvent(el, "valuechange", ...)`。

**影响面**

- 所有 crate 级自定义事件都是 kebab-case（`value-change`、`open-change`、`row-action`、`selection-change`）。React 习惯的 `onValueChange` 在 Native 下静默失效。
- `on:` 命名空间被明确拒绝，用户没有「显式事件名」的写法可用。

**建议方案**

1. 支持 `on:<event-name>` 作为显式事件绑定（`on:value-change`），把标识符拼写完全交给用户。
2. 保留 `onXxx` 时按 camel→kebab 转换（`onValueChange` → `value-change`），与 React 习惯一致。
3. 若保持现状，至少在诊断里提示「`onValueChange` 监听的是 `valuechange`，自定义元素通常使用 kebab-case」。

**倾向**：1 + 3。显式写法成本最低，且不会破坏已用 `onvalue-change` 的代码。

---

## Z-3 顶层事件委托只收集静态出现的事件名

**现象**

编译产物末尾有 `$zeusDelegateEvents(["selection-change"])`，只包含**模板里静态写出**的事件名。运行期通过 `bindEvent` 动态绑定、或由子元素自己派发的事件不在委托列表里。

**现状影响**：本仓库未受影响——自定义元素直接 `dispatchEvent`，不依赖委托。但 Native 侧的 `ctx.emit.*` 若走委托路径，动态事件会漏。

**建议**：明确委托只用于「静态可枚举的事件」，并在文档里写清动态事件的兜底（直接 `addEventListener`）。属**文档级**提案，不改行为。

---

## Z-4 `bindProp` 对自定义元素不做 equality 短路

**现象**

```js
function bindProp(el, name, value, once = false) {
  bindEffect(value, once, (next) => {
    if (!el.localName.includes('-') && Object.is(el[name], next)) { ... return }
    el[name] = next
  })
}
```

带 `-` 的自定义元素每次 effect 重跑都会重新赋值属性，即使值相同。对 DataGrid 这类属性 setter 会触发重建的元素，重复赋值有实际成本（`rebuildModels()`）。

**现状影响**

- `e2e/contract` 的 DataGrid 用例里，React 包装器每次渲染都会重新 `prop:rows`，触发一次属性写入。功能正确，但虚拟滚动场景下会有额外重建。
- 本仓库的宿主适配层（`createDataGridHostAdapter`）已做值比较，所以实际未观测到性能回退。

**建议**：对自定义元素同样做 `Object.is` 短路，或提供 `prop:name` 的 `once` / 显式 compare 选项。

---

## Z-5 `componentOnReady()` 的时序需要写进契约

**现象**

跨宿主测试里，Popover / Dialog / FormField 的子元素必须等根元素 `componentOnReady()` 之后才能解析 DOM context：

```ts
// 直接挂载后立刻点 trigger → 无反应
// await root.componentOnReady(); await nextFrame(); → 正常
```

`usePopoverContext` / `useFormFieldContext` / `resolveDOMContext` 都通过 `host.closest('zw-*')` + `componentOnReady().then(resolve)` 解析。

**影响面**

- 框架包装器（React/Vue）异步渲染后立即断言会拿到未链接的 DOM。
- 第三方集成方如果自己 `createElement` + `append`，必须在同一帧后再交互。

**建议**

- 在 Zeus 文档的「自定义元素生命周期」章节明确：`componentOnReady()` 之后 DOM context 才可用；属性写入与交互需在此之后。
- 若可行，让 `provideDOMContext` 对**已定义**元素同步可用，减少一次微任务等待。

本仓库已经把这条写进 `e2e/contract/cross-host-harness.ts` 的头注释与 `types.ts` 的 `element` 注释。

---

## Z-6 组件包对 `@zeus-js/*` 的导入面

**现状（本仓库实测）**

- 组件源码（`packages/primitives/*/src`、`packages/advanced/*/src`）只 import `@zeus-js/zeus`，共 68 处，**0 处深路径 / internal**。
- `@zeus-web/zeus-compat` 允许 `@zeus-js/zeus` 与 `@zeus-js/zeus/capabilities`，其余一律拒绝（`scripts/checks/check-zeus-workspace.ts` 的 `isAllowedZeusImport`）。
- `check:zeus-imports` 已在 CI 的 `build` job 执行。

**结论**：导入面已经收敛，无需 zeus 仓改动。这里记录为**已验收项**，供合并决策引用。

---

## 汇总

| 编号 | 类型   | 优先级 | 状态     | 需要 zeus 仓动作           |
| ---- | ------ | ------ | -------- | -------------------------- |
| Z-1  | 编译器 | 高     | 实测确认 | 是（改诊断或归一化）       |
| Z-2  | 编译器 | 高     | 实测确认 | 是（`on:` 或 camel→kebab） |
| Z-3  | 文档   | 低     | 观察     | 否（仅文档）               |
| Z-4  | 运行时 | 中     | 代码阅读 | 是（可选优化）             |
| Z-5  | 文档   | 中     | 实测确认 | 建议（契约表述）           |
| Z-6  | 验收   | —      | 已满足   | 否                         |
