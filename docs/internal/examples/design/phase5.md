下面给 **Phase 5：Forms 批次真实能力页** 的详细设计与完整代码。
覆盖组件：

```txt
label
textarea
radio-group
select
```

当前源码能力依据：

- `Label` 支持 `for / size / required / disabled / visuallyHidden`，并暴露 `focus()`。
- `Textarea` 支持 `value / defaultValue / size / resize / disabled / readonly / required / invalid / minlength / maxlength / formatter`，并有 `valueChange / focusChange`。
- `RadioGroup` 支持 `value / defaultValue / name / orientation / size / disabled / required / invalid`，并有 `valueChange`；`RadioGroupItem` 支持 `value / disabled`。
- `Select` 支持 `value / defaultValue / size / disabled / required / invalid / multiple / name`，并有 `valueChange / focusChange`。

---

# Phase 5 目标

```txt
目标：
1. 新增 label / textarea / radio-group / select 四个真实能力页。
2. React/Vue 两边都覆盖这四个组件。
3. 把 demo 注册从 p0 扩展成统一 demo registry。
4. ComponentDetailPage 不再只识别 p0，而是识别所有已实现 demo。
5. showcase build/check/test 前构建 Phase 5 新增 primitive 包。
6. 新增 Forms demo registry 单测。
```

---

# 文件变更清单

```txt
examples/react-showcase/package.json
examples/react-showcase/src/routes/ComponentDetailPage.tsx
examples/react-showcase/src/demos/index.ts
examples/react-showcase/src/demos/forms/index.ts
examples/react-showcase/src/demos/forms/LabelDemoPage.tsx
examples/react-showcase/src/demos/forms/TextareaDemoPage.tsx
examples/react-showcase/src/demos/forms/RadioGroupDemoPage.tsx
examples/react-showcase/src/demos/forms/SelectDemoPage.tsx
examples/react-showcase/src/__tests__/forms-demos.spec.tsx

examples/vue-showcase/package.json
examples/vue-showcase/src/routes/ComponentDetailPage.vue
examples/vue-showcase/src/demos/index.ts
examples/vue-showcase/src/demos/forms/index.ts
examples/vue-showcase/src/demos/forms/LabelDemoPage.vue
examples/vue-showcase/src/demos/forms/TextareaDemoPage.vue
examples/vue-showcase/src/demos/forms/RadioGroupDemoPage.vue
examples/vue-showcase/src/demos/forms/SelectDemoPage.vue
examples/vue-showcase/src/__tests__/forms-demos.spec.ts

examples/react-showcase/src/app.css
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
    "build:deps": "pnpm -w --filter @zeus-web/icons --filter @zeus-web/button --filter @zeus-web/input --filter @zeus-web/checkbox --filter @zeus-web/switch --filter @zeus-web/tabs --filter @zeus-web/dialog --filter @zeus-web/label --filter @zeus-web/textarea --filter @zeus-web/radio-group --filter @zeus-web/select build",
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
    "@zeus-web/label": "workspace:*",
    "@zeus-web/radio-group": "workspace:*",
    "@zeus-web/select": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/textarea": "workspace:*",
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

## 1.2 新增 `examples/react-showcase/src/demos/forms/index.ts`

```ts
import type { ComponentType } from 'react'

import { LabelDemoPage } from './LabelDemoPage'
import { RadioGroupDemoPage } from './RadioGroupDemoPage'
import { SelectDemoPage } from './SelectDemoPage'
import { TextareaDemoPage } from './TextareaDemoPage'

export const reactFormsDemoPages: Record<string, ComponentType> = {
  label: LabelDemoPage,
  textarea: TextareaDemoPage,
  'radio-group': RadioGroupDemoPage,
  select: SelectDemoPage,
}

export const reactFormsDemoNames = Object.keys(reactFormsDemoPages)
```

---

## 1.3 新增 `examples/react-showcase/src/demos/index.ts`

```ts
import type { ComponentType } from 'react'

import { p0ReactDemoPages } from './p0'
import { reactFormsDemoPages } from './forms'

export const reactShowcaseDemoPages: Record<string, ComponentType> = {
  ...p0ReactDemoPages,
  ...reactFormsDemoPages,
}

export const reactShowcaseDemoNames = Object.keys(reactShowcaseDemoPages)
```

---

## 1.4 替换 `examples/react-showcase/src/routes/ComponentDetailPage.tsx`

```tsx
import { useParams } from '@tanstack/react-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import { ComponentPageScaffold } from '../app/demo/ComponentPageScaffold'
import { reactShowcaseDemoPages } from '../demos'

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

  const DemoPage = reactShowcaseDemoPages[component.name]

  if (DemoPage) {
    return <DemoPage />
  }

  return <ComponentPageScaffold component={component} />
}
```

---

## 1.5 新增 `examples/react-showcase/src/demos/forms/LabelDemoPage.tsx`

```tsx
import { Label } from '@zeus-web/label/react'
import { Input } from '@zeus-web/input/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

export function LabelDemoPage() {
  return (
    <DemoPage
      eyebrow="Forms"
      title="Label capability page"
      description="Tests Label sizes, required marker, disabled state, visually hidden labels and production form association."
      meta={
        <>
          <span className="showcase-badge">label</span>
          <span className="showcase-badge">@zeus-web/label/react</span>
        </>
      }
    >
      <DemoSection
        title="Basic"
        description="Label associated with a form control."
      >
        <div className="showcase-demo-card">
          <Label for="react-label-email">Email</Label>
          <Input id="react-label-email" placeholder="user@example.com" />
        </div>
      </DemoSection>

      <DemoSection title="Sizes" description="Small, medium and large labels.">
        <DemoGrid columns={3}>
          <div className="showcase-demo-card">
            <Label size="sm" for="react-label-sm">
              Small label
            </Label>
            <Input id="react-label-sm" size="sm" placeholder="Small field" />
          </div>

          <div className="showcase-demo-card">
            <Label size="md" for="react-label-md">
              Medium label
            </Label>
            <Input id="react-label-md" size="md" placeholder="Medium field" />
          </div>

          <div className="showcase-demo-card">
            <Label size="lg" for="react-label-lg">
              Large label
            </Label>
            <Input id="react-label-lg" size="lg" placeholder="Large field" />
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="States"
        description="Required, disabled and visually hidden states."
      >
        <DemoGrid columns={3}>
          <div className="showcase-demo-card">
            <Label required for="react-label-required">
              Required field
            </Label>
            <Input id="react-label-required" required placeholder="Required" />
          </div>

          <div className="showcase-demo-card">
            <Label disabled for="react-label-disabled">
              Disabled field
            </Label>
            <Input id="react-label-disabled" disabled placeholder="Disabled" />
          </div>

          <div className="showcase-demo-card">
            <Label visuallyHidden for="react-label-hidden">
              Hidden accessible label
            </Label>
            <Input
              id="react-label-hidden"
              placeholder="Label is visually hidden"
            />
            <span className="showcase-badge">visuallyHidden</span>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'for',
              type: 'string',
              description: 'Associates the label with a form control id.',
            },
            {
              name: 'size',
              type: "'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: 'Controls label size.',
            },
            {
              name: 'required',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Shows required indicator.',
            },
            {
              name: 'disabled',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Marks label as disabled.',
            },
            {
              name: 'visuallyHidden',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Keeps label accessible while hiding it visually.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['foreground', 'destructive', 'muted-foreground']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-form-stack">
          <div className="showcase-field">
            <Label required for="react-project-name">
              Project name
            </Label>
            <Input
              id="react-project-name"
              placeholder="observability-platform"
            />
          </div>

          <div className="showcase-field">
            <Label for="react-project-owner">Owner email</Label>
            <Input id="react-project-owner" placeholder="owner@example.com" />
          </div>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.6 新增 `examples/react-showcase/src/demos/forms/TextareaDemoPage.tsx`

```tsx
import { Textarea } from '@zeus-web/textarea/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

export function TextareaDemoPage() {
  const [value, setValue] = useState('Initial deployment note')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Textarea capability page"
      description="Tests Textarea sizes, resize modes, controlled value, formatter, validation and value/focus events."
      meta={
        <>
          <span className="showcase-badge">textarea</span>
          <span className="showcase-badge">@zeus-web/textarea/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={2}>
          <Textarea placeholder="Write a message..." rows={4} />
          <Textarea defaultValue="Default value" rows={4} />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes and resize">
        <DemoGrid columns={3}>
          <Textarea size="sm" resize="none" placeholder="Small / no resize" />
          <Textarea
            size="md"
            resize="vertical"
            placeholder="Medium / vertical"
          />
          <Textarea size="lg" resize="both" placeholder="Large / both" />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="States">
        <DemoGrid columns={3}>
          <Textarea disabled placeholder="Disabled" />
          <Textarea readonly value="Readonly" />
          <Textarea
            invalid
            ariaErrormessage="textarea-error"
            placeholder="Invalid"
          />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Textarea
            value={value}
            rows={5}
            placeholder="Controlled textarea"
            onValueChange={(event: unknown) => {
              const next = readDetailValue(event, value)
              setValue(next)
              events.log('value-change', { value: next })
            }}
            onFocusChange={(event: unknown) => {
              events.log('focus-change', event)
            }}
          />

          <div className="showcase-demo-card">
            <strong>Current value</strong>
            <pre className="showcase-code">{value}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Formatter">
        <Textarea
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
              description: 'Emitted when textarea value changes.',
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

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'value',
              type: 'string',
              description: 'Controlled textarea value.',
            },
            {
              name: 'defaultValue',
              type: 'string',
              description: 'Initial uncontrolled value.',
            },
            {
              name: 'resize',
              type: "'none' | 'vertical' | 'horizontal' | 'both'",
              defaultValue: "'vertical'",
              description: 'Textarea resize behavior.',
            },
            {
              name: 'formatter',
              type: '(value: string) => string',
              description: 'Formats text before emitting value-change.',
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
        <div className="showcase-demo-card showcase-form-stack">
          <Textarea
            rows={5}
            maxlength={240}
            placeholder="Describe the release risk and rollback plan..."
          >
            <span slot="message">
              Max 240 characters. Include rollback plan.
            </span>
          </Textarea>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.7 新增 `examples/react-showcase/src/demos/forms/RadioGroupDemoPage.tsx`

```tsx
import { RadioGroup, RadioGroupItem } from '@zeus-web/radio-group/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

export function RadioGroupDemoPage() {
  const [value, setValue] = useState('weekly')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Radio Group capability page"
      description="Tests RadioGroup orientation, sizes, controlled value, disabled items and valueChange events."
      meta={
        <>
          <span className="showcase-badge">radio-group</span>
          <span className="showcase-badge">@zeus-web/radio-group/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <RadioGroup defaultValue="daily" ariaLabel="Notification frequency">
          <RadioGroupItem value="daily">Daily</RadioGroupItem>
          <RadioGroupItem value="weekly">Weekly</RadioGroupItem>
          <RadioGroupItem value="monthly">Monthly</RadioGroupItem>
        </RadioGroup>
      </DemoSection>

      <DemoSection title="Orientation and sizes">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <strong>Horizontal</strong>
            <RadioGroup orientation="horizontal" defaultValue="staging">
              <RadioGroupItem value="dev">Dev</RadioGroupItem>
              <RadioGroupItem value="staging">Staging</RadioGroupItem>
              <RadioGroupItem value="prod">Prod</RadioGroupItem>
            </RadioGroup>
          </div>

          <div className="showcase-demo-card">
            <strong>Large</strong>
            <RadioGroup size="lg" defaultValue="owner">
              <RadioGroupItem value="viewer">Viewer</RadioGroupItem>
              <RadioGroupItem value="editor">Editor</RadioGroupItem>
              <RadioGroupItem value="owner">Owner</RadioGroupItem>
            </RadioGroup>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="States">
        <DemoGrid columns={2}>
          <RadioGroup disabled defaultValue="disabled">
            <RadioGroupItem value="disabled">Disabled group</RadioGroupItem>
            <RadioGroupItem value="other">Other</RadioGroupItem>
          </RadioGroup>

          <RadioGroup invalid required defaultValue="required">
            <RadioGroupItem value="required">Required invalid</RadioGroupItem>
            <RadioGroupItem value="other">Other</RadioGroupItem>
          </RadioGroup>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <RadioGroup
            value={value}
            name="react-controlled-radio"
            onValueChange={(event: unknown) => {
              const next = readDetailValue(event, value)
              setValue(next)
              events.log('value-change', { value: next })
            }}
          >
            <RadioGroupItem value="daily">Daily</RadioGroupItem>
            <RadioGroupItem value="weekly">Weekly</RadioGroupItem>
            <RadioGroupItem value="monthly">Monthly</RadioGroupItem>
          </RadioGroup>

          <div className="showcase-demo-card">
            <strong>Selected</strong>
            <pre className="showcase-code">{value}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'value-change',
              reactName: 'onValueChange',
              vueName: 'value-change',
              description: 'Emitted when selected value changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'value',
              type: 'string',
              description: 'Controlled selected value.',
            },
            {
              name: 'defaultValue',
              type: 'string',
              description: 'Initial uncontrolled value.',
            },
            {
              name: 'orientation',
              type: "'horizontal' | 'vertical'",
              defaultValue: "'vertical'",
              description: 'Radio group layout direction.',
            },
            {
              name: 'size',
              type: "'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: 'Radio item size.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['primary', 'ring', 'muted-foreground']} />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <strong>Deployment strategy</strong>
          <RadioGroup defaultValue="rolling" name="deployment-strategy">
            <RadioGroupItem value="rolling">Rolling deployment</RadioGroupItem>
            <RadioGroupItem value="blue-green">
              Blue/green deployment
            </RadioGroupItem>
            <RadioGroupItem value="canary">Canary deployment</RadioGroupItem>
          </RadioGroup>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.8 新增 `examples/react-showcase/src/demos/forms/SelectDemoPage.tsx`

```tsx
import { Select } from '@zeus-web/select/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

export function SelectDemoPage() {
  const [value, setValue] = useState('production')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Select capability page"
      description="Tests Select sizes, disabled/invalid states, controlled value, multiple mode and value/focus events."
      meta={
        <>
          <span className="showcase-badge">select</span>
          <span className="showcase-badge">@zeus-web/select/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={2}>
          <Select defaultValue="staging" ariaLabel="Environment">
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </Select>

          <Select ariaLabel="Role" defaultValue="editor">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </Select>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes and states">
        <DemoGrid columns={3}>
          <Select size="sm" defaultValue="sm" ariaLabel="Small select">
            <option value="sm">Small</option>
          </Select>

          <Select size="md" defaultValue="md" ariaLabel="Medium select">
            <option value="md">Medium</option>
          </Select>

          <Select size="lg" defaultValue="lg" ariaLabel="Large select">
            <option value="lg">Large</option>
          </Select>

          <Select disabled defaultValue="disabled" ariaLabel="Disabled select">
            <option value="disabled">Disabled</option>
          </Select>

          <Select
            invalid
            ariaErrormessage="select-error"
            ariaLabel="Invalid select"
          >
            <option value="">Choose one</option>
          </Select>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Select
            value={value}
            name="react-controlled-select"
            ariaLabel="Controlled environment"
            onValueChange={(event: unknown) => {
              const next = readDetailValue(event, value)
              setValue(next)
              events.log('value-change', { value: next })
            }}
            onFocusChange={(event: unknown) => {
              events.log('focus-change', event)
            }}
          >
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </Select>

          <div className="showcase-demo-card">
            <strong>Selected</strong>
            <pre className="showcase-code">{value}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Multiple">
        <Select multiple ariaLabel="Multiple select">
          <option value="rum">RUM</option>
          <option value="logs">Logs</option>
          <option value="traces">Traces</option>
          <option value="metrics">Metrics</option>
        </Select>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'value-change',
              reactName: 'onValueChange',
              vueName: 'value-change',
              description: 'Emitted when selected value changes.',
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

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'value',
              type: 'string',
              description: 'Controlled selected value.',
            },
            {
              name: 'defaultValue',
              type: 'string',
              description: 'Initial uncontrolled value.',
            },
            {
              name: 'multiple',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Enables multiple selection.',
            },
            {
              name: 'invalid',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Marks select as invalid.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['input', 'ring', 'background', 'foreground']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-form-stack">
          <label className="showcase-field">
            <span>Environment</span>
            <Select defaultValue="production" name="environment">
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </Select>
          </label>

          <label className="showcase-field">
            <span>Owner role</span>
            <Select defaultValue="owner" name="role">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </Select>
          </label>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.9 新增 `examples/react-showcase/src/__tests__/forms-demos.spec.tsx`

```tsx
import { render, screen } from '@testing-library/react'

import { reactFormsDemoNames, reactFormsDemoPages } from '../demos/forms'
import { reactShowcaseDemoNames } from '../demos'

const expectedFormNames = ['label', 'radio-group', 'select', 'textarea']

describe('react forms showcase demos', () => {
  it('registers form demo pages', () => {
    expect([...reactFormsDemoNames].sort()).toEqual(expectedFormNames)
  })

  it('merges form demos into the global showcase demo registry', () => {
    expect(reactShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedFormNames),
    )
  })

  it.each(expectedFormNames)('renders %s demo page', name => {
    const DemoPage = reactFormsDemoPages[name]

    expect(DemoPage).toBeTruthy()

    render(<DemoPage />)

    expect(
      screen.getByRole('heading', {
        name: new RegExp(`${name.replace('-', ' ')} capability page`, 'i'),
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
    "build:deps": "pnpm -w --filter @zeus-web/button --filter @zeus-web/input --filter @zeus-web/checkbox --filter @zeus-web/switch --filter @zeus-web/tabs --filter @zeus-web/dialog --filter @zeus-web/label --filter @zeus-web/textarea --filter @zeus-web/radio-group --filter @zeus-web/select build",
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
    "@zeus-web/label": "workspace:*",
    "@zeus-web/radio-group": "workspace:*",
    "@zeus-web/select": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/textarea": "workspace:*",
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

## 2.2 新增 `examples/vue-showcase/src/demos/forms/index.ts`

```ts
import type { Component } from 'vue'

import LabelDemoPage from './LabelDemoPage.vue'
import RadioGroupDemoPage from './RadioGroupDemoPage.vue'
import SelectDemoPage from './SelectDemoPage.vue'
import TextareaDemoPage from './TextareaDemoPage.vue'

export const vueFormsDemoPages: Record<string, Component> = {
  label: LabelDemoPage,
  textarea: TextareaDemoPage,
  'radio-group': RadioGroupDemoPage,
  select: SelectDemoPage,
}

export const vueFormsDemoNames = Object.keys(vueFormsDemoPages)
```

---

## 2.3 新增 `examples/vue-showcase/src/demos/index.ts`

```ts
import type { Component } from 'vue'

import { p0VueDemoPages } from './p0'
import { vueFormsDemoPages } from './forms'

export const vueShowcaseDemoPages: Record<string, Component> = {
  ...p0VueDemoPages,
  ...vueFormsDemoPages,
}

export const vueShowcaseDemoNames = Object.keys(vueShowcaseDemoPages)
```

---

## 2.4 替换 `examples/vue-showcase/src/routes/ComponentDetailPage.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import ComponentPageScaffold from '../app/demo/ComponentPageScaffold.vue'
import { vueShowcaseDemoPages } from '../demos'

const route = useRoute()

const componentName = computed(() => {
  const value = route.params.componentName
  return typeof value === 'string' ? value : ''
})

const component = computed(() => {
  return showcaseComponents.find(item => item.name === componentName.value)
})

const DemoPage = computed(() => {
  return component.value
    ? vueShowcaseDemoPages[component.value.name]
    : undefined
})
</script>

<template>
  <div v-if="!component" class="showcase-page">
    <div class="showcase-empty">
      Component "{{ componentName }}" is not part of the current showcase
      metadata.
    </div>
  </div>

  <component :is="DemoPage" v-else-if="DemoPage" />

  <ComponentPageScaffold v-else :component="component" />
</template>
```

---

## 2.5 新增 `examples/vue-showcase/src/demos/forms/LabelDemoPage.vue`

```vue
<script setup lang="ts">
import { Label } from '@zeus-web/label/vue'
import { Input } from '@zeus-web/input/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
</script>

<template>
  <DemoPage
    eyebrow="Forms"
    title="Label capability page"
    description="Tests Label sizes, required marker, disabled state, visually hidden labels and production form association."
  >
    <template #meta>
      <span class="showcase-badge">label</span>
      <span class="showcase-badge">@zeus-web/label/vue</span>
    </template>

    <DemoSection title="Basic">
      <div class="showcase-demo-card">
        <Label for="vue-label-email">Email</Label>
        <Input id="vue-label-email" placeholder="user@example.com" />
      </div>
    </DemoSection>

    <DemoSection title="Sizes">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Label size="sm" for="vue-label-sm">Small label</Label>
          <Input id="vue-label-sm" size="sm" placeholder="Small field" />
        </div>

        <div class="showcase-demo-card">
          <Label size="md" for="vue-label-md">Medium label</Label>
          <Input id="vue-label-md" size="md" placeholder="Medium field" />
        </div>

        <div class="showcase-demo-card">
          <Label size="lg" for="vue-label-lg">Large label</Label>
          <Input id="vue-label-lg" size="lg" placeholder="Large field" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Label required for="vue-label-required">Required field</Label>
          <Input id="vue-label-required" required placeholder="Required" />
        </div>

        <div class="showcase-demo-card">
          <Label disabled for="vue-label-disabled">Disabled field</Label>
          <Input id="vue-label-disabled" disabled placeholder="Disabled" />
        </div>

        <div class="showcase-demo-card">
          <Label visually-hidden for="vue-label-hidden">
            Hidden accessible label
          </Label>
          <Input id="vue-label-hidden" placeholder="Label is visually hidden" />
          <span class="showcase-badge">visually-hidden</span>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'for',
            type: 'string',
            description: 'Associates the label with a form control id.',
          },
          {
            name: 'size',
            type: '\'sm\' | \'md\' | \'lg\'',
            defaultValue: '\'md\'',
            description: 'Controls label size.',
          },
          {
            name: 'required',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Shows required indicator.',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Marks label as disabled.',
          },
          {
            name: 'visuallyHidden',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Keeps label accessible while hiding it visually.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['foreground', 'destructive', 'muted-foreground']"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card showcase-form-stack">
        <div class="showcase-field">
          <Label required for="vue-project-name">Project name</Label>
          <Input id="vue-project-name" placeholder="observability-platform" />
        </div>

        <div class="showcase-field">
          <Label for="vue-project-owner">Owner email</Label>
          <Input id="vue-project-owner" placeholder="owner@example.com" />
        </div>
      </div>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.6 新增 `examples/vue-showcase/src/demos/forms/TextareaDemoPage.vue`

```vue
<script setup lang="ts">
import { Textarea } from '@zeus-web/textarea/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

const value = ref('Initial deployment note')
const events = useDemoEventLog()

function handleValueChange(event: unknown) {
  const next = readDetailValue(event, value.value)
  value.value = next
  events.log('value-change', { value: next })
}

function uppercaseFormatter(input: string) {
  return input.toUpperCase()
}

function handleFormattedValueChange(event: unknown) {
  events.log('formatted-value-change', {
    value: readDetailValue(event),
  })
}
</script>

<template>
  <DemoPage
    eyebrow="Forms"
    title="Textarea capability page"
    description="Tests Textarea sizes, resize modes, controlled value, formatter, validation and value/focus events."
  >
    <template #meta>
      <span class="showcase-badge">textarea</span>
      <span class="showcase-badge">@zeus-web/textarea/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="2">
        <Textarea placeholder="Write a message..." :rows="4" />
        <Textarea default-value="Default value" :rows="4" />
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes and resize">
      <DemoGrid :columns="3">
        <Textarea size="sm" resize="none" placeholder="Small / no resize" />
        <Textarea size="md" resize="vertical" placeholder="Medium / vertical" />
        <Textarea size="lg" resize="both" placeholder="Large / both" />
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="3">
        <Textarea disabled placeholder="Disabled" />
        <Textarea readonly value="Readonly" />
        <Textarea
          invalid
          aria-errormessage="textarea-error"
          placeholder="Invalid"
        />
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Textarea
          :value="value"
          :rows="5"
          placeholder="Controlled textarea"
          @value-change="handleValueChange"
          @focus-change="events.log('focus-change', $event)"
        />

        <div class="showcase-demo-card">
          <strong>Current value</strong>
          <pre class="showcase-code">{{ value }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Formatter">
      <Textarea
        placeholder="Uppercase formatter"
        :formatter="uppercaseFormatter"
        @value-change="handleFormattedValueChange"
      />
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Emitted when textarea value changes.',
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

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'value',
            type: 'string',
            description: 'Controlled textarea value.',
          },
          {
            name: 'defaultValue',
            type: 'string',
            description: 'Initial uncontrolled value.',
          },
          {
            name: 'resize',
            type: '\'none\' | \'vertical\' | \'horizontal\' | \'both\'',
            defaultValue: '\'vertical\'',
            description: 'Textarea resize behavior.',
          },
          {
            name: 'formatter',
            type: '(value: string) => string',
            description: 'Formats text before emitting value-change.',
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
      <div class="showcase-demo-card showcase-form-stack">
        <Textarea
          :rows="5"
          :maxlength="240"
          placeholder="Describe the release risk and rollback plan..."
        >
          <span slot="message">Max 240 characters. Include rollback plan.</span>
        </Textarea>
      </div>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.7 新增 `examples/vue-showcase/src/demos/forms/RadioGroupDemoPage.vue`

```vue
<script setup lang="ts">
import { RadioGroup, RadioGroupItem } from '@zeus-web/radio-group/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

const value = ref('weekly')
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
    title="Radio Group capability page"
    description="Tests RadioGroup orientation, sizes, controlled value, disabled items and valueChange events."
  >
    <template #meta>
      <span class="showcase-badge">radio-group</span>
      <span class="showcase-badge">@zeus-web/radio-group/vue</span>
    </template>

    <DemoSection title="Basic">
      <RadioGroup default-value="daily" aria-label="Notification frequency">
        <RadioGroupItem value="daily">Daily</RadioGroupItem>
        <RadioGroupItem value="weekly">Weekly</RadioGroupItem>
        <RadioGroupItem value="monthly">Monthly</RadioGroupItem>
      </RadioGroup>
    </DemoSection>

    <DemoSection title="Orientation and sizes">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <strong>Horizontal</strong>
          <RadioGroup orientation="horizontal" default-value="staging">
            <RadioGroupItem value="dev">Dev</RadioGroupItem>
            <RadioGroupItem value="staging">Staging</RadioGroupItem>
            <RadioGroupItem value="prod">Prod</RadioGroupItem>
          </RadioGroup>
        </div>

        <div class="showcase-demo-card">
          <strong>Large</strong>
          <RadioGroup size="lg" default-value="owner">
            <RadioGroupItem value="viewer">Viewer</RadioGroupItem>
            <RadioGroupItem value="editor">Editor</RadioGroupItem>
            <RadioGroupItem value="owner">Owner</RadioGroupItem>
          </RadioGroup>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="2">
        <RadioGroup disabled default-value="disabled">
          <RadioGroupItem value="disabled">Disabled group</RadioGroupItem>
          <RadioGroupItem value="other">Other</RadioGroupItem>
        </RadioGroup>

        <RadioGroup invalid required default-value="required">
          <RadioGroupItem value="required">Required invalid</RadioGroupItem>
          <RadioGroupItem value="other">Other</RadioGroupItem>
        </RadioGroup>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <RadioGroup
          :value="value"
          name="vue-controlled-radio"
          @value-change="handleValueChange"
        >
          <RadioGroupItem value="daily">Daily</RadioGroupItem>
          <RadioGroupItem value="weekly">Weekly</RadioGroupItem>
          <RadioGroupItem value="monthly">Monthly</RadioGroupItem>
        </RadioGroup>

        <div class="showcase-demo-card">
          <strong>Selected</strong>
          <pre class="showcase-code">{{ value }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Emitted when selected value changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'value',
            type: 'string',
            description: 'Controlled selected value.',
          },
          {
            name: 'defaultValue',
            type: 'string',
            description: 'Initial uncontrolled value.',
          },
          {
            name: 'orientation',
            type: '\'horizontal\' | \'vertical\'',
            defaultValue: '\'vertical\'',
            description: 'Radio group layout direction.',
          },
          {
            name: 'size',
            type: '\'sm\' | \'md\' | \'lg\'',
            defaultValue: '\'md\'',
            description: 'Radio item size.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['primary', 'ring', 'muted-foreground']" />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <strong>Deployment strategy</strong>
        <RadioGroup default-value="rolling" name="deployment-strategy">
          <RadioGroupItem value="rolling">Rolling deployment</RadioGroupItem>
          <RadioGroupItem value="blue-green"
            >Blue/green deployment</RadioGroupItem
          >
          <RadioGroupItem value="canary">Canary deployment</RadioGroupItem>
        </RadioGroup>
      </div>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.8 新增 `examples/vue-showcase/src/demos/forms/SelectDemoPage.vue`

```vue
<script setup lang="ts">
import { Select } from '@zeus-web/select/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

const value = ref('production')
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
    title="Select capability page"
    description="Tests Select sizes, disabled/invalid states, controlled value, multiple mode and value/focus events."
  >
    <template #meta>
      <span class="showcase-badge">select</span>
      <span class="showcase-badge">@zeus-web/select/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="2">
        <Select default-value="staging" aria-label="Environment">
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </Select>

        <Select aria-label="Role" default-value="editor">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="owner">Owner</option>
        </Select>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes and states">
      <DemoGrid :columns="3">
        <Select size="sm" default-value="sm" aria-label="Small select">
          <option value="sm">Small</option>
        </Select>

        <Select size="md" default-value="md" aria-label="Medium select">
          <option value="md">Medium</option>
        </Select>

        <Select size="lg" default-value="lg" aria-label="Large select">
          <option value="lg">Large</option>
        </Select>

        <Select disabled default-value="disabled" aria-label="Disabled select">
          <option value="disabled">Disabled</option>
        </Select>

        <Select
          invalid
          aria-errormessage="select-error"
          aria-label="Invalid select"
        >
          <option value="">Choose one</option>
        </Select>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Select
          :value="value"
          name="vue-controlled-select"
          aria-label="Controlled environment"
          @value-change="handleValueChange"
          @focus-change="events.log('focus-change', $event)"
        >
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </Select>

        <div class="showcase-demo-card">
          <strong>Selected</strong>
          <pre class="showcase-code">{{ value }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Multiple">
      <Select multiple aria-label="Multiple select">
        <option value="rum">RUM</option>
        <option value="logs">Logs</option>
        <option value="traces">Traces</option>
        <option value="metrics">Metrics</option>
      </Select>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Emitted when selected value changes.',
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

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'value',
            type: 'string',
            description: 'Controlled selected value.',
          },
          {
            name: 'defaultValue',
            type: 'string',
            description: 'Initial uncontrolled value.',
          },
          {
            name: 'multiple',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Enables multiple selection.',
          },
          {
            name: 'invalid',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Marks select as invalid.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['input', 'ring', 'background', 'foreground']"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card showcase-form-stack">
        <label class="showcase-field">
          <span>Environment</span>
          <Select default-value="production" name="environment">
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </Select>
        </label>

        <label class="showcase-field">
          <span>Owner role</span>
          <Select default-value="owner" name="role">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </Select>
        </label>
      </div>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.9 新增 `examples/vue-showcase/src/__tests__/forms-demos.spec.ts`

```ts
import { mount } from '@vue/test-utils'

import { vueFormsDemoNames, vueFormsDemoPages } from '../demos/forms'
import { vueShowcaseDemoNames } from '../demos'

const expectedFormNames = ['label', 'radio-group', 'select', 'textarea']

describe('vue forms showcase demos', () => {
  it('registers form demo pages', () => {
    expect([...vueFormsDemoNames].sort()).toEqual(expectedFormNames)
  })

  it('merges form demos into the global showcase demo registry', () => {
    expect(vueShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedFormNames),
    )
  })

  it.each(expectedFormNames)('renders %s demo page', name => {
    const DemoPage = vueFormsDemoPages[name]

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
.showcase-form-stack {
  display: grid;
  gap: 1rem;
}

.showcase-form-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.showcase-form-note {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.5;
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

# Phase 5 完成标准

```txt
Phase 5 done 当且仅当：

1. React /components/label 渲染真实 Label demo。
2. React /components/textarea 渲染真实 Textarea demo。
3. React /components/radio-group 渲染真实 RadioGroup demo。
4. React /components/select 渲染真实 Select demo。
5. Vue 对应 4 个路由也渲染真实 demo。
6. 原 P0 六个组件仍正常。
7. 未实现组件继续回退 ComponentPageScaffold。
8. reactShowcaseDemoPages / vueShowcaseDemoPages 统一注册 P0 + Forms。
9. forms-demos 单测通过。
10. showcase:test 通过。
11. showcase:build 通过。
```

---

# 建议提交

```txt
feat(examples): add form showcase component pages
```

---

# 下一阶段建议

Phase 6 做 Layout / Feedback 批次：

```txt
card
badge
separator
skeleton
alert
progress
avatar
```

这一批更偏视觉状态和组合，不需要太多事件逻辑，适合继续扩大 showcase 覆盖面。
