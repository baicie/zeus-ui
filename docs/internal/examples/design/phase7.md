下面给 **Phase 7：Disclosure / Overlay 批次真实能力页** 的详细设计与完整代码。

Phase 7 覆盖：

```txt
collapsible
accordion
tooltip
```

当前 registry 已经包含这三个组件，其中 `collapsible` 依赖 `@zeus-web/collapsible`，`accordion` 依赖 `@zeus-web/accordion`，`tooltip` 依赖 `@zeus-web/tooltip`。

API 依据：

`Collapsible` 支持 `open / defaultOpen / disabled`，并有 `openChange` 事件；同时包含 `CollapsibleTrigger` 和 `CollapsibleContent`，`Content` 支持 `forceMount`。

`Accordion` 支持 `type / value / defaultValue / collapsible / disabled / orientation`，并有 `valueChange` 事件；同时包含 `AccordionItem / AccordionTrigger / AccordionContent`。

`Tooltip` 支持 `open / defaultOpen / disabled / delayDuration`，并有 `openChange` 事件；同时包含 `TooltipTrigger / TooltipContent`，`Content` 支持 `side / forceMount`。

---

# Phase 7 目标

```txt
目标：
1. React Showcase 新增 collapsible / accordion / tooltip 真实能力页。
2. Vue Showcase 新增对应 3 个真实能力页。
3. 将 disclosure demos 合并进统一 demo registry。
4. ComponentDetailPage 无需再改，只通过 registry 自动识别已实现页面。
5. showcase build/check/test 前构建 Phase 7 新增 primitive 包。
6. 新增 React/Vue disclosure demos registry 测试。
7. 补充 disclosure/overlay 相关 CSS，让页面可视化表现稳定。
```

---

# 文件变更清单

```txt
examples/react-showcase/package.json
examples/react-showcase/src/demos/index.ts
examples/react-showcase/src/demos/disclosure/index.ts
examples/react-showcase/src/demos/disclosure/CollapsibleDemoPage.tsx
examples/react-showcase/src/demos/disclosure/AccordionDemoPage.tsx
examples/react-showcase/src/demos/disclosure/TooltipDemoPage.tsx
examples/react-showcase/src/__tests__/disclosure-demos.spec.tsx
examples/react-showcase/src/app.css

examples/vue-showcase/package.json
examples/vue-showcase/src/demos/index.ts
examples/vue-showcase/src/demos/disclosure/index.ts
examples/vue-showcase/src/demos/disclosure/CollapsibleDemoPage.vue
examples/vue-showcase/src/demos/disclosure/AccordionDemoPage.vue
examples/vue-showcase/src/demos/disclosure/TooltipDemoPage.vue
examples/vue-showcase/src/__tests__/disclosure-demos.spec.ts
examples/vue-showcase/src/app.css
```

---

# 1. React Showcase

## 1.1 替换 `examples/react-showcase/package.json`

```json
{
  "name": "@zeus-web/example-react-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build:deps": "pnpm -w --filter @zeus-web/icons --filter @zeus-web/button --filter @zeus-web/input --filter @zeus-web/checkbox --filter @zeus-web/switch --filter @zeus-web/tabs --filter @zeus-web/dialog --filter @zeus-web/label --filter @zeus-web/textarea --filter @zeus-web/radio-group --filter @zeus-web/select --filter @zeus-web/card --filter @zeus-web/badge --filter @zeus-web/separator --filter @zeus-web/skeleton --filter @zeus-web/alert --filter @zeus-web/progress --filter @zeus-web/avatar --filter @zeus-web/collapsible --filter @zeus-web/accordion --filter @zeus-web/tooltip build",
    "dev": "pnpm build:deps && vite --host 0.0.0.0",
    "build": "pnpm build:deps && vite build",
    "check": "pnpm build:deps && tsc -p tsconfig.json --noEmit",
    "test": "pnpm build:deps && vitest --run"
  },
  "dependencies": {
    "@tanstack/react-router": "^1.114.0",
    "@zeus-web/accordion": "workspace:*",
    "@zeus-web/alert": "workspace:*",
    "@zeus-web/avatar": "workspace:*",
    "@zeus-web/badge": "workspace:*",
    "@zeus-web/button": "workspace:*",
    "@zeus-web/card": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/collapsible": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/example-showcase-shared": "workspace:*",
    "@zeus-web/icons": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/label": "workspace:*",
    "@zeus-web/progress": "workspace:*",
    "@zeus-web/radio-group": "workspace:*",
    "@zeus-web/select": "workspace:*",
    "@zeus-web/separator": "workspace:*",
    "@zeus-web/skeleton": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/textarea": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "@zeus-web/tooltip": "workspace:*",
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

## 1.2 新增 `examples/react-showcase/src/demos/disclosure/index.ts`

```ts
import type { ComponentType } from 'react'

import { AccordionDemoPage } from './AccordionDemoPage'
import { CollapsibleDemoPage } from './CollapsibleDemoPage'
import { TooltipDemoPage } from './TooltipDemoPage'

export const reactDisclosureDemoPages: Record<string, ComponentType> = {
  collapsible: CollapsibleDemoPage,
  accordion: AccordionDemoPage,
  tooltip: TooltipDemoPage,
}

export const reactDisclosureDemoNames = Object.keys(reactDisclosureDemoPages)
```

---

## 1.3 替换 `examples/react-showcase/src/demos/index.ts`

```ts
import type { ComponentType } from 'react'

import { reactDisclosureDemoPages } from './disclosure'
import { reactFormsDemoPages } from './forms'
import { p0ReactDemoPages } from './p0'
import { reactVisualDemoPages } from './visual'

export const reactShowcaseDemoPages: Record<string, ComponentType> = {
  ...p0ReactDemoPages,
  ...reactFormsDemoPages,
  ...reactVisualDemoPages,
  ...reactDisclosureDemoPages,
}

export const reactShowcaseDemoNames = Object.keys(reactShowcaseDemoPages)
```

---

## 1.4 新增 `examples/react-showcase/src/demos/disclosure/CollapsibleDemoPage.tsx`

```tsx
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@zeus-web/collapsible/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailOpen, useDemoEventLog } from '../p0/event-utils'

export function CollapsibleDemoPage() {
  const [open, setOpen] = useState(true)
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Disclosure"
      title="Collapsible capability page"
      description="Tests Collapsible uncontrolled state, controlled open state, disabled trigger, force mounted content and openChange events."
      meta={
        <>
          <span className="showcase-badge">collapsible</span>
          <span className="showcase-badge">@zeus-web/collapsible/react</span>
        </>
      }
    >
      <DemoSection
        title="Basic"
        description="Uncontrolled collapsible disclosure."
      >
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle release notes</CollapsibleTrigger>
          <CollapsibleContent>
            <div className="showcase-disclosure-panel">
              Canary build includes route shell, component metadata and visual
              demos.
            </div>
          </CollapsibleContent>
        </Collapsible>
      </DemoSection>

      <DemoSection
        title="Controlled"
        description="Open state synchronized with React state."
      >
        <DemoGrid columns={2}>
          <Collapsible
            open={open}
            onOpenChange={(event: unknown) => {
              const next = readDetailOpen(event, open)
              setOpen(next)
              events.log('open-change', { open: next })
            }}
          >
            <CollapsibleTrigger>Toggle controlled panel</CollapsibleTrigger>
            <CollapsibleContent>
              <div className="showcase-disclosure-panel">
                Controlled content is {open ? 'open' : 'closed'}.
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="showcase-demo-card">
            <strong>Open</strong>
            <pre className="showcase-code">{String(open)}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="States"
        description="Disabled and force mounted content states."
      >
        <DemoGrid columns={2}>
          <Collapsible disabled defaultOpen>
            <CollapsibleTrigger>Disabled trigger</CollapsibleTrigger>
            <CollapsibleContent>
              <div className="showcase-disclosure-panel">Disabled content</div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger>Force mounted content</CollapsibleTrigger>
            <CollapsibleContent forceMount>
              <div className="showcase-disclosure-panel">
                This stays mounted and toggles visibility state.
              </div>
            </CollapsibleContent>
          </Collapsible>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'open-change',
              reactName: 'onOpenChange',
              vueName: 'open-change',
              description: 'Emitted when collapsible open state changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'open',
              type: 'boolean',
              description: 'Controlled open state.',
            },
            {
              name: 'defaultOpen',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Initial uncontrolled open state.',
            },
            {
              name: 'disabled',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Disables trigger interaction.',
            },
            {
              name: 'forceMount',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Keeps content mounted when closed.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['border', 'muted', 'muted-foreground', 'ring']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <Collapsible defaultOpen>
            <CollapsibleTrigger>Advanced deployment options</CollapsibleTrigger>
            <CollapsibleContent>
              <div className="showcase-disclosure-panel showcase-form-stack">
                <span>Traffic split: 20% canary</span>
                <span>Rollback policy: automatic on error-rate spike</span>
                <span>Owner approval: required</span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.5 新增 `examples/react-showcase/src/demos/disclosure/AccordionDemoPage.tsx`

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@zeus-web/accordion/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

export function AccordionDemoPage() {
  const [value, setValue] = useState('metrics')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Disclosure"
      title="Accordion capability page"
      description="Tests Accordion single and multiple modes, collapsible behavior, controlled value, disabled items and valueChange events."
      meta={
        <>
          <span className="showcase-badge">accordion</span>
          <span className="showcase-badge">@zeus-web/accordion/react</span>
        </>
      }
    >
      <DemoSection title="Single" description="Default single-item accordion.">
        <Accordion type="single" defaultValue="overview" collapsible>
          <AccordionItem value="overview">
            <AccordionTrigger>Overview</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                The overview panel explains high-level usage.
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="usage">
            <AccordionTrigger>Usage</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                The usage panel explains composition and state.
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DemoSection>

      <DemoSection
        title="Multiple"
        description="Multiple items can be open at the same time."
      >
        <Accordion type="multiple" defaultValue="logs,traces">
          <AccordionItem value="logs">
            <AccordionTrigger>Logs</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                Log pipeline is enabled.
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="traces">
            <AccordionTrigger>Traces</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                Trace sampling is at 20%.
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="metrics">
            <AccordionTrigger>Metrics</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                Metrics scrape interval is 30s.
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DemoSection>

      <DemoSection
        title="Controlled"
        description="Controlled active value synchronized with React state."
      >
        <DemoGrid columns={2}>
          <Accordion
            type="single"
            value={value}
            collapsible
            onValueChange={(event: unknown) => {
              const next = readDetailValue(event, value)
              setValue(next)
              events.log('value-change', { value: next })
            }}
          >
            <AccordionItem value="logs">
              <AccordionTrigger>Logs</AccordionTrigger>
              <AccordionContent>
                <div className="showcase-disclosure-panel">Logs settings</div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="metrics">
              <AccordionTrigger>Metrics</AccordionTrigger>
              <AccordionContent>
                <div className="showcase-disclosure-panel">
                  Metrics settings
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="disabled" disabled>
              <AccordionTrigger>Disabled</AccordionTrigger>
              <AccordionContent>
                <div className="showcase-disclosure-panel">
                  Disabled content
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="showcase-demo-card">
            <strong>Active value</strong>
            <pre className="showcase-code">{value || '(none)'}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Horizontal orientation">
        <Accordion type="single" orientation="horizontal" defaultValue="one">
          <AccordionItem value="one">
            <AccordionTrigger>One</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                Horizontal item one.
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="two">
            <AccordionTrigger>Two</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                Horizontal item two.
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'value-change',
              reactName: 'onValueChange',
              vueName: 'value-change',
              description: 'Emitted when active accordion item changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'type',
              type: "'single' | 'multiple'",
              defaultValue: "'single'",
              description: 'Controls whether one or many items can be open.',
            },
            {
              name: 'value',
              type: 'string',
              description:
                'Controlled active value. Multiple values are comma-separated.',
            },
            {
              name: 'defaultValue',
              type: 'string',
              description: 'Initial uncontrolled active value.',
            },
            {
              name: 'collapsible',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Allows the active single item to be collapsed.',
            },
            {
              name: 'orientation',
              type: "'vertical' | 'horizontal'",
              defaultValue: "'vertical'",
              description: 'Accordion orientation.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['border', 'muted', 'muted-foreground', 'ring']}
        />
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.6 新增 `examples/react-showcase/src/demos/disclosure/TooltipDemoPage.tsx`

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@zeus-web/tooltip/react'
import { useState } from 'react'

import { Button } from '@zeus-web/button/react'
import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailOpen, useDemoEventLog } from '../p0/event-utils'

const sides = ['top', 'right', 'bottom', 'left'] as const

export function TooltipDemoPage() {
  const [open, setOpen] = useState(false)
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Overlay"
      title="Tooltip capability page"
      description="Tests Tooltip trigger/content composition, side placement, controlled open state, delay duration and openChange events."
      meta={
        <>
          <span className="showcase-badge">tooltip</span>
          <span className="showcase-badge">@zeus-web/tooltip/react</span>
        </>
      }
    >
      <DemoSection title="Basic" description="Hover or focus the trigger.">
        <Tooltip>
          <TooltipTrigger>
            <Button variant="outline">Hover for tooltip</Button>
          </TooltipTrigger>
          <TooltipContent>Helpful context for this action.</TooltipContent>
        </Tooltip>
      </DemoSection>

      <DemoSection title="Sides" description="Tooltip content side variants.">
        <DemoGrid columns={4}>
          {sides.map(side => (
            <Tooltip key={side} defaultOpen>
              <TooltipTrigger>
                <Button variant="outline">{side}</Button>
              </TooltipTrigger>
              <TooltipContent side={side} forceMount>
                {side} tooltip
              </TooltipContent>
            </Tooltip>
          ))}
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="Controlled"
        description="Controlled open state synchronized with React state."
      >
        <DemoGrid columns={2}>
          <Tooltip
            open={open}
            delayDuration={0}
            onOpenChange={(event: unknown) => {
              const next = readDetailOpen(event, open)
              setOpen(next)
              events.log('open-change', { open: next })
            }}
          >
            <TooltipTrigger>
              <Button variant="primary">Controlled tooltip</Button>
            </TooltipTrigger>
            <TooltipContent forceMount>
              Controlled tooltip content.
            </TooltipContent>
          </Tooltip>

          <div className="showcase-demo-card">
            <strong>Open</strong>
            <pre className="showcase-code">{String(open)}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="States">
        <DemoGrid columns={2}>
          <Tooltip disabled defaultOpen>
            <TooltipTrigger>
              <Button variant="outline">Disabled tooltip</Button>
            </TooltipTrigger>
            <TooltipContent forceMount>
              This should not open from trigger interaction.
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={800}>
            <TooltipTrigger>
              <Button variant="outline">Delayed tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>Opens after 800ms.</TooltipContent>
          </Tooltip>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'open-change',
              reactName: 'onOpenChange',
              vueName: 'open-change',
              description: 'Emitted when tooltip open state changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'open',
              type: 'boolean',
              description: 'Controlled open state.',
            },
            {
              name: 'defaultOpen',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Initial uncontrolled open state.',
            },
            {
              name: 'disabled',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Disables tooltip interaction.',
            },
            {
              name: 'delayDuration',
              type: 'number',
              defaultValue: '300',
              description: 'Delay before opening on hover/focus.',
            },
            {
              name: 'side',
              type: "'top' | 'right' | 'bottom' | 'left'",
              defaultValue: "'top'",
              description: 'Preferred content side.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['popover', 'popover-foreground', 'border', 'ring']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-production-row">
          <Tooltip>
            <TooltipTrigger>
              <Button variant="outline">Deploy</Button>
            </TooltipTrigger>
            <TooltipContent>
              Deploys the current canary to production.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button variant="danger">Rollback</Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Immediately rolls back to the previous stable version.
            </TooltipContent>
          </Tooltip>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.7 新增 `examples/react-showcase/src/__tests__/disclosure-demos.spec.tsx`

```tsx
import { render, screen } from '@testing-library/react'

import {
  reactDisclosureDemoNames,
  reactDisclosureDemoPages,
} from '../demos/disclosure'
import { reactShowcaseDemoNames } from '../demos'

const expectedDisclosureNames = ['accordion', 'collapsible', 'tooltip']

describe('react disclosure showcase demos', () => {
  it('registers disclosure demo pages', () => {
    expect([...reactDisclosureDemoNames].sort()).toEqual(
      expectedDisclosureNames,
    )
  })

  it('merges disclosure demos into the global showcase demo registry', () => {
    expect(reactShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedDisclosureNames),
    )
  })

  it.each(expectedDisclosureNames)('renders %s demo page', name => {
    const DemoPage = reactDisclosureDemoPages[name]

    expect(DemoPage).toBeTruthy()

    render(<DemoPage />)

    expect(
      screen.getByRole('heading', {
        name: new RegExp(`${name} capability page`, 'i'),
      }),
    ).toBeInTheDocument()
  })
})
```

---

# 2. Vue Showcase

## 2.1 替换 `examples/vue-showcase/package.json`

```json
{
  "name": "@zeus-web/example-vue-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build:deps": "pnpm -w --filter @zeus-web/button --filter @zeus-web/input --filter @zeus-web/checkbox --filter @zeus-web/switch --filter @zeus-web/tabs --filter @zeus-web/dialog --filter @zeus-web/label --filter @zeus-web/textarea --filter @zeus-web/radio-group --filter @zeus-web/select --filter @zeus-web/card --filter @zeus-web/badge --filter @zeus-web/separator --filter @zeus-web/skeleton --filter @zeus-web/alert --filter @zeus-web/progress --filter @zeus-web/avatar --filter @zeus-web/collapsible --filter @zeus-web/accordion --filter @zeus-web/tooltip build",
    "dev": "pnpm build:deps && vite --host 0.0.0.0 --port 5174",
    "build": "pnpm build:deps && vite build",
    "check": "pnpm build:deps && vue-tsc -p tsconfig.json --noEmit",
    "test": "pnpm build:deps && vitest --run"
  },
  "dependencies": {
    "@zeus-web/accordion": "workspace:*",
    "@zeus-web/alert": "workspace:*",
    "@zeus-web/avatar": "workspace:*",
    "@zeus-web/badge": "workspace:*",
    "@zeus-web/button": "workspace:*",
    "@zeus-web/card": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/collapsible": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/example-showcase-shared": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/label": "workspace:*",
    "@zeus-web/progress": "workspace:*",
    "@zeus-web/radio-group": "workspace:*",
    "@zeus-web/select": "workspace:*",
    "@zeus-web/separator": "workspace:*",
    "@zeus-web/skeleton": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/textarea": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "@zeus-web/tooltip": "workspace:*",
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

## 2.2 新增 `examples/vue-showcase/src/demos/disclosure/index.ts`

```ts
import type { Component } from 'vue'

import AccordionDemoPage from './AccordionDemoPage.vue'
import CollapsibleDemoPage from './CollapsibleDemoPage.vue'
import TooltipDemoPage from './TooltipDemoPage.vue'

export const vueDisclosureDemoPages: Record<string, Component> = {
  collapsible: CollapsibleDemoPage,
  accordion: AccordionDemoPage,
  tooltip: TooltipDemoPage,
}

export const vueDisclosureDemoNames = Object.keys(vueDisclosureDemoPages)
```

---

## 2.3 替换 `examples/vue-showcase/src/demos/index.ts`

```ts
import type { Component } from 'vue'

import { vueDisclosureDemoPages } from './disclosure'
import { vueFormsDemoPages } from './forms'
import { p0VueDemoPages } from './p0'
import { vueVisualDemoPages } from './visual'

export const vueShowcaseDemoPages: Record<string, Component> = {
  ...p0VueDemoPages,
  ...vueFormsDemoPages,
  ...vueVisualDemoPages,
  ...vueDisclosureDemoPages,
}

export const vueShowcaseDemoNames = Object.keys(vueShowcaseDemoPages)
```

---

## 2.4 新增 `examples/vue-showcase/src/demos/disclosure/CollapsibleDemoPage.vue`

```vue
<script setup lang="ts">
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@zeus-web/collapsible/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailOpen, useDemoEventLog } from '../p0/event-utils'

const open = ref(true)
const events = useDemoEventLog()

function handleOpenChange(event: unknown) {
  const next = readDetailOpen(event, open.value)
  open.value = next
  events.log('open-change', { open: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Disclosure"
    title="Collapsible capability page"
    description="Tests Collapsible uncontrolled state, controlled open state, disabled trigger, force mounted content and openChange events."
  >
    <template #meta>
      <span class="showcase-badge">collapsible</span>
      <span class="showcase-badge">@zeus-web/collapsible/vue</span>
    </template>

    <DemoSection
      title="Basic"
      description="Uncontrolled collapsible disclosure."
    >
      <Collapsible default-open>
        <CollapsibleTrigger>Toggle release notes</CollapsibleTrigger>
        <CollapsibleContent>
          <div class="showcase-disclosure-panel">
            Canary build includes route shell, component metadata and visual
            demos.
          </div>
        </CollapsibleContent>
      </Collapsible>
    </DemoSection>

    <DemoSection
      title="Controlled"
      description="Open state synchronized with Vue state."
    >
      <DemoGrid :columns="2">
        <Collapsible :open="open" @open-change="handleOpenChange">
          <CollapsibleTrigger>Toggle controlled panel</CollapsibleTrigger>
          <CollapsibleContent>
            <div class="showcase-disclosure-panel">
              Controlled content is {{ open ? 'open' : 'closed' }}.
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div class="showcase-demo-card">
          <strong>Open</strong>
          <pre class="showcase-code">{{ open }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="2">
        <Collapsible disabled default-open>
          <CollapsibleTrigger>Disabled trigger</CollapsibleTrigger>
          <CollapsibleContent>
            <div class="showcase-disclosure-panel">Disabled content</div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible :default-open="false">
          <CollapsibleTrigger>Force mounted content</CollapsibleTrigger>
          <CollapsibleContent force-mount>
            <div class="showcase-disclosure-panel">
              This stays mounted and toggles visibility state.
            </div>
          </CollapsibleContent>
        </Collapsible>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'open-change',
            reactName: 'onOpenChange',
            vueName: 'open-change',
            description: 'Emitted when collapsible open state changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'open',
            type: 'boolean',
            description: 'Controlled open state.',
          },
          {
            name: 'defaultOpen',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Initial uncontrolled open state.',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Disables trigger interaction.',
          },
          {
            name: 'forceMount',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Keeps content mounted when closed.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['border', 'muted', 'muted-foreground', 'ring']"
      />
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.5 新增 `examples/vue-showcase/src/demos/disclosure/AccordionDemoPage.vue`

```vue
<script setup lang="ts">
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@zeus-web/accordion/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

const value = ref('metrics')
const events = useDemoEventLog()

function handleValueChange(event: unknown) {
  const next = readDetailValue(event, value.value)
  value.value = next
  events.log('value-change', { value: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Disclosure"
    title="Accordion capability page"
    description="Tests Accordion single and multiple modes, collapsible behavior, controlled value, disabled items and valueChange events."
  >
    <template #meta>
      <span class="showcase-badge">accordion</span>
      <span class="showcase-badge">@zeus-web/accordion/vue</span>
    </template>

    <DemoSection title="Single">
      <Accordion type="single" default-value="overview" collapsible>
        <AccordionItem value="overview">
          <AccordionTrigger>Overview</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">
              The overview panel explains high-level usage.
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="usage">
          <AccordionTrigger>Usage</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">
              The usage panel explains composition and state.
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </DemoSection>

    <DemoSection title="Multiple">
      <Accordion type="multiple" default-value="logs,traces">
        <AccordionItem value="logs">
          <AccordionTrigger>Logs</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">
              Log pipeline is enabled.
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="traces">
          <AccordionTrigger>Traces</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">
              Trace sampling is at 20%.
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="metrics">
          <AccordionTrigger>Metrics</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">
              Metrics scrape interval is 30s.
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Accordion
          type="single"
          :value="value"
          collapsible
          @value-change="handleValueChange"
        >
          <AccordionItem value="logs">
            <AccordionTrigger>Logs</AccordionTrigger>
            <AccordionContent>
              <div class="showcase-disclosure-panel">Logs settings</div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="metrics">
            <AccordionTrigger>Metrics</AccordionTrigger>
            <AccordionContent>
              <div class="showcase-disclosure-panel">Metrics settings</div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="disabled" disabled>
            <AccordionTrigger>Disabled</AccordionTrigger>
            <AccordionContent>
              <div class="showcase-disclosure-panel">Disabled content</div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div class="showcase-demo-card">
          <strong>Active value</strong>
          <pre class="showcase-code">{{ value || '(none)' }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Horizontal orientation">
      <Accordion type="single" orientation="horizontal" default-value="one">
        <AccordionItem value="one">
          <AccordionTrigger>One</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">Horizontal item one.</div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="two">
          <AccordionTrigger>Two</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">Horizontal item two.</div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Emitted when active accordion item changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'type',
            type: '\'single\' | \'multiple\'',
            defaultValue: '\'single\'',
            description: 'Controls whether one or many items can be open.',
          },
          {
            name: 'value',
            type: 'string',
            description:
              'Controlled active value. Multiple values are comma-separated.',
          },
          {
            name: 'defaultValue',
            type: 'string',
            description: 'Initial uncontrolled active value.',
          },
          {
            name: 'collapsible',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Allows the active single item to be collapsed.',
          },
          {
            name: 'orientation',
            type: '\'vertical\' | \'horizontal\'',
            defaultValue: '\'vertical\'',
            description: 'Accordion orientation.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['border', 'muted', 'muted-foreground', 'ring']"
      />
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.6 新增 `examples/vue-showcase/src/demos/disclosure/TooltipDemoPage.vue`

```vue
<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipTrigger } from '@zeus-web/tooltip/vue'
import { Button } from '@zeus-web/button/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailOpen, useDemoEventLog } from '../p0/event-utils'

const open = ref(false)
const events = useDemoEventLog()
const sides = ['top', 'right', 'bottom', 'left'] as const

function handleOpenChange(event: unknown) {
  const next = readDetailOpen(event, open.value)
  open.value = next
  events.log('open-change', { open: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Overlay"
    title="Tooltip capability page"
    description="Tests Tooltip trigger/content composition, side placement, controlled open state, delay duration and openChange events."
  >
    <template #meta>
      <span class="showcase-badge">tooltip</span>
      <span class="showcase-badge">@zeus-web/tooltip/vue</span>
    </template>

    <DemoSection title="Basic" description="Hover or focus the trigger.">
      <Tooltip>
        <TooltipTrigger>
          <Button variant="outline">Hover for tooltip</Button>
        </TooltipTrigger>
        <TooltipContent> Helpful context for this action. </TooltipContent>
      </Tooltip>
    </DemoSection>

    <DemoSection title="Sides">
      <DemoGrid :columns="4">
        <Tooltip v-for="side in sides" :key="side" default-open>
          <TooltipTrigger>
            <Button variant="outline">{{ side }}</Button>
          </TooltipTrigger>
          <TooltipContent :side="side" force-mount>
            {{ side }} tooltip
          </TooltipContent>
        </Tooltip>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Tooltip
          :open="open"
          :delay-duration="0"
          @open-change="handleOpenChange"
        >
          <TooltipTrigger>
            <Button variant="primary">Controlled tooltip</Button>
          </TooltipTrigger>
          <TooltipContent force-mount>
            Controlled tooltip content.
          </TooltipContent>
        </Tooltip>

        <div class="showcase-demo-card">
          <strong>Open</strong>
          <pre class="showcase-code">{{ open }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="2">
        <Tooltip disabled default-open>
          <TooltipTrigger>
            <Button variant="outline">Disabled tooltip</Button>
          </TooltipTrigger>
          <TooltipContent force-mount>
            This should not open from trigger interaction.
          </TooltipContent>
        </Tooltip>

        <Tooltip :delay-duration="800">
          <TooltipTrigger>
            <Button variant="outline">Delayed tooltip</Button>
          </TooltipTrigger>
          <TooltipContent> Opens after 800ms. </TooltipContent>
        </Tooltip>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'open-change',
            reactName: 'onOpenChange',
            vueName: 'open-change',
            description: 'Emitted when tooltip open state changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'open',
            type: 'boolean',
            description: 'Controlled open state.',
          },
          {
            name: 'defaultOpen',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Initial uncontrolled open state.',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Disables tooltip interaction.',
          },
          {
            name: 'delayDuration',
            type: 'number',
            defaultValue: '300',
            description: 'Delay before opening on hover/focus.',
          },
          {
            name: 'side',
            type: '\'top\' | \'right\' | \'bottom\' | \'left\'',
            defaultValue: '\'top\'',
            description: 'Preferred content side.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['popover', 'popover-foreground', 'border', 'ring']"
      />
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.7 新增 `examples/vue-showcase/src/__tests__/disclosure-demos.spec.ts`

```ts
import { mount } from '@vue/test-utils'

import {
  vueDisclosureDemoNames,
  vueDisclosureDemoPages,
} from '../demos/disclosure'
import { vueShowcaseDemoNames } from '../demos'

const expectedDisclosureNames = ['accordion', 'collapsible', 'tooltip']

describe('vue disclosure showcase demos', () => {
  it('registers disclosure demo pages', () => {
    expect([...vueDisclosureDemoNames].sort()).toEqual(expectedDisclosureNames)
  })

  it('merges disclosure demos into the global showcase demo registry', () => {
    expect(vueShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedDisclosureNames),
    )
  })

  it.each(expectedDisclosureNames)('renders %s demo page', name => {
    const DemoPage = vueDisclosureDemoPages[name]

    expect(DemoPage).toBeTruthy()

    const wrapper = mount(DemoPage)

    expect(wrapper.text()).toContain('capability page')
  })
})
```

---

# 3. CSS 追加到 React/Vue 两边

追加到：

```txt
examples/react-showcase/src/app.css
examples/vue-showcase/src/app.css
```

```css
zw-collapsible,
zw-accordion,
zw-tooltip {
  display: block;
}

zw-collapsible-trigger,
zw-accordion-trigger,
zw-tooltip-trigger {
  display: inline-flex;
}

zw-collapsible-trigger button,
zw-accordion-trigger button,
zw-tooltip-trigger [data-slot='tooltip-trigger-control'] {
  display: inline-flex;
  min-height: 2.25rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.65rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}

zw-collapsible-trigger button:hover,
zw-accordion-trigger button:hover,
zw-tooltip-trigger [data-slot='tooltip-trigger-control']:hover {
  background: hsl(var(--muted));
}

zw-collapsible-trigger[data-disabled] button,
zw-accordion-trigger[data-disabled] button {
  cursor: not-allowed;
  opacity: 0.55;
}

zw-collapsible-content,
zw-accordion-content {
  display: block;
  margin-top: 0.75rem;
}

zw-collapsible-content[hidden],
zw-accordion-content[hidden],
zw-tooltip-content[hidden] {
  display: none;
}

zw-accordion {
  display: grid;
  gap: 0.5rem;
}

zw-accordion[data-orientation='horizontal'] {
  grid-auto-flow: column;
  grid-auto-columns: minmax(12rem, 1fr);
  align-items: start;
}

zw-accordion-item {
  display: block;
  border: 1px solid hsl(var(--border));
  border-radius: 0.85rem;
  background: hsl(var(--card));
  padding: 0.75rem;
}

zw-accordion-trigger {
  width: 100%;
}

zw-accordion-trigger button {
  width: 100%;
  justify-content: space-between;
}

zw-accordion-trigger[data-state='open'] button {
  background: hsl(var(--muted));
}

zw-tooltip {
  position: relative;
  display: inline-block;
}

zw-tooltip-content {
  position: absolute;
  z-index: 50;
  width: max-content;
  max-width: 16rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.65rem;
  background: hsl(var(--popover, var(--background)));
  color: hsl(var(--popover-foreground, var(--foreground)));
  padding: 0.5rem 0.65rem;
  box-shadow: 0 10px 30px hsl(0 0% 0% / 0.12);
  font-size: 0.8125rem;
  line-height: 1.4;
}

zw-tooltip-content[data-side='top'] {
  bottom: calc(100% + 0.5rem);
  left: 50%;
  transform: translateX(-50%);
}

zw-tooltip-content[data-side='bottom'] {
  top: calc(100% + 0.5rem);
  left: 50%;
  transform: translateX(-50%);
}

zw-tooltip-content[data-side='left'] {
  right: calc(100% + 0.5rem);
  top: 50%;
  transform: translateY(-50%);
}

zw-tooltip-content[data-side='right'] {
  left: calc(100% + 0.5rem);
  top: 50%;
  transform: translateY(-50%);
}

.showcase-disclosure-panel {
  border: 1px solid hsl(var(--border));
  border-radius: 0.85rem;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  padding: 1rem;
  line-height: 1.55;
}

.showcase-disclosure-panel + .showcase-disclosure-panel {
  margin-top: 0.75rem;
}
```

---

# 4. 验收命令

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

# Phase 7 完成标准

```txt
Phase 7 done 当且仅当：

1. React /components/collapsible 渲染真实 Collapsible demo。
2. React /components/accordion 渲染真实 Accordion demo。
3. React /components/tooltip 渲染真实 Tooltip demo。
4. Vue 对应 3 个路由也渲染真实 demo。
5. reactShowcaseDemoPages / vueShowcaseDemoPages 统一注册 P0 + Forms + Visual + Disclosure。
6. disclosure-demos 单测通过。
7. showcase:test 通过。
8. showcase:build 通过。
9. 未完成组件仍回退 ComponentPageScaffold。
```

---

# 建议提交

```txt
feat(examples): add disclosure showcase component pages
```

---

# 下一阶段建议

Phase 8 做最后的缺口和 polish：

```txt
1. 为所有 demo 页补统一 EventFeed 组件。
2. 抽 build:deps 为 scripts/examples/build-showcase-deps.ts，避免 package.json 继续膨胀。
3. 补 Playwright e2e：React/Vue showcase route smoke。
4. 补组件页面视觉快照或 DOM smoke。
5. 整理 docs/internal/examples/roadmap.md，将 Phase 0-7 标记为完成。
```

Phase 7 完成后，当前 20 个 beta 组件基本都进入真实 showcase 页面，只剩工程化和质量兜底。
