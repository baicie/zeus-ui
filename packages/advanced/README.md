# Zeus Web 高级组件

`packages/advanced/*` 用于存放 Zeus Web 的产品级、高复杂度组件。

高级组件与 `packages/primitives/*` 的边界如下：

- `packages/primitives/*` 存放小型 headless 行为原语，例如 button、input、dialog、switch、tabs。
- `packages/advanced/*` 存放高性能或产品级组件，例如虚拟滚动、AI Chat、数据表格、Agent Console。

高级组件必须坚持 **headless-first**：组件包只负责结构、行为、状态、事件、方法、可访问性与性能契约，不负责最终产品视觉设计。

最终样式与产品化输出应叠加在 headless 包之上：

- `packages/registry` 提供 React / Vue 源码模板，用于 `zweb add <component>`。
- `packages/ui` 提供原生带样式 Web Component 入口，例如 `@zeus-web/ui/chat`。
- `packages/ai` 维护 AI 元数据与代码生成使用规则。

## 规划中的包

```txt
packages/advanced/
  virtual/        @zeus-web/virtual
  chat/           @zeus-web/chat
  revogrid/       @zeus-web/revogrid
  data-grid/      @zeus-web/data-grid
  agent-console/  @zeus-web/agent-console
```

## 组件包规则

每个 advanced 包都应提供与 primitive 包一致的输出模型：

```txt
@zeus-web/<advanced>
@zeus-web/<advanced>/wc
@zeus-web/<advanced>/wc/auto
@zeus-web/<advanced>/react
@zeus-web/<advanced>/vue
@zeus-web/<advanced>/custom-elements.json
@zeus-web/<advanced>/zeus.components.json
```

advanced 包内部建议拆成两层：

```txt
src/core/
  框架无关的 TypeScript engine。
  除非功能明确依赖浏览器，否则不拥有 React、Vue 或 DOM 逻辑。

src/components/
  Zeus defineElement Web Components。
  负责把 core engine 适配成 Web Component 的 props、events、slots 和 methods。
```

## 性能规则

高级组件应遵守以下规则：

1. Web Components 是第一等运行时目标。
2. React 和 Vue wrapper 必须保持轻量。
3. 对象和数组输入使用 property，不使用反射 attribute。
4. 高频更新通过 `requestAnimationFrame` 或等价 scheduler 合并。
5. 大型 DOM 表面只渲染可见 viewport 内容与 overscan。
6. Markdown、语法高亮、导出、自定义渲染器等重功能应按需懒加载。
7. Native、React、Vue showcase 必须验证同一套行为。

## 路线图

详细设计与路线图见：

```txt
docs/design/zeus-ui-advanced-components.md
```
