# Zeus UI 可访问性验收契约

Zeus UI 的组件可访问性验收分为两层：组件单元契约和真实浏览器 gate。单元契约检查 ARIA 关系、焦点管理和键盘处理；浏览器 gate 在 React 与 Vue showcase 中加载真实 Web Component，并在组件 playground 根节点运行 axe。

当前浏览器 gate 覆盖以下关键路径：

- 表单：`input`、`checkbox`、`switch`、`textarea`、`radio-group`
- 复合交互：`dialog`、`tabs`、`select`
- 虚拟化组件：`data-grid`

键盘与焦点路径由 `e2e/showcase/interaction-keyboard.spec.ts` 覆盖，包含 Dialog 的 Escape 关闭与焦点回退、Tabs 的方向键/Home/End 导航、Select 的选项提交，以及 Data Grid 的 active descendant 导航。

本地验收：

```bash
pnpm showcase:e2e:deps
pnpm exec vitest --project showcase-e2e --run e2e/showcase/accessibility-gate.spec.ts
pnpm exec vitest --project showcase-e2e --run e2e/showcase/interaction-keyboard.spec.ts
```

新增组件或改变组件的交互语义时，必须为对应 playground 增加 axe scope，并为键盘、焦点或 ARIA 状态变化补充浏览器断言。CI 的 `showcase` workflow 会在构建和单元测试通过后运行这些 gate。

## 布尔状态的初始值与交互值

Checkbox / Switch 的 `checked` 与 Dialog / Collapsible / Tooltip 的 `open`
在未传入时保持 `undefined`，以便初始状态采用 `defaultChecked` / `defaultOpen`
（HTML 对应 `default-checked` / `default-open`）。两者均未传入时，控件显示未选中或关闭。
显式传入的 `false` 优先于默认值 `true`。

用户交互或 `show()` / `hide()` 会写入实际状态并发出变化事件；关闭后的 `false`
不能重新回退到初始默认值。原生输入、ARIA 状态、宿主 `data-state` 与显示内容必须一致。
这项约定同样适用于 React / Vue wrapper。Popover / DropdownMenu / Toast 已采用相同的
可选 `open` 约定。该状态协议不承诺 React 事件后的严格受控值回滚。

构建产物回归：`packages/primitives/__tests__/boolean-default-state-runtime.spec.ts`。
