下面是 **Phase 4：P0 六个组件真实能力页** 的详细设计与完整代码。
输出格式按 **目标 → 文件清单 → 代码 → 验收命令 → 提交信息** 组织。

Phase 4 覆盖：

```txt
button
input
checkbox
switch
tabs
dialog
```

这六个组件在源码里已经有明确 props/events。比如 Button 有 `variant / size / disabled / loading / pressed` 和 `press` 事件。
Input 有 `value / defaultValue / type / size / invalid / formatter`，并有 `valueChange / focusChange`。
Checkbox 和 Switch 都有 `checked / defaultChecked / disabled / invalid`，并有 `checkedChange / focusChange`。
Tabs 有 root/list/trigger/content 组合和 `valueChange` 事件。
Dialog 有 root/trigger/content/close/title/description 组合和 `openChange` 事件。

---

## 1. Phase 4 目标

```txt
目标：
1. React Showcase 接入 P0 六个真实组件能力页。
2. Vue Showcase 接入 P0 六个真实组件能力页。
3. 组件详情页优先渲染真实 demo，未实现的组件继续使用 Phase 3 Scaffold。
4. 每个 P0 页至少覆盖：
   - Basic
   - Variants / sizes / states
   - Controlled
   - Uncontrolled
   - Events
   - Theme tokens
   - Production pattern
5. showcase build/test 前自动构建 P0 primitive packages。
6. 新增基础测试验证 P0 demo registry 已接入。
```

---

## 2. 修改文件清单

```txt
examples/react-showcase/package.json
examples/react-showcase/src/routes/ComponentDetailPage.tsx
examples/react-showcase/src/demos/p0/event-utils.ts
examples/react-showcase/src/demos/p0/index.ts
examples/react-showcase/src/demos/p0/ButtonDemoPage.tsx
examples/react-showcase/src/demos/p0/InputDemoPage.tsx
examples/react-showcase/src/demos/p0/CheckboxDemoPage.tsx
examples/react-showcase/src/demos/p0/SwitchDemoPage.tsx
examples/react-showcase/src/demos/p0/TabsDemoPage.tsx
examples/react-showcase/src/demos/p0/DialogDemoPage.tsx
examples/react-showcase/src/__tests__/p0-demos.spec.tsx
examples/react-showcase/src/app.css

examples/vue-showcase/package.json
examples/vue-showcase/src/routes/ComponentDetailPage.vue
examples/vue-showcase/src/demos/p0/index.ts
examples/vue-showcase/src/demos/p0/event-utils.ts
examples/vue-showcase/src/demos/p0/ButtonDemoPage.vue
examples/vue-showcase/src/demos/p0/InputDemoPage.vue
examples/vue-showcase/src/demos/p0/CheckboxDemoPage.vue
examples/vue-showcase/src/demos/p0/SwitchDemoPage.vue
examples/vue-showcase/src/demos/p0/TabsDemoPage.vue
examples/vue-showcase/src/demos/p0/DialogDemoPage.vue
examples/vue-showcase/src/__tests__/p0-demos.spec.ts
examples/vue-showcase/src/app.css
```

---

# 3. React Showcase 修改

## 3.1 `examples/react-showcase/package.json`

```json
{
  "name": "@zeus-web/example-react-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build:deps": "pnpm -w --filter @zeus-web/icons --filter @zeus-web/button --filter @zeus-web/input --filter @zeus-web/checkbox --filter @zeus-web/switch --filter @zeus-web/tabs --filter @zeus-web/dialog build",
    "dev": "pnpm build:deps && vite --host 0.0.0.0",
    "build": "pnpm build:deps && vite build",
    "check": "pnpm build:deps && tsc -p tsconfig.json --noEmit",
    "test": "pnpm build:deps && vitest --run"
  },
  "dependencies": {
    "@tanstack/react-router": "^1.114.0",
    "@zeus-web/button": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/example-showcase-shared": "workspace:*",
    "@zeus-web/icons": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.2",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vite": "^8.0.16",
    "vitest": "^4.1.8"
  }
}
```

---

## 3.2 `examples/react-showcase/src/demos/p0/event-utils.ts`

```ts
import { useCallback, useState } from 'react'

export interface DemoEventRecord {
  id: number
  name: string
  detail?: string
}

export function useDemoEventLog() {
  const [records, setRecords] = useState<DemoEventRecord[]>([])

  const log = useCallback((name: string, detail?: unknown) => {
    setRecords(current => [
      {
        id: Date.now() + Math.random(),
        name,
        detail:
          detail === undefined
            ? undefined
            : typeof detail === 'string'
              ? detail
              : JSON.stringify(detail),
      },
      ...current,
    ])
  }, [])

  const clear = useCallback(() => {
    setRecords([])
  }, [])

  return {
    records,
    log,
    clear,
  }
}

export function readDetailValue(event: unknown, fallback = ''): string {
  const payload = readPayload(event)
  const value = payload?.value

  return typeof value === 'string' ? value : fallback
}

export function readDetailChecked(event: unknown, fallback = false): boolean {
  const payload = readPayload(event)
  const checked = payload?.checked

  return typeof checked === 'boolean' ? checked : fallback
}

export function readDetailOpen(event: unknown, fallback = false): boolean {
  const payload = readPayload(event)
  const open = payload?.open

  return typeof open === 'boolean' ? open : fallback
}

function readPayload(event: unknown): Record<string, unknown> | undefined {
  if (!event || typeof event !== 'object') return undefined

  const maybeEvent = event as {
    detail?: unknown
    target?: {
      value?: unknown
      checked?: unknown
    }
    value?: unknown
    checked?: unknown
    open?: unknown
  }

  if (maybeEvent.detail && typeof maybeEvent.detail === 'object') {
    return maybeEvent.detail as Record<string, unknown>
  }

  if (maybeEvent.target) {
    return maybeEvent.target as Record<string, unknown>
  }

  return maybeEvent as Record<string, unknown>
}
```

---

## 3.3 `examples/react-showcase/src/demos/p0/index.ts`

```ts
import type { ComponentType } from 'react'

import { ButtonDemoPage } from './ButtonDemoPage'
import { CheckboxDemoPage } from './CheckboxDemoPage'
import { DialogDemoPage } from './DialogDemoPage'
import { InputDemoPage } from './InputDemoPage'
import { SwitchDemoPage } from './SwitchDemoPage'
import { TabsDemoPage } from './TabsDemoPage'

export const p0ReactDemoPages: Record<string, ComponentType> = {
  button: ButtonDemoPage,
  input: InputDemoPage,
  checkbox: CheckboxDemoPage,
  switch: SwitchDemoPage,
  tabs: TabsDemoPage,
  dialog: DialogDemoPage,
}

export const p0ReactDemoNames = Object.keys(p0ReactDemoPages)
```

---

## 3.4 `examples/react-showcase/src/routes/ComponentDetailPage.tsx`

```tsx
import { useParams } from '@tanstack/react-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import { ComponentPageScaffold } from '../app/demo/ComponentPageScaffold'
import { p0ReactDemoPages } from '../demos/p0'

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

  const P0DemoPage = p0ReactDemoPages[component.name]

  if (P0DemoPage) {
    return <P0DemoPage />
  }

  return <ComponentPageScaffold component={component} />
}
```

---

## 3.5 `examples/react-showcase/src/demos/p0/ButtonDemoPage.tsx`

```tsx
import { Button } from '@zeus-web/button/react'
import {
  CheckIcon,
  LoaderIcon,
  PlusIcon,
  TrashIcon,
} from '@zeus-web/icons/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { useDemoEventLog } from './event-utils'

export function ButtonDemoPage() {
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Actions"
      title="Button capability page"
      description="Tests Button variants, sizes, states, icon slots, press events and production usage."
      meta={
        <>
          <span className="showcase-badge">button</span>
          <span className="showcase-badge">@zeus-web/button/react</span>
        </>
      }
    >
      <DemoSection title="Basic" description="Default button usage.">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <Button onPress={() => events.log('press', 'Default button')}>
              Default button
            </Button>
          </div>
          <div className="showcase-demo-card">
            <Button
              variant="primary"
              onPress={() => events.log('press', 'Primary CTA')}
            >
              Primary CTA
            </Button>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Variants" description="Semantic visual variants.">
        <DemoGrid columns={3}>
          {(
            [
              'default',
              'primary',
              'secondary',
              'outline',
              'ghost',
              'danger',
            ] as const
          ).map(variant => (
            <div key={variant} className="showcase-demo-card">
              <Button
                variant={variant}
                onPress={() => events.log('press', variant)}
              >
                {variant}
              </Button>
            </div>
          ))}
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="Sizes"
        description="Size presets including icon-only."
      >
        <DemoGrid columns={3}>
          <div className="showcase-demo-card">
            <Button size="sm">Small</Button>
          </div>
          <div className="showcase-demo-card">
            <Button size="md">Medium</Button>
          </div>
          <div className="showcase-demo-card">
            <Button size="lg">Large</Button>
          </div>
          <div className="showcase-demo-card">
            <Button size="icon" ariaLabel="Add item">
              <PlusIcon slot="prefix" width="16" height="16" />
            </Button>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="States"
        description="Disabled, loading and pressed states."
      >
        <DemoGrid columns={3}>
          <div className="showcase-demo-card">
            <Button disabled>Disabled</Button>
          </div>
          <div className="showcase-demo-card">
            <Button loading>
              <LoaderIcon slot="prefix" width="16" height="16" />
              Loading
            </Button>
          </div>
          <div className="showcase-demo-card">
            <Button pressed>Pressed</Button>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="With icons"
        description="Prefix and suffix slot composition."
      >
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <Button variant="primary">
              <CheckIcon slot="prefix" width="16" height="16" />
              Confirm
            </Button>
          </div>
          <div className="showcase-demo-card">
            <Button variant="danger">
              Delete
              <TrashIcon slot="suffix" width="16" height="16" />
            </Button>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events" description="Press event log.">
        <EventLog
          events={[
            {
              name: 'press',
              reactName: 'onPress',
              vueName: 'press',
              description: 'Emitted when the button is activated.',
            },
          ]}
        />

        <div className="showcase-event-feed">
          {events.records.length === 0 ? (
            <div className="showcase-empty">
              Click a button to record events.
            </div>
          ) : (
            events.records.map(record => (
              <div key={record.id} className="showcase-event-record">
                <strong>{record.name}</strong>
                {record.detail ? <span>{record.detail}</span> : null}
              </div>
            ))
          )}
        </div>
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={[
            'primary',
            'primary-foreground',
            'ring',
            'border',
            'destructive',
          ]}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-production-row">
          <Button variant="outline">Cancel</Button>
          <Button variant="primary">Save changes</Button>
          <Button variant="danger">
            <TrashIcon slot="prefix" width="16" height="16" />
            Delete project
          </Button>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 3.6 `examples/react-showcase/src/demos/p0/InputDemoPage.tsx`

```tsx
import { Input } from '@zeus-web/input/react'
import { EyeIcon, SearchIcon } from '@zeus-web/icons/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from './event-utils'

export function InputDemoPage() {
  const [value, setValue] = useState('zeus')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Input capability page"
      description="Tests Input types, sizes, controlled value, formatter, focus events and validation states."
      meta={
        <>
          <span className="showcase-badge">input</span>
          <span className="showcase-badge">@zeus-web/input/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <Input placeholder="Email address" type="email" />
          </div>
          <div className="showcase-demo-card">
            <Input defaultValue="Default value" />
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Types and sizes">
        <DemoGrid columns={3}>
          <Input size="sm" placeholder="Small search" type="search" />
          <Input size="md" placeholder="Medium email" type="email" />
          <Input size="lg" placeholder="Large password" type="password" />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="States">
        <DemoGrid columns={3}>
          <Input disabled placeholder="Disabled" />
          <Input readonly value="Readonly" />
          <Input invalid ariaErrormessage="input-error" placeholder="Invalid" />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <Input
              value={value}
              placeholder="Controlled input"
              onValueChange={(event: unknown) => {
                const next = readDetailValue(event, value)
                setValue(next)
                events.log('value-change', { value: next })
              }}
              onFocusChange={(event: unknown) => {
                events.log('focus-change', event)
              }}
            />
          </div>
          <div className="showcase-demo-card">
            <strong>Current value</strong>
            <pre className="showcase-code">{value}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="With icons">
        <DemoGrid columns={2}>
          <Input placeholder="Search docs">
            <SearchIcon slot="prefix" width="16" height="16" />
          </Input>

          <Input type="password" placeholder="Password">
            <EyeIcon slot="suffix" width="16" height="16" />
          </Input>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Formatter">
        <Input
          placeholder="Uppercase formatter"
          formatter={(input: string) => input.toUpperCase()}
          onValueChange={(event: unknown) => {
            events.log('formatted-value-change', {
              value: readDetailValue(event),
            })
          }}
        />
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'value-change',
              reactName: 'onValueChange',
              vueName: 'value-change',
              description: 'Emitted when input value changes.',
            },
            {
              name: 'focus-change',
              reactName: 'onFocusChange',
              vueName: 'focus-change',
              description: 'Emitted when focus state changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['input', 'ring', 'muted-foreground', 'destructive']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <label className="showcase-field">
            <span>Project name</span>
            <Input placeholder="observability-platform" required />
          </label>
          <label className="showcase-field">
            <span>Search members</span>
            <Input placeholder="Search by email">
              <SearchIcon slot="prefix" width="16" height="16" />
            </Input>
          </label>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 3.7 `examples/react-showcase/src/demos/p0/CheckboxDemoPage.tsx`

```tsx
import { Checkbox } from '@zeus-web/checkbox/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailChecked, useDemoEventLog } from './event-utils'

export function CheckboxDemoPage() {
  const [checked, setChecked] = useState(true)
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Checkbox capability page"
      description="Tests checked, defaultChecked, indeterminate, disabled, invalid and checkedChange."
      meta={
        <>
          <span className="showcase-badge">checkbox</span>
          <span className="showcase-badge">@zeus-web/checkbox/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={3}>
          <Checkbox>Accept terms</Checkbox>
          <Checkbox defaultChecked>Default checked</Checkbox>
          <Checkbox indeterminate>Indeterminate</Checkbox>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes and states">
        <DemoGrid columns={3}>
          <Checkbox size="sm">Small</Checkbox>
          <Checkbox size="md">Medium</Checkbox>
          <Checkbox size="lg">Large</Checkbox>
          <Checkbox disabled>Disabled</Checkbox>
          <Checkbox invalid>Invalid</Checkbox>
          <Checkbox required>Required</Checkbox>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Checkbox
            checked={checked}
            onCheckedChange={(event: unknown) => {
              const next = readDetailChecked(event, checked)
              setChecked(next)
              events.log('checked-change', { checked: next })
            }}
          >
            Controlled checkbox
          </Checkbox>

          <div className="showcase-demo-card">
            <strong>Checked</strong>
            <pre className="showcase-code">{String(checked)}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'checked-change',
              reactName: 'onCheckedChange',
              vueName: 'checked-change',
              description: 'Emitted when checked state changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['primary', 'primary-foreground', 'ring']} />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <Checkbox defaultChecked>Enable product analytics</Checkbox>
          <Checkbox>Send weekly summary email</Checkbox>
          <Checkbox invalid required>
            I understand this destructive action
          </Checkbox>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 3.8 `examples/react-showcase/src/demos/p0/SwitchDemoPage.tsx`

```tsx
import { Switch } from '@zeus-web/switch/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailChecked, useDemoEventLog } from './event-utils'

export function SwitchDemoPage() {
  const [checked, setChecked] = useState(false)
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Switch capability page"
      description="Tests switch on/off states, sizes, controlled usage and checkedChange events."
      meta={
        <>
          <span className="showcase-badge">switch</span>
          <span className="showcase-badge">@zeus-web/switch/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={3}>
          <Switch>Notifications</Switch>
          <Switch defaultChecked>Enabled</Switch>
          <Switch disabled>Disabled</Switch>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes and states">
        <DemoGrid columns={3}>
          <Switch size="sm">Small</Switch>
          <Switch size="md">Medium</Switch>
          <Switch size="lg">Large</Switch>
          <Switch invalid>Invalid</Switch>
          <Switch required>Required</Switch>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Switch
            checked={checked}
            onCheckedChange={(event: unknown) => {
              const next = readDetailChecked(event, checked)
              setChecked(next)
              events.log('checked-change', { checked: next })
            }}
          >
            Controlled switch
          </Switch>

          <div className="showcase-demo-card">
            <strong>Enabled</strong>
            <pre className="showcase-code">{String(checked)}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'checked-change',
              reactName: 'onCheckedChange',
              vueName: 'checked-change',
              description: 'Emitted when checked state changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['primary', 'input', 'ring']} />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <Switch defaultChecked>Enable dark mode</Switch>
          <Switch>Send deployment alerts</Switch>
          <Switch defaultChecked>Auto-refresh dashboard</Switch>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 3.9 `examples/react-showcase/src/demos/p0/TabsDemoPage.tsx`

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zeus-web/tabs/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from './event-utils'

export function TabsDemoPage() {
  const [value, setValue] = useState('overview')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Navigation"
      title="Tabs capability page"
      description="Tests tab orientation, controlled value, disabled triggers and valueChange events."
      meta={
        <>
          <span className="showcase-badge">tabs</span>
          <span className="showcase-badge">@zeus-web/tabs/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="showcase-demo-card">Overview panel</div>
          </TabsContent>
          <TabsContent value="usage">
            <div className="showcase-demo-card">Usage panel</div>
          </TabsContent>
          <TabsContent value="api">
            <div className="showcase-demo-card">API panel</div>
          </TabsContent>
        </Tabs>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Tabs
            value={value}
            onValueChange={(event: unknown) => {
              const next = readDetailValue(event, value)
              setValue(next)
              events.log('value-change', { value: next })
            }}
          >
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="showcase-demo-card">Overview settings</div>
            </TabsContent>
            <TabsContent value="billing">
              <div className="showcase-demo-card">Billing settings</div>
            </TabsContent>
            <TabsContent value="security">
              <div className="showcase-demo-card">Security settings</div>
            </TabsContent>
          </Tabs>

          <div className="showcase-demo-card">
            <strong>Active tab</strong>
            <pre className="showcase-code">{value}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Vertical and disabled">
        <Tabs defaultValue="profile" orientation="vertical">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="disabled" disabled>
              Disabled
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="showcase-demo-card">Profile panel</div>
          </TabsContent>
          <TabsContent value="team">
            <div className="showcase-demo-card">Team panel</div>
          </TabsContent>
        </Tabs>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'value-change',
              reactName: 'onValueChange',
              vueName: 'value-change',
              description: 'Emitted when active tab changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['muted', 'muted-foreground', 'ring']} />
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 3.10 `examples/react-showcase/src/demos/p0/DialogDemoPage.tsx`

```tsx
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@zeus-web/dialog/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailOpen, useDemoEventLog } from './event-utils'

export function DialogDemoPage() {
  const [open, setOpen] = useState(false)
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Feedback"
      title="Dialog capability page"
      description="Tests dialog trigger, content, title, description, close, controlled open and openChange events."
      meta={
        <>
          <span className="showcase-badge">dialog</span>
          <span className="showcase-badge">@zeus-web/dialog/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <Dialog>
          <DialogTrigger>Open basic dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Basic dialog</DialogTitle>
            <DialogDescription>
              This dialog is opened with an uncontrolled trigger.
            </DialogDescription>
            <div className="showcase-demo-card">Dialog body content</div>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Dialog
            open={open}
            onOpenChange={(event: unknown) => {
              const next = readDetailOpen(event, open)
              setOpen(next)
              events.log('open-change', { open: next })
            }}
          >
            <DialogTrigger>Open controlled dialog</DialogTrigger>
            <DialogContent>
              <DialogTitle>Controlled dialog</DialogTitle>
              <DialogDescription>
                Open state is synchronized with React state.
              </DialogDescription>
              <DialogClose>Close controlled dialog</DialogClose>
            </DialogContent>
          </Dialog>

          <div className="showcase-demo-card">
            <strong>Open</strong>
            <pre className="showcase-code">{String(open)}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="States">
        <DemoGrid columns={2}>
          <Dialog defaultOpen>
            <DialogContent forceMount>
              <DialogTitle>Default open</DialogTitle>
              <DialogDescription>Rendered initially open.</DialogDescription>
              <DialogClose>Close</DialogClose>
            </DialogContent>
          </Dialog>

          <Dialog modal={false}>
            <DialogTrigger>Open non-modal dialog</DialogTrigger>
            <DialogContent>
              <DialogTitle>Non-modal dialog</DialogTitle>
              <DialogDescription>Modal behavior disabled.</DialogDescription>
              <DialogClose>Close</DialogClose>
            </DialogContent>
          </Dialog>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'open-change',
              reactName: 'onOpenChange',
              vueName: 'open-change',
              description: 'Emitted when open state changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['background', 'foreground', 'ring', 'border']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <Dialog>
          <DialogTrigger>Create project</DialogTrigger>
          <DialogContent>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              This production pattern will include a full form in a later phase.
            </DialogDescription>
            <div className="showcase-demo-card">Project form placeholder</div>
            <DialogClose>Cancel</DialogClose>
          </DialogContent>
        </Dialog>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 3.11 `examples/react-showcase/src/__tests__/p0-demos.spec.tsx`

```tsx
import { render, screen } from '@testing-library/react'

import { p0ReactDemoNames, p0ReactDemoPages } from '../demos/p0'

describe('React P0 showcase demos', () => {
  it('registers the six P0 demo pages', () => {
    expect(p0ReactDemoNames.sort()).toEqual([
      'button',
      'checkbox',
      'dialog',
      'input',
      'switch',
      'tabs',
    ])
  })

  it.each(p0ReactDemoNames)('renders %s demo page', name => {
    const DemoPage = p0ReactDemoPages[name]

    render(<DemoPage />)

    expect(screen.getByText(new RegExp(`${name}`, 'i'))).toBeInTheDocument()
    expect(screen.getByText(/capability page/i)).toBeInTheDocument()
  })
})
```

---

# 4. Vue Showcase 修改

## 4.1 `examples/vue-showcase/package.json`

```json
{
  "name": "@zeus-web/example-vue-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build:deps": "pnpm -w --filter @zeus-web/button --filter @zeus-web/input --filter @zeus-web/checkbox --filter @zeus-web/switch --filter @zeus-web/tabs --filter @zeus-web/dialog build",
    "dev": "pnpm build:deps && vite --host 0.0.0.0 --port 5174",
    "build": "pnpm build:deps && vite build",
    "check": "pnpm build:deps && vue-tsc -p tsconfig.json --noEmit",
    "test": "pnpm build:deps && vitest --run"
  },
  "dependencies": {
    "@zeus-web/button": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/example-showcase-shared": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "vue": "^3.5.35",
    "vue-router": "^4.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.0",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vite": "^8.0.16",
    "vitest": "^4.1.8",
    "vue-tsc": "^3.1.0"
  }
}
```

---

## 4.2 `examples/vue-showcase/src/demos/p0/event-utils.ts`

```ts
import { ref } from 'vue'

export interface DemoEventRecord {
  id: number
  name: string
  detail?: string
}

export function useDemoEventLog() {
  const records = ref<DemoEventRecord[]>([])

  function log(name: string, detail?: unknown) {
    records.value = [
      {
        id: Date.now() + Math.random(),
        name,
        detail:
          detail === undefined
            ? undefined
            : typeof detail === 'string'
              ? detail
              : JSON.stringify(detail),
      },
      ...records.value,
    ]
  }

  function clear() {
    records.value = []
  }

  return {
    records,
    log,
    clear,
  }
}

export function readDetailValue(event: unknown, fallback = ''): string {
  const payload = readPayload(event)
  const value = payload?.value

  return typeof value === 'string' ? value : fallback
}

export function readDetailChecked(event: unknown, fallback = false): boolean {
  const payload = readPayload(event)
  const checked = payload?.checked

  return typeof checked === 'boolean' ? checked : fallback
}

export function readDetailOpen(event: unknown, fallback = false): boolean {
  const payload = readPayload(event)
  const open = payload?.open

  return typeof open === 'boolean' ? open : fallback
}

function readPayload(event: unknown): Record<string, unknown> | undefined {
  if (!event || typeof event !== 'object') return undefined

  const maybeEvent = event as {
    detail?: unknown
    target?: {
      value?: unknown
      checked?: unknown
    }
    value?: unknown
    checked?: unknown
    open?: unknown
  }

  if (maybeEvent.detail && typeof maybeEvent.detail === 'object') {
    return maybeEvent.detail as Record<string, unknown>
  }

  if (maybeEvent.target) {
    return maybeEvent.target as Record<string, unknown>
  }

  return maybeEvent as Record<string, unknown>
}
```

---

## 4.3 `examples/vue-showcase/src/demos/p0/index.ts`

```ts
import type { Component } from 'vue'

import ButtonDemoPage from './ButtonDemoPage.vue'
import CheckboxDemoPage from './CheckboxDemoPage.vue'
import DialogDemoPage from './DialogDemoPage.vue'
import InputDemoPage from './InputDemoPage.vue'
import SwitchDemoPage from './SwitchDemoPage.vue'
import TabsDemoPage from './TabsDemoPage.vue'

export const p0VueDemoPages: Record<string, Component> = {
  button: ButtonDemoPage,
  input: InputDemoPage,
  checkbox: CheckboxDemoPage,
  switch: SwitchDemoPage,
  tabs: TabsDemoPage,
  dialog: DialogDemoPage,
}

export const p0VueDemoNames = Object.keys(p0VueDemoPages)
```

---

## 4.4 `examples/vue-showcase/src/routes/ComponentDetailPage.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import ComponentPageScaffold from '../app/demo/ComponentPageScaffold.vue'
import { p0VueDemoPages } from '../demos/p0'

const route = useRoute()

const componentName = computed(() => {
  const value = route.params.componentName
  return typeof value === 'string' ? value : ''
})

const component = computed(() => {
  return showcaseComponents.find(item => item.name === componentName.value)
})

const P0DemoPage = computed(() => {
  return component.value ? p0VueDemoPages[component.value.name] : undefined
})
</script>

<template>
  <div v-if="!component" class="showcase-page">
    <div class="showcase-empty">
      Component "{{ componentName }}" is not part of the current showcase
      metadata.
    </div>
  </div>

  <component :is="P0DemoPage" v-else-if="P0DemoPage" />

  <ComponentPageScaffold v-else :component="component" />
</template>
```

---

## 4.5 `examples/vue-showcase/src/demos/p0/ButtonDemoPage.vue`

```vue
<script setup lang="ts">
import { Button } from '@zeus-web/button/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { useDemoEventLog } from './event-utils'

const events = useDemoEventLog()

const variants = [
  'default',
  'primary',
  'secondary',
  'outline',
  'ghost',
  'danger',
] as const
</script>

<template>
  <DemoPage
    eyebrow="Actions"
    title="Button capability page"
    description="Tests Button variants, sizes, states, icon slots, press events and production usage."
  >
    <template #meta>
      <span class="showcase-badge">button</span>
      <span class="showcase-badge">@zeus-web/button/vue</span>
    </template>

    <DemoSection title="Basic" description="Default button usage.">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <Button @press="events.log('press', 'Default button')">
            Default button
          </Button>
        </div>
        <div class="showcase-demo-card">
          <Button variant="primary" @press="events.log('press', 'Primary CTA')">
            Primary CTA
          </Button>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Variants" description="Semantic visual variants.">
      <DemoGrid :columns="3">
        <div
          v-for="variant in variants"
          :key="variant"
          class="showcase-demo-card"
        >
          <Button :variant="variant" @press="events.log('press', variant)">
            {{ variant }}
          </Button>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes">
      <DemoGrid :columns="3">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Add item">+</Button>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="3">
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
        <Button pressed>Pressed</Button>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'press',
            reactName: 'onPress',
            vueName: 'press',
            description: 'Emitted when the button is activated.',
          },
        ]"
      />

      <div class="showcase-event-feed">
        <div v-if="events.records.value.length === 0" class="showcase-empty">
          Click a button to record events.
        </div>

        <div
          v-for="record in events.records.value"
          v-else
          :key="record.id"
          class="showcase-event-record"
        >
          <strong>{{ record.name }}</strong>
          <span v-if="record.detail">{{ record.detail }}</span>
        </div>
      </div>
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="[
          'primary',
          'primary-foreground',
          'ring',
          'border',
          'destructive',
        ]"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card showcase-production-row">
        <Button variant="outline">Cancel</Button>
        <Button variant="primary">Save changes</Button>
        <Button variant="danger">Delete project</Button>
      </div>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 4.6 `examples/vue-showcase/src/demos/p0/InputDemoPage.vue`

```vue
<script setup lang="ts">
import { Input } from '@zeus-web/input/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from './event-utils'

const value = ref('zeus')
const events = useDemoEventLog()

function handleValueChange(event: unknown) {
  const next = readDetailValue(event, value.value)
  value.value = next
  events.log('value-change', { value: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Forms"
    title="Input capability page"
    description="Tests Input types, sizes, controlled value, formatter, focus events and validation states."
  >
    <template #meta>
      <span class="showcase-badge">input</span>
      <span class="showcase-badge">@zeus-web/input/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="2">
        <Input placeholder="Email address" type="email" />
        <Input default-value="Default value" />
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Types and sizes">
      <DemoGrid :columns="3">
        <Input size="sm" placeholder="Small search" type="search" />
        <Input size="md" placeholder="Medium email" type="email" />
        <Input size="lg" placeholder="Large password" type="password" />
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="3">
        <Input disabled placeholder="Disabled" />
        <Input readonly value="Readonly" />
        <Input invalid aria-errormessage="input-error" placeholder="Invalid" />
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <Input
            :value="value"
            placeholder="Controlled input"
            @value-change="handleValueChange"
            @focus-change="events.log('focus-change', $event)"
          />
        </div>

        <div class="showcase-demo-card">
          <strong>Current value</strong>
          <pre class="showcase-code">{{ value }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Formatter">
      <Input
        placeholder="Uppercase formatter"
        :formatter="(input: string) => input.toUpperCase()"
        @value-change="
          events.log('formatted-value-change', {
            value: readDetailValue($event),
          })
        "
      />
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Emitted when input value changes.',
          },
          {
            name: 'focus-change',
            reactName: 'onFocusChange',
            vueName: 'focus-change',
            description: 'Emitted when focus state changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['input', 'ring', 'muted-foreground', 'destructive']"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <label class="showcase-field">
          <span>Project name</span>
          <Input placeholder="observability-platform" required />
        </label>

        <label class="showcase-field">
          <span>Search members</span>
          <Input placeholder="Search by email" type="search" />
        </label>
      </div>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 4.7 `examples/vue-showcase/src/demos/p0/CheckboxDemoPage.vue`

```vue
<script setup lang="ts">
import { Checkbox } from '@zeus-web/checkbox/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailChecked, useDemoEventLog } from './event-utils'

const checked = ref(true)
const events = useDemoEventLog()

function handleCheckedChange(event: unknown) {
  const next = readDetailChecked(event, checked.value)
  checked.value = next
  events.log('checked-change', { checked: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Forms"
    title="Checkbox capability page"
    description="Tests checked, defaultChecked, indeterminate, disabled, invalid and checkedChange."
  >
    <template #meta>
      <span class="showcase-badge">checkbox</span>
      <span class="showcase-badge">@zeus-web/checkbox/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="3">
        <Checkbox>Accept terms</Checkbox>
        <Checkbox default-checked>Default checked</Checkbox>
        <Checkbox indeterminate>Indeterminate</Checkbox>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes and states">
      <DemoGrid :columns="3">
        <Checkbox size="sm">Small</Checkbox>
        <Checkbox size="md">Medium</Checkbox>
        <Checkbox size="lg">Large</Checkbox>
        <Checkbox disabled>Disabled</Checkbox>
        <Checkbox invalid>Invalid</Checkbox>
        <Checkbox required>Required</Checkbox>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Checkbox :checked="checked" @checked-change="handleCheckedChange">
          Controlled checkbox
        </Checkbox>

        <div class="showcase-demo-card">
          <strong>Checked</strong>
          <pre class="showcase-code">{{ checked }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'checked-change',
            reactName: 'onCheckedChange',
            vueName: 'checked-change',
            description: 'Emitted when checked state changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['primary', 'primary-foreground', 'ring']" />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <Checkbox default-checked>Enable product analytics</Checkbox>
        <Checkbox>Send weekly summary email</Checkbox>
        <Checkbox invalid required>
          I understand this destructive action
        </Checkbox>
      </div>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 4.8 `examples/vue-showcase/src/demos/p0/SwitchDemoPage.vue`

```vue
<script setup lang="ts">
import { Switch } from '@zeus-web/switch/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailChecked, useDemoEventLog } from './event-utils'

const checked = ref(false)
const events = useDemoEventLog()

function handleCheckedChange(event: unknown) {
  const next = readDetailChecked(event, checked.value)
  checked.value = next
  events.log('checked-change', { checked: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Forms"
    title="Switch capability page"
    description="Tests switch on/off states, sizes, controlled usage and checkedChange events."
  >
    <template #meta>
      <span class="showcase-badge">switch</span>
      <span class="showcase-badge">@zeus-web/switch/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="3">
        <Switch>Notifications</Switch>
        <Switch default-checked>Enabled</Switch>
        <Switch disabled>Disabled</Switch>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes and states">
      <DemoGrid :columns="3">
        <Switch size="sm">Small</Switch>
        <Switch size="md">Medium</Switch>
        <Switch size="lg">Large</Switch>
        <Switch invalid>Invalid</Switch>
        <Switch required>Required</Switch>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Switch :checked="checked" @checked-change="handleCheckedChange">
          Controlled switch
        </Switch>

        <div class="showcase-demo-card">
          <strong>Enabled</strong>
          <pre class="showcase-code">{{ checked }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'checked-change',
            reactName: 'onCheckedChange',
            vueName: 'checked-change',
            description: 'Emitted when checked state changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['primary', 'input', 'ring']" />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <Switch default-checked>Enable dark mode</Switch>
        <Switch>Send deployment alerts</Switch>
        <Switch default-checked>Auto-refresh dashboard</Switch>
      </div>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 4.9 `examples/vue-showcase/src/demos/p0/TabsDemoPage.vue`

```vue
<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zeus-web/tabs/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from './event-utils'

const value = ref('overview')
const events = useDemoEventLog()

function handleValueChange(event: unknown) {
  const next = readDetailValue(event, value.value)
  value.value = next
  events.log('value-change', { value: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Navigation"
    title="Tabs capability page"
    description="Tests tab orientation, controlled value, disabled triggers and valueChange events."
  >
    <template #meta>
      <span class="showcase-badge">tabs</span>
      <span class="showcase-badge">@zeus-web/tabs/vue</span>
    </template>

    <DemoSection title="Basic">
      <Tabs default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div class="showcase-demo-card">Overview panel</div>
        </TabsContent>
        <TabsContent value="usage">
          <div class="showcase-demo-card">Usage panel</div>
        </TabsContent>
        <TabsContent value="api">
          <div class="showcase-demo-card">API panel</div>
        </TabsContent>
      </Tabs>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Tabs :value="value" @value-change="handleValueChange">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div class="showcase-demo-card">Overview settings</div>
          </TabsContent>
          <TabsContent value="billing">
            <div class="showcase-demo-card">Billing settings</div>
          </TabsContent>
          <TabsContent value="security">
            <div class="showcase-demo-card">Security settings</div>
          </TabsContent>
        </Tabs>

        <div class="showcase-demo-card">
          <strong>Active tab</strong>
          <pre class="showcase-code">{{ value }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Vertical and disabled">
      <Tabs default-value="profile" orientation="vertical">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="disabled" disabled> Disabled </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div class="showcase-demo-card">Profile panel</div>
        </TabsContent>
        <TabsContent value="team">
          <div class="showcase-demo-card">Team panel</div>
        </TabsContent>
      </Tabs>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Emitted when active tab changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['muted', 'muted-foreground', 'ring']" />
    </DemoSection>
  </DemoPage>
</template>
```

---

## 4.10 `examples/vue-showcase/src/demos/p0/DialogDemoPage.vue`

```vue
<script setup lang="ts">
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@zeus-web/dialog/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailOpen, useDemoEventLog } from './event-utils'

const open = ref(false)
const events = useDemoEventLog()

function handleOpenChange(event: unknown) {
  const next = readDetailOpen(event, open.value)
  open.value = next
  events.log('open-change', { open: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Feedback"
    title="Dialog capability page"
    description="Tests dialog trigger, content, title, description, close, controlled open and openChange events."
  >
    <template #meta>
      <span class="showcase-badge">dialog</span>
      <span class="showcase-badge">@zeus-web/dialog/vue</span>
    </template>

    <DemoSection title="Basic">
      <Dialog>
        <DialogTrigger>Open basic dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Basic dialog</DialogTitle>
          <DialogDescription>
            This dialog is opened with an uncontrolled trigger.
          </DialogDescription>
          <div class="showcase-demo-card">Dialog body content</div>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      </Dialog>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Dialog :open="open" @open-change="handleOpenChange">
          <DialogTrigger>Open controlled dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Controlled dialog</DialogTitle>
            <DialogDescription>
              Open state is synchronized with Vue state.
            </DialogDescription>
            <DialogClose>Close controlled dialog</DialogClose>
          </DialogContent>
        </Dialog>

        <div class="showcase-demo-card">
          <strong>Open</strong>
          <pre class="showcase-code">{{ open }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="2">
        <Dialog default-open>
          <DialogContent force-mount>
            <DialogTitle>Default open</DialogTitle>
            <DialogDescription>Rendered initially open.</DialogDescription>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>

        <Dialog :modal="false">
          <DialogTrigger>Open non-modal dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Non-modal dialog</DialogTitle>
            <DialogDescription>Modal behavior disabled.</DialogDescription>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'open-change',
            reactName: 'onOpenChange',
            vueName: 'open-change',
            description: 'Emitted when open state changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['background', 'foreground', 'ring', 'border']"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <Dialog>
        <DialogTrigger>Create project</DialogTrigger>
        <DialogContent>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            This production pattern will include a full form in a later phase.
          </DialogDescription>
          <div class="showcase-demo-card">Project form placeholder</div>
          <DialogClose>Cancel</DialogClose>
        </DialogContent>
      </Dialog>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 4.11 `examples/vue-showcase/src/__tests__/p0-demos.spec.ts`

```ts
import { mount } from '@vue/test-utils'

import { p0VueDemoNames, p0VueDemoPages } from '../demos/p0'

describe('Vue P0 showcase demos', () => {
  it('registers the six P0 demo pages', () => {
    expect(p0VueDemoNames.sort()).toEqual([
      'button',
      'checkbox',
      'dialog',
      'input',
      'switch',
      'tabs',
    ])
  })

  it.each(p0VueDemoNames)('renders %s demo page', name => {
    const DemoPage = p0VueDemoPages[name]

    const wrapper = mount(DemoPage)

    expect(wrapper.text()).toContain('capability page')
  })
})
```

---

# 5. CSS 追加到 React/Vue 两边

追加到：

```txt
examples/react-showcase/src/app.css
examples/vue-showcase/src/app.css
```

```css
.showcase-demo-card {
  display: grid;
  gap: 0.75rem;
  align-content: start;
  border: 1px solid hsl(var(--border));
  border-radius: 0.85rem;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1rem;
}

.showcase-field {
  display: grid;
  gap: 0.4rem;
}

.showcase-field > span {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  font-weight: 600;
}

.showcase-production-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.showcase-event-feed {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
}

.showcase-event-record {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  background: hsl(var(--muted));
  padding: 0.65rem 0.75rem;
  font-size: 0.875rem;
}

.showcase-event-record strong {
  color: hsl(var(--foreground));
}

.showcase-event-record span {
  color: hsl(var(--muted-foreground));
}
```

---

# 6. 注意点

## 6.1 Vue 模板里 ref 自动解包

Vue `useDemoEventLog()` 返回的是：

```ts
records: Ref<DemoEventRecord[]>
```

在模板里可以直接：

```vue
events.records
```

也可以写：

```vue
events.records.value
```

但为了模板一致和更 Vue 风格，建议把 `ButtonDemoPage.vue` 里的：

```vue
events.records.value.length events.records.value
```

改成：

```vue
events.records.length events.records
```

所以上面 `ButtonDemoPage.vue` 可以进一步微调：

```vue
<div v-if="events.records.length === 0" class="showcase-empty">
  Click a button to record events.
</div>

<div
  v-for="record in events.records"
  v-else
  :key="record.id"
  class="showcase-event-record"
>
```

建议用这个版本。

---

## 6.2 Build deps

Phase 4 开始真正依赖 P0 primitive wrappers，所以 build/test/check 前必须先构建这些包。
Button package 的 `./react` 和 `./vue` 都指向 `dist/react` / `dist/vue`。

所以 React/Vue showcase 的 `build:deps` 是必须的。

---

# 7. 验收命令

```bash
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
pnpm site:build
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
pnpm site:build
pnpm release:verify --allow-zero
```

---

# 8. Phase 4 完成标准

```txt
Phase 4 done 当且仅当：

1. React /components/button 渲染真实 Button demo。
2. React /components/input 渲染真实 Input demo。
3. React /components/checkbox 渲染真实 Checkbox demo。
4. React /components/switch 渲染真实 Switch demo。
5. React /components/tabs 渲染真实 Tabs demo。
6. React /components/dialog 渲染真实 Dialog demo。
7. Vue 对应 6 个路由也渲染真实 demo。
8. 非 P0 组件仍回退到 ComponentPageScaffold。
9. P0 demo registry 单测通过。
10. showcase:test 通过。
11. showcase:build 通过。
```

---

# 9. 建议提交

```txt
feat(examples): add P0 showcase component capability pages
```

---

# 10. Phase 5 建议

Phase 5 建议继续补：

```txt
label
textarea
radio-group
select
```

也就是 Forms 批次。
做完 Phase 4 + Phase 5 后，showcase 才真正开始具备“组件可视化测试平台”的价值。
