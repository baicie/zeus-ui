---
layout: home

hero:
  name: Zeus Web
  text: 由 Web Component 驱动的 React、Vue 与原生应用 UI
  tagline: 在 React/Vue 应用中使用可编辑的 Registry 源码，通过 @zeus-web/ui 使用带样式的原生 Web Components，或以 headless primitives 构建自定义设计系统。
  actions:
    - theme: brand
      text: 开始使用
      link: /zh/guide/getting-started
    - theme: alt
      text: 使用模式
      link: /zh/guide/usage-modes
    - theme: alt
      text: 浏览组件
      link: /zh/components/button

features:
  - title: CLI Registry 源码
    details: 运行 zweb init 和 zweb add，将可编辑的 React 或 Vue 源码复制到你的应用中。
  - title: 原生带样式 Web Components
    details: 导入 @zeus-web/ui，无需 React 或 Vue 即可使用带样式的自定义元素。
  - title: 高级 Primitives
    details: 构建自己的设计系统时，使用 @zeus-web/<component>/wc、/react 或 /vue。
  - title: AI 就绪元数据
    details: 使用 zweb ai 生成 zeus-web.ai.md、JSON 元数据或 Cursor 规则。
---

<div class="zw-badge-row">
  <span class="zw-badge">Registry 源码</span>
  <span class="zw-badge">原生 Web Components</span>
  <span class="zw-badge">React</span>
  <span class="zw-badge">Vue</span>
  <span class="zw-badge">AI 元数据</span>
</div>

<div class="zw-grid">
  <div class="zw-card">
    <h3>React/Vue 应用</h3>
    <p>运行 <code>zweb init</code> 创建 <code>zeus-ui.json</code>、<code>src/lib/cn.ts</code> 和 <code>src/styles/zeus.css</code>。</p>
  </div>

  <div class="zw-card">
    <h3>添加源码</h3>
    <p>运行 <code>zweb add button input</code>，将可编辑的 Registry 组件复制到 <code>src/components/ui</code>。</p>
  </div>

  <div class="zw-card">
    <h3>原生包</h3>
    <p>导入 <code>@zeus-web/ui</code>，直接使用 <code>&lt;zw-button&gt;</code> 和 <code>&lt;zw-input&gt;</code>。</p>
  </div>
</div>

## 快速命令

<div class="zw-command">

pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add button input
pnpm add @zeus-web/ui

</div>
