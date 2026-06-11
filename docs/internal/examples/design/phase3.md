下面给 **Phase 3：Showcase Page Template 抽象** 的详细设计与完整代码。
注意：Phase 3 不做 Button/Input/Dialog 等真实能力实现，只抽象 React/Vue 两侧共用的页面骨架组件，为后续 Phase 4 开始逐个组件填充真实 demo 做准备。

当前 `mvp-examples` 已经有 React/Vue 两个 showcase shell，Vue 路由已覆盖 `/`、`/components`、`/components/:componentName`、`/icons`、`/themes`、`/playground`。
Vue 测试也已经覆盖首页、组件索引、组件详情、icons/themes、sidebar 跳转和 topbar 搜索。
根脚本也已经有 `showcase:build` 和 `showcase:test` 同时跑 React/Vue。

---

## Phase 3 目标

```txt
目标：
1. 抽象 React/Vue 两套组件详情页模板。
2. 统一组件页结构：Header / Imports / Sections / States / Events / Theme / Production Patterns。
3. 抽象通用展示组件：DemoPage、DemoSection、DemoGrid、PropTable、StateMatrix、EventLog、ThemeTokenPreview、ImportSnippet。
4. 替换 React/Vue 当前 ComponentDetailPage 的手写结构。
5. 增加 React/Vue 模板组件单测。
6. 后续 Phase 4 只需要往每个组件页里填真实 demo，不再重复写页面框架。
```

不做：

```txt
不引入 @zeus-web/button/vue
不引入 @zeus-web/button/react
不做真实组件交互页
不做 Playwright e2e
不改 registry
不改 release
```

---

## Phase 3 新增/修改文件清单

```txt
examples/showcase-shared/src/demo.ts
examples/showcase-shared/src/index.ts

examples/react-showcase/src/app/demo/DemoPage.tsx
examples/react-showcase/src/app/demo/DemoSection.tsx
examples/react-showcase/src/app/demo/DemoGrid.tsx
examples/react-showcase/src/app/demo/ImportSnippet.tsx
examples/react-showcase/src/app/demo/PropTable.tsx
examples/react-showcase/src/app/demo/StateMatrix.tsx
examples/react-showcase/src/app/demo/EventLog.tsx
examples/react-showcase/src/app/demo/ThemeTokenPreview.tsx
examples/react-showcase/src/app/demo/ComponentPageScaffold.tsx
examples/react-showcase/src/routes/ComponentDetailPage.tsx
examples/react-showcase/src/__tests__/demo-components.spec.tsx
examples/react-showcase/src/app.css 追加样式

examples/vue-showcase/src/app/demo/DemoPage.vue
examples/vue-showcase/src/app/demo/DemoSection.vue
examples/vue-showcase/src/app/demo/DemoGrid.vue
examples/vue-showcase/src/app/demo/ImportSnippet.vue
examples/vue-showcase/src/app/demo/PropTable.vue
examples/vue-showcase/src/app/demo/StateMatrix.vue
examples/vue-showcase/src/app/demo/EventLog.vue
examples/vue-showcase/src/app/demo/ThemeTokenPreview.vue
examples/vue-showcase/src/app/demo/ComponentPageScaffold.vue
examples/vue-showcase/src/routes/ComponentDetailPage.vue
examples/vue-showcase/src/__tests__/demo-components.spec.ts
examples/vue-showcase/src/app.css 追加样式
```

---

# 1. Shared 层

## 1.1 新增 `examples/showcase-shared/src/demo.ts`

```ts
import type { ShowcaseSection } from './types'

export interface ShowcaseSectionDefinition {
  id: ShowcaseSection
  label: string
  description: string
  requiredForMvp: boolean
}

export const showcaseSectionOrder: ShowcaseSection[] = [
  'basic',
  'variants',
  'sizes',
  'states',
  'controlled',
  'uncontrolled',
  'events',
  'icons',
  'theme',
  'accessibility',
  'production',
]

export const showcaseSectionDefinitions: Record<
  ShowcaseSection,
  ShowcaseSectionDefinition
> = {
  basic: {
    id: 'basic',
    label: 'Basic',
    description: 'Minimal usage and default rendering.',
    requiredForMvp: true,
  },
  variants: {
    id: 'variants',
    label: 'Variants',
    description: 'Visual and semantic variants.',
    requiredForMvp: false,
  },
  sizes: {
    id: 'sizes',
    label: 'Sizes',
    description: 'Supported size presets.',
    requiredForMvp: false,
  },
  states: {
    id: 'states',
    label: 'States',
    description: 'Disabled, invalid, loading, selected and other states.',
    requiredForMvp: true,
  },
  controlled: {
    id: 'controlled',
    label: 'Controlled',
    description: 'Externally controlled state examples.',
    requiredForMvp: false,
  },
  uncontrolled: {
    id: 'uncontrolled',
    label: 'Uncontrolled',
    description: 'Default value and internal state examples.',
    requiredForMvp: false,
  },
  events: {
    id: 'events',
    label: 'Events',
    description: 'Emitted events and framework callback names.',
    requiredForMvp: false,
  },
  icons: {
    id: 'icons',
    label: 'With icons',
    description: 'Icon composition examples.',
    requiredForMvp: false,
  },
  theme: {
    id: 'theme',
    label: 'Theme tokens',
    description: 'Theme tokens used by the component.',
    requiredForMvp: true,
  },
  accessibility: {
    id: 'accessibility',
    label: 'Accessibility',
    description: 'Accessibility notes and expected keyboard behavior.',
    requiredForMvp: true,
  },
  production: {
    id: 'production',
    label: 'Production patterns',
    description: 'Real-world use cases this component should support.',
    requiredForMvp: true,
  },
}

export function getShowcaseSectionDefinition(
  section: ShowcaseSection,
): ShowcaseSectionDefinition {
  return showcaseSectionDefinitions[section]
}

export function sortShowcaseSections(
  sections: readonly ShowcaseSection[],
): ShowcaseSection[] {
  const enabled = new Set(sections)

  return showcaseSectionOrder.filter(section => enabled.has(section))
}

export function getRequiredShowcaseSections(): ShowcaseSection[] {
  return showcaseSectionOrder.filter(
    section => showcaseSectionDefinitions[section].requiredForMvp,
  )
}
```

---

## 1.2 修改 `examples/showcase-shared/src/index.ts`

在原有 exports 基础上增加：

```ts
export * from './demo'
```

完整文件建议为：

```ts
export * from './components'
export * from './demo'
export * from './icons'
export * from './routes'
export * from './themes'
export * from './types'
export * from './validate'
```

---

# 2. React Showcase 模板组件

## 2.1 新增 `examples/react-showcase/src/app/demo/DemoGrid.tsx`

```tsx
import type { ReactNode } from 'react'

export function DemoGrid(props: { children: ReactNode; columns?: 1 | 2 | 3 }) {
  const columns = props.columns ?? 2

  return (
    <div className={`showcase-demo-grid showcase-demo-grid-${columns}`}>
      {props.children}
    </div>
  )
}
```

---

## 2.2 新增 `examples/react-showcase/src/app/demo/DemoSection.tsx`

```tsx
import type { ReactNode } from 'react'

export function DemoSection(props: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="showcase-demo-section">
      <header className="showcase-demo-section-header">
        <h2 className="showcase-section-title">{props.title}</h2>
        {props.description ? (
          <p className="showcase-card-description">{props.description}</p>
        ) : null}
      </header>

      <div className="showcase-demo-section-body">{props.children}</div>
    </section>
  )
}
```

---

## 2.3 新增 `examples/react-showcase/src/app/demo/DemoPage.tsx`

```tsx
import type { ReactNode } from 'react'

export function DemoPage(props: {
  eyebrow?: string
  title: string
  description: string
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        {props.eyebrow ? (
          <p className="showcase-eyebrow">{props.eyebrow}</p>
        ) : null}

        <h1 className="showcase-title">{props.title}</h1>
        <p className="showcase-description">{props.description}</p>

        {props.meta ? (
          <div className="showcase-page-meta">{props.meta}</div>
        ) : null}
      </header>

      <div className="showcase-demo-stack">{props.children}</div>
    </div>
  )
}
```

---

## 2.4 新增 `examples/react-showcase/src/app/demo/ImportSnippet.tsx`

```tsx
export function ImportSnippet(props: { title: string; value?: string }) {
  return (
    <div className="showcase-card">
      <h3 className="showcase-card-title">{props.title}</h3>
      <pre className="showcase-code">{props.value ?? 'Not planned'}</pre>
    </div>
  )
}
```

---

## 2.5 新增 `examples/react-showcase/src/app/demo/PropTable.tsx`

```tsx
export interface PropTableRow {
  name: string
  type: string
  defaultValue?: string
  description: string
}

export function PropTable(props: { rows: PropTableRow[] }) {
  if (props.rows.length === 0) {
    return <div className="showcase-empty">No props documented yet.</div>
  }

  return (
    <div className="showcase-table-wrap">
      <table className="showcase-table">
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>

        <tbody>
          {props.rows.map(row => (
            <tr key={row.name}>
              <td>
                <code>{row.name}</code>
              </td>
              <td>
                <code>{row.type}</code>
              </td>
              <td>
                {row.defaultValue ? <code>{row.defaultValue}</code> : '—'}
              </td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## 2.6 新增 `examples/react-showcase/src/app/demo/StateMatrix.tsx`

```tsx
export function StateMatrix(props: { states: string[] }) {
  if (props.states.length === 0) {
    return <div className="showcase-empty">No states documented yet.</div>
  }

  return (
    <div className="showcase-state-matrix">
      {props.states.map(state => (
        <div key={state} className="showcase-state-cell">
          <span className="showcase-badge">{state}</span>
          <div className="showcase-state-preview">
            <span>{state}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

## 2.7 新增 `examples/react-showcase/src/app/demo/EventLog.tsx`

```tsx
import type { ShowcaseEventSpec } from '@zeus-web/example-showcase-shared'

export function EventLog(props: { events: ShowcaseEventSpec[] }) {
  if (props.events.length === 0) {
    return <div className="showcase-empty">No custom events planned.</div>
  }

  return (
    <div className="showcase-demo-grid showcase-demo-grid-2">
      {props.events.map(event => (
        <div key={event.name} className="showcase-card">
          <h3 className="showcase-card-title">{event.name}</h3>
          <p className="showcase-card-description">{event.description}</p>

          <pre className="showcase-code">
            {[
              event.reactName ? `React: ${event.reactName}` : '',
              event.vueName ? `Vue: ${event.vueName}` : '',
            ]
              .filter(Boolean)
              .join('\n')}
          </pre>
        </div>
      ))}
    </div>
  )
}
```

---

## 2.8 新增 `examples/react-showcase/src/app/demo/ThemeTokenPreview.tsx`

```tsx
export function ThemeTokenPreview(props: { tokens: string[] }) {
  if (props.tokens.length === 0) {
    return <div className="showcase-empty">No theme tokens documented yet.</div>
  }

  return (
    <div className="showcase-token-grid">
      {props.tokens.map(token => (
        <div key={token} className="showcase-token-card">
          <span className="showcase-badge">{token}</span>
          <div
            className="showcase-token-swatch"
            style={{
              background: `hsl(var(--${token}))`,
            }}
          />
        </div>
      ))}
    </div>
  )
}
```

---

## 2.9 新增 `examples/react-showcase/src/app/demo/ComponentPageScaffold.tsx`

```tsx
import {
  getShowcaseSectionDefinition,
  sortShowcaseSections,
  type ShowcaseComponent,
} from '@zeus-web/example-showcase-shared'

import { DemoGrid } from './DemoGrid'
import { DemoPage } from './DemoPage'
import { DemoSection } from './DemoSection'
import { EventLog } from './EventLog'
import { ImportSnippet } from './ImportSnippet'
import { PropTable } from './PropTable'
import { StateMatrix } from './StateMatrix'
import { ThemeTokenPreview } from './ThemeTokenPreview'

export function ComponentPageScaffold(props: { component: ShowcaseComponent }) {
  const component = props.component
  const sortedSections = sortShowcaseSections(component.sections)

  return (
    <DemoPage
      eyebrow={component.group}
      title={component.title}
      description={component.description}
      meta={
        <>
          <span className="showcase-badge">{component.name}</span>
          <span className="showcase-badge">{component.packageName}</span>
        </>
      }
    >
      <DemoSection
        title="Install and imports"
        description="Framework-specific import snippets and registry command."
      >
        <DemoGrid columns={2}>
          <ImportSnippet title="Package" value={component.packageName} />
          <ImportSnippet
            title="Registry command"
            value={component.registryCommand}
          />
          <ImportSnippet title="React" value={component.imports.react} />
          <ImportSnippet title="Vue" value={component.imports.vue} />
          <ImportSnippet
            title="Web Component"
            value={component.imports.webComponent}
          />
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="Planned sections"
        description="The full component page will be implemented using this fixed section contract."
      >
        <div className="showcase-demo-grid showcase-demo-grid-3">
          {sortedSections.map(section => {
            const definition = getShowcaseSectionDefinition(section)

            return (
              <div key={section} className="showcase-card">
                <h3 className="showcase-card-title">{definition.label}</h3>
                <p className="showcase-card-description">
                  {definition.description}
                </p>
                {definition.requiredForMvp ? (
                  <span className="showcase-badge">required</span>
                ) : null}
              </div>
            )
          })}
        </div>
      </DemoSection>

      <DemoSection
        title="States"
        description="State matrix placeholder. Real component rendering is added in later phases."
      >
        <StateMatrix states={component.states} />
      </DemoSection>

      <DemoSection
        title="Events"
        description="Event names and framework callback aliases."
      >
        <EventLog events={component.events} />
      </DemoSection>

      <DemoSection
        title="Props"
        description="Phase 3 provides the table shell. Component-specific prop rows are added later."
      >
        <PropTable rows={[]} />
      </DemoSection>

      <DemoSection
        title="Theme tokens"
        description="Semantic tokens referenced by this component metadata."
      >
        <ThemeTokenPreview tokens={component.themeTokens} />
      </DemoSection>

      <DemoSection
        title="Icon examples"
        description="Icons commonly used with this component."
      >
        {component.iconExamples.length > 0 ? (
          <div className="showcase-demo-grid showcase-demo-grid-3">
            {component.iconExamples.map(icon => (
              <div key={icon} className="showcase-card">
                <span className="showcase-badge">{icon}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="showcase-empty">No icon examples planned.</div>
        )}
      </DemoSection>

      <DemoSection
        title="Production patterns"
        description="Real-world usage scenarios that later demo pages must cover."
      >
        <div className="showcase-card">
          <ul className="showcase-list">
            {component.productionPatterns.map(pattern => (
              <li key={pattern}>{pattern}</li>
            ))}
          </ul>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 2.10 替换 `examples/react-showcase/src/routes/ComponentDetailPage.tsx`

```tsx
import { useParams } from '@tanstack/react-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import { ComponentPageScaffold } from '../app/demo/ComponentPageScaffold'

export function ComponentDetailPage() {
  const { componentName } = useParams({
    from: '/components/$componentName',
  })

  const component = showcaseComponents.find(item => item.name === componentName)

  if (!component) {
    return (
      <div className="showcase-page">
        <div className="showcase-empty">
          Component "{componentName}" is not part of the current showcase
          metadata.
        </div>
      </div>
    )
  }

  return <ComponentPageScaffold component={component} />
}
```

---

# 3. React 测试

## 3.1 新增 `examples/react-showcase/src/__tests__/demo-components.spec.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import { ComponentPageScaffold } from '../app/demo/ComponentPageScaffold'
import { EventLog } from '../app/demo/EventLog'
import { PropTable } from '../app/demo/PropTable'
import { StateMatrix } from '../app/demo/StateMatrix'
import { ThemeTokenPreview } from '../app/demo/ThemeTokenPreview'

describe('React showcase demo components', () => {
  it('renders component page scaffold from metadata', () => {
    const button = showcaseComponents.find(
      component => component.name === 'button',
    )

    expect(button).toBeTruthy()

    render(<ComponentPageScaffold component={button!} />)

    expect(screen.getByText('Button')).toBeInTheDocument()
    expect(screen.getByText('@zeus-web/button')).toBeInTheDocument()
    expect(screen.getByText('Install and imports')).toBeInTheDocument()
    expect(screen.getByText('Planned sections')).toBeInTheDocument()
    expect(screen.getByText('Production patterns')).toBeInTheDocument()
  })

  it('renders event log empty state', () => {
    render(<EventLog events={[]} />)

    expect(screen.getByText('No custom events planned.')).toBeInTheDocument()
  })

  it('renders event log rows', () => {
    render(
      <EventLog
        events={[
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Value changed.',
          },
        ]}
      />,
    )

    expect(screen.getByText('value-change')).toBeInTheDocument()
    expect(screen.getByText('Value changed.')).toBeInTheDocument()
    expect(screen.getByText(/React: onValueChange/)).toBeInTheDocument()
  })

  it('renders prop table rows', () => {
    render(
      <PropTable
        rows={[
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Disables interaction.',
          },
        ]}
      />,
    )

    expect(screen.getByText('disabled')).toBeInTheDocument()
    expect(screen.getByText('boolean')).toBeInTheDocument()
    expect(screen.getByText('Disables interaction.')).toBeInTheDocument()
  })

  it('renders state matrix and theme token preview', () => {
    render(
      <>
        <StateMatrix states={['default', 'disabled']} />
        <ThemeTokenPreview tokens={['primary', 'ring']} />
      </>,
    )

    expect(screen.getByText('default')).toBeInTheDocument()
    expect(screen.getByText('disabled')).toBeInTheDocument()
    expect(screen.getByText('primary')).toBeInTheDocument()
    expect(screen.getByText('ring')).toBeInTheDocument()
  })
})
```

---

# 4. Vue Showcase 模板组件

## 4.1 新增 `examples/vue-showcase/src/app/demo/DemoGrid.vue`

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{
    columns?: 1 | 2 | 3
  }>(),
  {
    columns: 2,
  },
)
</script>

<template>
  <div :class="`showcase-demo-grid showcase-demo-grid-${columns}`">
    <slot />
  </div>
</template>
```

---

## 4.2 新增 `examples/vue-showcase/src/app/demo/DemoSection.vue`

```vue
<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section class="showcase-demo-section">
    <header class="showcase-demo-section-header">
      <h2 class="showcase-section-title">{{ title }}</h2>
      <p v-if="description" class="showcase-card-description">
        {{ description }}
      </p>
    </header>

    <div class="showcase-demo-section-body">
      <slot />
    </div>
  </section>
</template>
```

---

## 4.3 新增 `examples/vue-showcase/src/app/demo/DemoPage.vue`

```vue
<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description: string
}>()
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p v-if="eyebrow" class="showcase-eyebrow">{{ eyebrow }}</p>
      <h1 class="showcase-title">{{ title }}</h1>
      <p class="showcase-description">{{ description }}</p>

      <div v-if="$slots.meta" class="showcase-page-meta">
        <slot name="meta" />
      </div>
    </header>

    <div class="showcase-demo-stack">
      <slot />
    </div>
  </div>
</template>
```

---

## 4.4 新增 `examples/vue-showcase/src/app/demo/ImportSnippet.vue`

```vue
<script setup lang="ts">
defineProps<{
  title: string
  value?: string
}>()
</script>

<template>
  <div class="showcase-card">
    <h3 class="showcase-card-title">{{ title }}</h3>
    <pre class="showcase-code">{{ value || 'Not planned' }}</pre>
  </div>
</template>
```

---

## 4.5 新增 `examples/vue-showcase/src/app/demo/PropTable.vue`

```vue
<script setup lang="ts">
export interface PropTableRow {
  name: string
  type: string
  defaultValue?: string
  description: string
}

defineProps<{
  rows: PropTableRow[]
}>()
</script>

<template>
  <div v-if="rows.length === 0" class="showcase-empty">
    No props documented yet.
  </div>

  <div v-else class="showcase-table-wrap">
    <table class="showcase-table">
      <thead>
        <tr>
          <th>Prop</th>
          <th>Type</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="row in rows" :key="row.name">
          <td>
            <code>{{ row.name }}</code>
          </td>
          <td>
            <code>{{ row.type }}</code>
          </td>
          <td>
            <code v-if="row.defaultValue">{{ row.defaultValue }}</code>
            <span v-else>—</span>
          </td>
          <td>{{ row.description }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

---

## 4.6 新增 `examples/vue-showcase/src/app/demo/StateMatrix.vue`

```vue
<script setup lang="ts">
defineProps<{
  states: string[]
}>()
</script>

<template>
  <div v-if="states.length === 0" class="showcase-empty">
    No states documented yet.
  </div>

  <div v-else class="showcase-state-matrix">
    <div v-for="state in states" :key="state" class="showcase-state-cell">
      <span class="showcase-badge">{{ state }}</span>
      <div class="showcase-state-preview">
        <span>{{ state }}</span>
      </div>
    </div>
  </div>
</template>
```

---

## 4.7 新增 `examples/vue-showcase/src/app/demo/EventLog.vue`

```vue
<script setup lang="ts">
import type { ShowcaseEventSpec } from '@zeus-web/example-showcase-shared'

defineProps<{
  events: ShowcaseEventSpec[]
}>()

function formatEvent(event: ShowcaseEventSpec): string {
  return [
    event.reactName ? `React: ${event.reactName}` : '',
    event.vueName ? `Vue: ${event.vueName}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
</script>

<template>
  <div v-if="events.length === 0" class="showcase-empty">
    No custom events planned.
  </div>

  <div v-else class="showcase-demo-grid showcase-demo-grid-2">
    <div v-for="event in events" :key="event.name" class="showcase-card">
      <h3 class="showcase-card-title">{{ event.name }}</h3>
      <p class="showcase-card-description">{{ event.description }}</p>
      <pre class="showcase-code">{{ formatEvent(event) }}</pre>
    </div>
  </div>
</template>
```

---

## 4.8 新增 `examples/vue-showcase/src/app/demo/ThemeTokenPreview.vue`

```vue
<script setup lang="ts">
defineProps<{
  tokens: string[]
}>()
</script>

<template>
  <div v-if="tokens.length === 0" class="showcase-empty">
    No theme tokens documented yet.
  </div>

  <div v-else class="showcase-token-grid">
    <div v-for="token in tokens" :key="token" class="showcase-token-card">
      <span class="showcase-badge">{{ token }}</span>
      <div
        class="showcase-token-swatch"
        :style="{ background: `hsl(var(--${token}))` }"
      />
    </div>
  </div>
</template>
```

---

## 4.9 新增 `examples/vue-showcase/src/app/demo/ComponentPageScaffold.vue`

```vue
<script setup lang="ts">
import {
  getShowcaseSectionDefinition,
  sortShowcaseSections,
  type ShowcaseComponent,
} from '@zeus-web/example-showcase-shared'

import DemoGrid from './DemoGrid.vue'
import DemoPage from './DemoPage.vue'
import DemoSection from './DemoSection.vue'
import EventLog from './EventLog.vue'
import ImportSnippet from './ImportSnippet.vue'
import PropTable from './PropTable.vue'
import StateMatrix from './StateMatrix.vue'
import ThemeTokenPreview from './ThemeTokenPreview.vue'

const props = defineProps<{
  component: ShowcaseComponent
}>()

const sortedSections = sortShowcaseSections(props.component.sections)
</script>

<template>
  <DemoPage
    :eyebrow="component.group"
    :title="component.title"
    :description="component.description"
  >
    <template #meta>
      <span class="showcase-badge">{{ component.name }}</span>
      <span class="showcase-badge">{{ component.packageName }}</span>
    </template>

    <DemoSection
      title="Install and imports"
      description="Framework-specific import snippets and registry command."
    >
      <DemoGrid :columns="2">
        <ImportSnippet title="Package" :value="component.packageName" />
        <ImportSnippet
          title="Registry command"
          :value="component.registryCommand"
        />
        <ImportSnippet title="React" :value="component.imports.react" />
        <ImportSnippet title="Vue" :value="component.imports.vue" />
        <ImportSnippet
          title="Web Component"
          :value="component.imports.webComponent"
        />
      </DemoGrid>
    </DemoSection>

    <DemoSection
      title="Planned sections"
      description="The full component page will be implemented using this fixed section contract."
    >
      <div class="showcase-demo-grid showcase-demo-grid-3">
        <div
          v-for="section in sortedSections"
          :key="section"
          class="showcase-card"
        >
          <h3 class="showcase-card-title">
            {{ getShowcaseSectionDefinition(section).label }}
          </h3>
          <p class="showcase-card-description">
            {{ getShowcaseSectionDefinition(section).description }}
          </p>
          <span
            v-if="getShowcaseSectionDefinition(section).requiredForMvp"
            class="showcase-badge"
          >
            required
          </span>
        </div>
      </div>
    </DemoSection>

    <DemoSection
      title="States"
      description="State matrix placeholder. Real component rendering is added in later phases."
    >
      <StateMatrix :states="component.states" />
    </DemoSection>

    <DemoSection
      title="Events"
      description="Event names and framework callback aliases."
    >
      <EventLog :events="component.events" />
    </DemoSection>

    <DemoSection
      title="Props"
      description="Phase 3 provides the table shell. Component-specific prop rows are added later."
    >
      <PropTable :rows="[]" />
    </DemoSection>

    <DemoSection
      title="Theme tokens"
      description="Semantic tokens referenced by this component metadata."
    >
      <ThemeTokenPreview :tokens="component.themeTokens" />
    </DemoSection>

    <DemoSection
      title="Icon examples"
      description="Icons commonly used with this component."
    >
      <div
        v-if="component.iconExamples.length > 0"
        class="showcase-demo-grid showcase-demo-grid-3"
      >
        <div
          v-for="icon in component.iconExamples"
          :key="icon"
          class="showcase-card"
        >
          <span class="showcase-badge">{{ icon }}</span>
        </div>
      </div>

      <div v-else class="showcase-empty">No icon examples planned.</div>
    </DemoSection>

    <DemoSection
      title="Production patterns"
      description="Real-world usage scenarios that later demo pages must cover."
    >
      <div class="showcase-card">
        <ul class="showcase-list">
          <li v-for="pattern in component.productionPatterns" :key="pattern">
            {{ pattern }}
          </li>
        </ul>
      </div>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 4.10 替换 `examples/vue-showcase/src/routes/ComponentDetailPage.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import ComponentPageScaffold from '../app/demo/ComponentPageScaffold.vue'

const route = useRoute()

const componentName = computed(() => {
  const value = route.params.componentName
  return typeof value === 'string' ? value : ''
})

const component = computed(() => {
  return showcaseComponents.find(item => item.name === componentName.value)
})
</script>

<template>
  <div v-if="!component" class="showcase-page">
    <div class="showcase-empty">
      Component "{{ componentName }}" is not part of the current showcase
      metadata.
    </div>
  </div>

  <ComponentPageScaffold v-else :component="component" />
</template>
```

---

# 5. Vue 测试

## 5.1 新增 `examples/vue-showcase/src/__tests__/demo-components.spec.ts`

```ts
import { mount } from '@vue/test-utils'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import ComponentPageScaffold from '../app/demo/ComponentPageScaffold.vue'
import EventLog from '../app/demo/EventLog.vue'
import PropTable from '../app/demo/PropTable.vue'
import StateMatrix from '../app/demo/StateMatrix.vue'
import ThemeTokenPreview from '../app/demo/ThemeTokenPreview.vue'

describe('Vue showcase demo components', () => {
  it('renders component page scaffold from metadata', () => {
    const button = showcaseComponents.find(
      component => component.name === 'button',
    )

    expect(button).toBeTruthy()

    const wrapper = mount(ComponentPageScaffold, {
      props: {
        component: button!,
      },
    })

    expect(wrapper.text()).toContain('Button')
    expect(wrapper.text()).toContain('@zeus-web/button')
    expect(wrapper.text()).toContain('Install and imports')
    expect(wrapper.text()).toContain('Planned sections')
    expect(wrapper.text()).toContain('Production patterns')
  })

  it('renders event log empty state', () => {
    const wrapper = mount(EventLog, {
      props: {
        events: [],
      },
    })

    expect(wrapper.text()).toContain('No custom events planned.')
  })

  it('renders event log rows', () => {
    const wrapper = mount(EventLog, {
      props: {
        events: [
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Value changed.',
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('value-change')
    expect(wrapper.text()).toContain('Value changed.')
    expect(wrapper.text()).toContain('React: onValueChange')
  })

  it('renders prop table rows', () => {
    const wrapper = mount(PropTable, {
      props: {
        rows: [
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Disables interaction.',
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('disabled')
    expect(wrapper.text()).toContain('boolean')
    expect(wrapper.text()).toContain('Disables interaction.')
  })

  it('renders state matrix and theme token preview', () => {
    const stateMatrix = mount(StateMatrix, {
      props: {
        states: ['default', 'disabled'],
      },
    })

    const tokenPreview = mount(ThemeTokenPreview, {
      props: {
        tokens: ['primary', 'ring'],
      },
    })

    expect(stateMatrix.text()).toContain('default')
    expect(stateMatrix.text()).toContain('disabled')
    expect(tokenPreview.text()).toContain('primary')
    expect(tokenPreview.text()).toContain('ring')
  })
})
```

---

# 6. CSS 追加

React 和 Vue 两边都追加同一段。

## 6.1 追加到 `examples/react-showcase/src/app.css`

## 6.2 追加到 `examples/vue-showcase/src/app.css`

```css
.showcase-page-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.showcase-demo-stack {
  display: grid;
  gap: 1.25rem;
}

.showcase-demo-section {
  border: 1px solid hsl(var(--border));
  border-radius: 1.15rem;
  background: hsl(var(--background) / 0.5);
  padding: 1rem;
}

.showcase-demo-section-header {
  margin-bottom: 1rem;
}

.showcase-demo-section-body {
  min-width: 0;
}

.showcase-demo-grid {
  display: grid;
  gap: 1rem;
}

.showcase-demo-grid-1 {
  grid-template-columns: 1fr;
}

.showcase-demo-grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.showcase-demo-grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.showcase-table-wrap {
  overflow-x: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 0.85rem;
}

.showcase-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.showcase-table th,
.showcase-table td {
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.75rem;
  text-align: left;
  vertical-align: top;
}

.showcase-table th {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-weight: 700;
}

.showcase-table tr:last-child td {
  border-bottom: 0;
}

.showcase-table code {
  border-radius: 0.35rem;
  background: hsl(var(--muted));
  padding: 0.15rem 0.35rem;
  font-size: 0.8125rem;
}

.showcase-state-matrix {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.showcase-state-cell {
  display: grid;
  gap: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.85rem;
  background: hsl(var(--card));
  padding: 0.85rem;
}

.showcase-state-preview {
  display: grid;
  min-height: 4rem;
  place-items: center;
  border-radius: 0.65rem;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.showcase-token-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.showcase-token-card {
  display: grid;
  gap: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.85rem;
  background: hsl(var(--card));
  padding: 0.85rem;
}

.showcase-token-swatch {
  height: 3.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.65rem;
}

@media (max-width: 900px) {
  .showcase-demo-grid-2,
  .showcase-demo-grid-3,
  .showcase-state-matrix,
  .showcase-token-grid {
    grid-template-columns: 1fr;
  }
}
```

---

# 7. 需要修改现有测试断言吗？

React/Vue 原有 router 测试里如果断言 `@zeus-web/button`、`zweb add button`，仍然能通过，因为新 Scaffold 仍然展示这些内容。

如果某些测试依赖旧页面的具体标题，比如 `Theme tokens`、`Production patterns`，也仍然存在。

---

# 8. 验收命令

```bash
pnpm --filter @zeus-web/example-showcase-shared check
pnpm --filter @zeus-web/example-showcase-shared test

pnpm --filter @zeus-web/example-react-showcase check
pnpm --filter @zeus-web/example-react-showcase test
pnpm --filter @zeus-web/example-react-showcase build

pnpm --filter @zeus-web/example-vue-showcase check
pnpm --filter @zeus-web/example-vue-showcase test
pnpm --filter @zeus-web/example-vue-showcase build

pnpm showcase:test
pnpm showcase:build
pnpm examples:check
pnpm examples:build
pnpm site:check
```

完整验收：

```bash
pnpm format-check
pnpm lint
pnpm test
pnpm check
pnpm build
pnpm check:component-coverage
pnpm check:showcase-metadata
pnpm examples:check
pnpm examples:build
pnpm showcase:test
pnpm showcase:build
pnpm site:check
pnpm release:verify --allow-zero
```

---

# 9. Phase 3 完成标准

```txt
Phase 3 done 当且仅当：

1. showcase-shared 提供 demo section definitions。
2. React 有 DemoPage / DemoSection / DemoGrid / ImportSnippet / PropTable / StateMatrix / EventLog / ThemeTokenPreview。
3. Vue 有对应同名能力组件。
4. React ComponentDetailPage 使用 ComponentPageScaffold。
5. Vue ComponentDetailPage 使用 ComponentPageScaffold。
6. React demo-components.spec.tsx 通过。
7. Vue demo-components.spec.ts 通过。
8. 原有 router tests 仍通过。
9. showcase:test 通过。
10. showcase:build 通过。
```

---

# 10. 建议提交

```txt
feat(examples): add showcase page template components
```

---

# 11. 下一阶段建议

Phase 4 不建议一次性把 20 个组件都做满。建议先做 P0 六个组件：

```txt
button
input
checkbox
switch
tabs
dialog
```

每个组件真实页开始替换当前 Scaffold 中的 placeholder：

```txt
basic
variants
states
controlled
uncontrolled
events
icons
theme
accessibility
production
```

Phase 3 完成后，Phase 4 就可以开始按组件页逐个填真实示例，不会再重复写页面外壳。
