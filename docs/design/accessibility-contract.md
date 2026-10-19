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
