---
layout: home

hero:
  name: Zeus Web
  text: Web Component powered UI for React, Vue and native apps
  tagline: Use editable registry source in React/Vue apps, styled native Web Components with @zeus-web/ui, or headless primitives for custom design systems.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Usage Modes
      link: /guide/usage-modes
    - theme: alt
      text: Browse Components
      link: /components/button

features:
  - title: CLI registry source
    details: Run zweb init and zweb add to copy editable React or Vue source into your app.
  - title: Native styled Web Components
    details: Import @zeus-web/ui and use styled custom elements without React or Vue.
  - title: Advanced primitives
    details: Use @zeus-web/<component>/wc, /react or /vue when building your own design system.
  - title: AI-ready metadata
    details: Generate zeus-web.ai.md, JSON metadata or Cursor rules with zweb ai.
---

<div class="zw-badge-row">
  <span class="zw-badge">Registry source</span>
  <span class="zw-badge">Native Web Components</span>
  <span class="zw-badge">React</span>
  <span class="zw-badge">Vue</span>
  <span class="zw-badge">AI Metadata</span>
</div>

<div class="zw-grid">
  <div class="zw-card">
    <h3>React/Vue apps</h3>
    <p>Run <code>zweb init</code> to create <code>zeus-ui.json</code>, <code>src/lib/cn.ts</code> and <code>src/styles/zeus.css</code>.</p>
  </div>

  <div class="zw-card">
    <h3>Add source</h3>
    <p>Run <code>zweb add button input</code> to copy editable registry components into <code>src/components/ui</code>.</p>
  </div>

  <div class="zw-card">
    <h3>Native package</h3>
    <p>Import <code>@zeus-web/ui</code> and use <code>&lt;zw-button&gt;</code> and <code>&lt;zw-input&gt;</code> directly.</p>
  </div>
</div>

## Quick commands

<div class="zw-command">

pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add button input
pnpm add @zeus-web/ui

</div>
