下面给 **Phase 6：Visual / Feedback 批次真实能力页** 的详细设计与完整代码。

Phase 6 覆盖：

```txt id="d576kx"
card
badge
separator
skeleton
alert
progress
avatar
```

这批组件偏 **展示、布局、反馈、加载态、状态提示、头像占位**，事件逻辑少，适合继续扩大 showcase 覆盖面。

当前 API 依据：

- `Card` 是组合型组件，包含 `Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter`。
- `Badge` 支持 `variant` 和 `size`，variant 包含 `default / secondary / outline / danger / success / warning`。
- `Separator` 支持 `orientation` 和 `decorative`。
- `Skeleton` 支持 `variant` 和 `animated`。
- `Alert` 支持 `variant` 和 `live`，并包含 `AlertTitle / AlertDescription`。
- `Progress` 支持 `value / max / indeterminate / label`。
- `Avatar` 支持 `size / shape / imageStatus`，`AvatarImage` 有 `src / alt / loading / referrerPolicy` 和 `imageLoad / imageError` 事件，`AvatarFallback` 支持 `delayMs`。

---

# Phase 6 目标

```txt id="q8jp1n"
目标：
1. React Showcase 新增 card / badge / separator / skeleton / alert / progress / avatar 真实能力页。
2. Vue Showcase 新增对应 7 个真实能力页。
3. 将 visual / feedback demos 合并进统一 demo registry。
4. ComponentDetailPage 无需再改，只通过 registry 自动识别已实现页面。
5. showcase build/check/test 前构建 Phase 6 新增 primitive 包。
6. 新增 React/Vue visual demos registry 测试。
7. 补充 demo CSS，让这些 headless 组件在 showcase 里有可视化效果。
```

---

# 文件变更清单

```txt id="i8ush8"
examples/react-showcase/package.json
examples/react-showcase/src/demos/index.ts
examples/react-showcase/src/demos/visual/index.ts
examples/react-showcase/src/demos/visual/CardDemoPage.tsx
examples/react-showcase/src/demos/visual/BadgeDemoPage.tsx
examples/react-showcase/src/demos/visual/SeparatorDemoPage.tsx
examples/react-showcase/src/demos/visual/SkeletonDemoPage.tsx
examples/react-showcase/src/demos/visual/AlertDemoPage.tsx
examples/react-showcase/src/demos/visual/ProgressDemoPage.tsx
examples/react-showcase/src/demos/visual/AvatarDemoPage.tsx
examples/react-showcase/src/__tests__/visual-demos.spec.tsx
examples/react-showcase/src/app.css

examples/vue-showcase/package.json
examples/vue-showcase/src/demos/index.ts
examples/vue-showcase/src/demos/visual/index.ts
examples/vue-showcase/src/demos/visual/CardDemoPage.vue
examples/vue-showcase/src/demos/visual/BadgeDemoPage.vue
examples/vue-showcase/src/demos/visual/SeparatorDemoPage.vue
examples/vue-showcase/src/demos/visual/SkeletonDemoPage.vue
examples/vue-showcase/src/demos/visual/AlertDemoPage.vue
examples/vue-showcase/src/demos/visual/ProgressDemoPage.vue
examples/vue-showcase/src/demos/visual/AvatarDemoPage.vue
examples/vue-showcase/src/__tests__/visual-demos.spec.ts
examples/vue-showcase/src/app.css
```

---

# 1. React Showcase

## 1.1 替换 `examples/react-showcase/package.json`

```json id="0k23p3"
{
  "name": "@zeus-web/example-react-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build:deps": "pnpm -w --filter @zeus-web/icons --filter @zeus-web/button --filter @zeus-web/input --filter @zeus-web/checkbox --filter @zeus-web/switch --filter @zeus-web/tabs --filter @zeus-web/dialog --filter @zeus-web/label --filter @zeus-web/textarea --filter @zeus-web/radio-group --filter @zeus-web/select --filter @zeus-web/card --filter @zeus-web/badge --filter @zeus-web/separator --filter @zeus-web/skeleton --filter @zeus-web/alert --filter @zeus-web/progress --filter @zeus-web/avatar build",
    "dev": "pnpm build:deps && vite --host 0.0.0.0",
    "build": "pnpm build:deps && vite build",
    "check": "pnpm build:deps && tsc -p tsconfig.json --noEmit",
    "test": "pnpm build:deps && vitest --run"
  },
  "dependencies": {
    "@tanstack/react-router": "^1.114.0",
    "@zeus-web/alert": "workspace:*",
    "@zeus-web/avatar": "workspace:*",
    "@zeus-web/badge": "workspace:*",
    "@zeus-web/button": "workspace:*",
    "@zeus-web/card": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
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

## 1.2 新增 `examples/react-showcase/src/demos/visual/index.ts`

```ts id="8342zq"
import type { ComponentType } from 'react'

import { AlertDemoPage } from './AlertDemoPage'
import { AvatarDemoPage } from './AvatarDemoPage'
import { BadgeDemoPage } from './BadgeDemoPage'
import { CardDemoPage } from './CardDemoPage'
import { ProgressDemoPage } from './ProgressDemoPage'
import { SeparatorDemoPage } from './SeparatorDemoPage'
import { SkeletonDemoPage } from './SkeletonDemoPage'

export const reactVisualDemoPages: Record<string, ComponentType> = {
  card: CardDemoPage,
  badge: BadgeDemoPage,
  separator: SeparatorDemoPage,
  skeleton: SkeletonDemoPage,
  alert: AlertDemoPage,
  progress: ProgressDemoPage,
  avatar: AvatarDemoPage,
}

export const reactVisualDemoNames = Object.keys(reactVisualDemoPages)
```

---

## 1.3 替换 `examples/react-showcase/src/demos/index.ts`

```ts id="phjfic"
import type { ComponentType } from 'react'

import { reactFormsDemoPages } from './forms'
import { p0ReactDemoPages } from './p0'
import { reactVisualDemoPages } from './visual'

export const reactShowcaseDemoPages: Record<string, ComponentType> = {
  ...p0ReactDemoPages,
  ...reactFormsDemoPages,
  ...reactVisualDemoPages,
}

export const reactShowcaseDemoNames = Object.keys(reactShowcaseDemoPages)
```

---

## 1.4 新增 `examples/react-showcase/src/demos/visual/CardDemoPage.tsx`

```tsx id="ehczde"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@zeus-web/card/react'
import { Button } from '@zeus-web/button/react'
import { Badge } from '@zeus-web/badge/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

export function CardDemoPage() {
  return (
    <DemoPage
      eyebrow="Layout"
      title="Card capability page"
      description="Tests Card composition, header/content/footer layout, nested badges and production dashboard usage."
      meta={
        <>
          <span className="showcase-badge">card</span>
          <span className="showcase-badge">@zeus-web/card/react</span>
        </>
      }
    >
      <DemoSection title="Basic" description="Composable card regions.">
        <Card>
          <CardHeader>
            <CardTitle>Project health</CardTitle>
            <CardDescription>
              Current deployment quality and operational signals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="showcase-form-note">
              No critical regressions detected in the latest canary.
            </p>
          </CardContent>
          <CardFooter>
            <Button size="sm" variant="primary">
              View report
            </Button>
          </CardFooter>
        </Card>
      </DemoSection>

      <DemoSection
        title="Compositions"
        description="Cards can host badges, actions and metrics."
      >
        <DemoGrid columns={3}>
          <Card>
            <CardHeader>
              <CardTitle>Errors</CardTitle>
              <CardDescription>Last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="showcase-metric">12</div>
              <Badge variant="danger">+3</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Latency</CardTitle>
              <CardDescription>P95 response time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="showcase-metric">188ms</div>
              <Badge variant="success">stable</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>Active users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="showcase-metric">4.2k</div>
              <Badge variant="secondary">live</Badge>
            </CardContent>
          </Card>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable rows={[]} />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['card', 'card-foreground', 'border', 'muted-foreground']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-dashboard-grid">
          <Card>
            <CardHeader>
              <CardTitle>Release readiness</CardTitle>
              <CardDescription>Production deployment summary.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>All smoke checks passed. Canary traffic is healthy.</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline">Cancel</Button>
              <Button variant="primary">Ship release</Button>
            </CardFooter>
          </Card>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.5 新增 `examples/react-showcase/src/demos/visual/BadgeDemoPage.tsx`

```tsx id="269wts"
import { Badge } from '@zeus-web/badge/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

const variants = [
  'default',
  'secondary',
  'outline',
  'danger',
  'success',
  'warning',
] as const
const sizes = ['sm', 'md', 'lg'] as const

export function BadgeDemoPage() {
  return (
    <DemoPage
      eyebrow="Feedback"
      title="Badge capability page"
      description="Tests Badge variants, sizes and production status usage."
      meta={
        <>
          <span className="showcase-badge">badge</span>
          <span className="showcase-badge">@zeus-web/badge/react</span>
        </>
      }
    >
      <DemoSection title="Variants">
        <DemoGrid columns={3}>
          {variants.map(variant => (
            <div key={variant} className="showcase-demo-card">
              <Badge variant={variant}>{variant}</Badge>
            </div>
          ))}
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes">
        <DemoGrid columns={3}>
          {sizes.map(size => (
            <div key={size} className="showcase-demo-card">
              <Badge size={size}>{size}</Badge>
            </div>
          ))}
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-production-row">
          <Badge variant="success">healthy</Badge>
          <Badge variant="warning">degraded</Badge>
          <Badge variant="danger">incident</Badge>
          <Badge variant="outline">canary</Badge>
        </div>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'variant',
              type: "'default' | 'secondary' | 'outline' | 'danger' | 'success' | 'warning'",
              defaultValue: "'default'",
              description: 'Visual semantic variant.',
            },
            {
              name: 'size',
              type: "'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: 'Badge size.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['primary', 'secondary', 'destructive', 'border']}
        />
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.6 新增 `examples/react-showcase/src/demos/visual/SeparatorDemoPage.tsx`

```tsx id="qcsdy4"
import { Separator } from '@zeus-web/separator/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

export function SeparatorDemoPage() {
  return (
    <DemoPage
      eyebrow="Layout"
      title="Separator capability page"
      description="Tests horizontal, vertical, decorative and semantic separators."
      meta={
        <>
          <span className="showcase-badge">separator</span>
          <span className="showcase-badge">@zeus-web/separator/react</span>
        </>
      }
    >
      <DemoSection title="Horizontal">
        <div className="showcase-demo-card">
          <p>Account settings</p>
          <Separator />
          <p className="showcase-form-note">
            Configure billing, members and deployment permissions.
          </p>
        </div>
      </DemoSection>

      <DemoSection title="Vertical">
        <div className="showcase-demo-card showcase-toolbar-row">
          <span>Overview</span>
          <Separator orientation="vertical" />
          <span>Usage</span>
          <Separator orientation="vertical" />
          <span>Settings</span>
        </div>
      </DemoSection>

      <DemoSection title="Semantic separator">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <strong>Decorative</strong>
            <Separator decorative />
          </div>

          <div className="showcase-demo-card">
            <strong>Semantic</strong>
            <Separator decorative={false} orientation="horizontal" />
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'orientation',
              type: "'horizontal' | 'vertical'",
              defaultValue: "'horizontal'",
              description: 'Separator direction.',
            },
            {
              name: 'decorative',
              type: 'boolean',
              defaultValue: 'true',
              description:
                'Whether the separator is hidden from assistive tech.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['border', 'muted-foreground']} />
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.7 新增 `examples/react-showcase/src/demos/visual/SkeletonDemoPage.tsx`

```tsx id="e5h3vi"
import { Skeleton } from '@zeus-web/skeleton/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

export function SkeletonDemoPage() {
  return (
    <DemoPage
      eyebrow="Feedback"
      title="Skeleton capability page"
      description="Tests Skeleton variants, animation toggle and loading-card composition."
      meta={
        <>
          <span className="showcase-badge">skeleton</span>
          <span className="showcase-badge">@zeus-web/skeleton/react</span>
        </>
      }
    >
      <DemoSection title="Variants">
        <DemoGrid columns={3}>
          <div className="showcase-demo-card">
            <Skeleton variant="text" />
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>

          <div className="showcase-demo-card">
            <Skeleton variant="rect" />
          </div>

          <div className="showcase-demo-card">
            <Skeleton variant="circle" />
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Animation">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <strong>Animated</strong>
            <Skeleton animated variant="rect" />
          </div>

          <div className="showcase-demo-card">
            <strong>Static</strong>
            <Skeleton animated={false} variant="rect" />
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <div className="showcase-loading-row">
            <Skeleton variant="circle" />
            <div className="showcase-loading-stack">
              <Skeleton variant="text" />
              <Skeleton variant="text" />
            </div>
          </div>
          <Skeleton variant="rect" />
        </div>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'variant',
              type: "'text' | 'rect' | 'circle'",
              defaultValue: "'rect'",
              description: 'Skeleton shape variant.',
            },
            {
              name: 'animated',
              type: 'boolean',
              defaultValue: 'true',
              description: 'Enables loading animation.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['muted', 'muted-foreground']} />
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.8 新增 `examples/react-showcase/src/demos/visual/AlertDemoPage.tsx`

```tsx id="i0w2z5"
import { Alert, AlertDescription, AlertTitle } from '@zeus-web/alert/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

const variants = ['default', 'info', 'success', 'warning', 'danger'] as const

export function AlertDemoPage() {
  return (
    <DemoPage
      eyebrow="Feedback"
      title="Alert capability page"
      description="Tests Alert variants, live region behavior and production incident messaging."
      meta={
        <>
          <span className="showcase-badge">alert</span>
          <span className="showcase-badge">@zeus-web/alert/react</span>
        </>
      }
    >
      <DemoSection title="Variants">
        <DemoGrid columns={2}>
          {variants.map(variant => (
            <Alert key={variant} variant={variant}>
              <AlertTitle>{variant} alert</AlertTitle>
              <AlertDescription>
                This is a {variant} message for operational feedback.
              </AlertDescription>
            </Alert>
          ))}
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Live regions">
        <DemoGrid columns={3}>
          <Alert live="polite" variant="info">
            <AlertTitle>Polite</AlertTitle>
            <AlertDescription>Non-urgent background status.</AlertDescription>
          </Alert>

          <Alert live="assertive" variant="danger">
            <AlertTitle>Assertive</AlertTitle>
            <AlertDescription>
              Important incident notification.
            </AlertDescription>
          </Alert>

          <Alert live="off">
            <AlertTitle>Off</AlertTitle>
            <AlertDescription>Static decorative message.</AlertDescription>
          </Alert>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Production pattern">
        <Alert variant="warning" live="assertive">
          <AlertTitle>Canary degradation detected</AlertTitle>
          <AlertDescription>
            Error rate increased by 2.4% in the last 10 minutes. Check traces
            before promoting.
          </AlertDescription>
        </Alert>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'variant',
              type: "'default' | 'info' | 'success' | 'warning' | 'danger'",
              defaultValue: "'default'",
              description: 'Visual semantic alert variant.',
            },
            {
              name: 'live',
              type: "'polite' | 'assertive' | 'off'",
              defaultValue: "'polite'",
              description: 'ARIA live region politeness.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['background', 'foreground', 'destructive', 'border']}
        />
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.9 新增 `examples/react-showcase/src/demos/visual/ProgressDemoPage.tsx`

```tsx id="lmjxtq"
import { Progress } from '@zeus-web/progress/react'
import { useState } from 'react'

import { Button } from '@zeus-web/button/react'
import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

export function ProgressDemoPage() {
  const [value, setValue] = useState(64)

  return (
    <DemoPage
      eyebrow="Feedback"
      title="Progress capability page"
      description="Tests determinate, indeterminate, max/value clamping and production progress usage."
      meta={
        <>
          <span className="showcase-badge">progress</span>
          <span className="showcase-badge">@zeus-web/progress/react</span>
        </>
      }
    >
      <DemoSection title="Determinate">
        <DemoGrid columns={3}>
          <Progress value={24} label="Upload progress" />
          <Progress value={64} label="Build progress" />
          <Progress value={100} label="Complete progress" />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <div className="showcase-demo-card">
          <Progress value={value} max={100} label="Controlled progress">
            <span className="showcase-progress-label">{value}%</span>
          </Progress>

          <div className="showcase-production-row">
            <Button
              variant="outline"
              size="sm"
              onPress={() => setValue(current => Math.max(0, current - 10))}
            >
              -10
            </Button>
            <Button
              variant="primary"
              size="sm"
              onPress={() => setValue(current => Math.min(100, current + 10))}
            >
              +10
            </Button>
          </div>
        </div>
      </DemoSection>

      <DemoSection title="Indeterminate">
        <Progress indeterminate label="Loading deployment status" />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <strong>Release rollout</strong>
          <Progress value={72} label="Release rollout progress">
            <span className="showcase-progress-label">72% traffic shifted</span>
          </Progress>
        </div>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'value',
              type: 'number',
              description: 'Current determinate progress value.',
            },
            {
              name: 'max',
              type: 'number',
              defaultValue: '100',
              description: 'Maximum progress value.',
            },
            {
              name: 'indeterminate',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Shows loading state without a known value.',
            },
            {
              name: 'label',
              type: 'string',
              description: 'Accessible label for the progressbar.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['primary', 'muted', 'ring']} />
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.10 新增 `examples/react-showcase/src/demos/visual/AvatarDemoPage.tsx`

```tsx id="8d0b9c"
import { Avatar, AvatarFallback, AvatarImage } from '@zeus-web/avatar/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { useDemoEventLog } from '../p0/event-utils'

export function AvatarDemoPage() {
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Data display"
      title="Avatar capability page"
      description="Tests Avatar sizes, shapes, image/fallback composition and image load/error events."
      meta={
        <>
          <span className="showcase-badge">avatar</span>
          <span className="showcase-badge">@zeus-web/avatar/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={3}>
          <Avatar>
            <AvatarFallback>BC</AvatarFallback>
          </Avatar>

          <Avatar shape="square">
            <AvatarFallback>ZW</AvatarFallback>
          </Avatar>

          <Avatar imageStatus="error">
            <AvatarImage
              src="/missing-avatar.png"
              alt="Missing avatar"
              onImageError={(event: unknown) => {
                events.log('image-error', event)
              }}
            />
            <AvatarFallback>ER</AvatarFallback>
          </Avatar>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes and shapes">
        <DemoGrid columns={3}>
          <Avatar size="sm">
            <AvatarFallback>SM</AvatarFallback>
          </Avatar>

          <Avatar size="md">
            <AvatarFallback>MD</AvatarFallback>
          </Avatar>

          <Avatar size="lg">
            <AvatarFallback>LG</AvatarFallback>
          </Avatar>

          <Avatar shape="circle">
            <AvatarFallback>CI</AvatarFallback>
          </Avatar>

          <Avatar shape="square">
            <AvatarFallback>SQ</AvatarFallback>
          </Avatar>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Fallback">
        <DemoGrid columns={2}>
          <Avatar imageStatus="idle">
            <AvatarFallback delayMs={0}>JD</AvatarFallback>
          </Avatar>

          <Avatar imageStatus="loading">
            <AvatarFallback delayMs={300}>LD</AvatarFallback>
          </Avatar>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'image-load',
              reactName: 'onImageLoad',
              vueName: 'image-load',
              description: 'Emitted when avatar image loads.',
            },
            {
              name: 'image-error',
              reactName: 'onImageError',
              vueName: 'image-error',
              description: 'Emitted when avatar image fails.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'size',
              type: "'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: 'Avatar size.',
            },
            {
              name: 'shape',
              type: "'circle' | 'square'",
              defaultValue: "'circle'",
              description: 'Avatar shape.',
            },
            {
              name: 'imageStatus',
              type: "'idle' | 'loading' | 'loaded' | 'error'",
              defaultValue: "'idle'",
              description: 'Current image loading status.',
            },
            {
              name: 'delayMs',
              type: 'number',
              defaultValue: '0',
              description: 'AvatarFallback display delay in milliseconds.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['muted', 'muted-foreground', 'border']} />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-user-row">
          <Avatar size="lg">
            <AvatarFallback>BC</AvatarFallback>
          </Avatar>
          <div>
            <strong>bai cie</strong>
            <p className="showcase-form-note">Maintainer · Zeus Web</p>
          </div>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
```

---

## 1.11 新增 `examples/react-showcase/src/__tests__/visual-demos.spec.tsx`

```tsx id="ik7ya1"
import { render, screen } from '@testing-library/react'

import { reactShowcaseDemoNames } from '../demos'
import { reactVisualDemoNames, reactVisualDemoPages } from '../demos/visual'

const expectedVisualNames = [
  'alert',
  'avatar',
  'badge',
  'card',
  'progress',
  'separator',
  'skeleton',
]

describe('react visual showcase demos', () => {
  it('registers visual demo pages', () => {
    expect([...reactVisualDemoNames].sort()).toEqual(expectedVisualNames)
  })

  it('merges visual demos into the global showcase demo registry', () => {
    expect(reactShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedVisualNames),
    )
  })

  it.each(expectedVisualNames)('renders %s demo page', name => {
    const DemoPage = reactVisualDemoPages[name]

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

```json id="4g19gj"
{
  "name": "@zeus-web/example-vue-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build:deps": "pnpm -w --filter @zeus-web/button --filter @zeus-web/input --filter @zeus-web/checkbox --filter @zeus-web/switch --filter @zeus-web/tabs --filter @zeus-web/dialog --filter @zeus-web/label --filter @zeus-web/textarea --filter @zeus-web/radio-group --filter @zeus-web/select --filter @zeus-web/card --filter @zeus-web/badge --filter @zeus-web/separator --filter @zeus-web/skeleton --filter @zeus-web/alert --filter @zeus-web/progress --filter @zeus-web/avatar build",
    "dev": "pnpm build:deps && vite --host 0.0.0.0 --port 5174",
    "build": "pnpm build:deps && vite build",
    "check": "pnpm build:deps && vue-tsc -p tsconfig.json --noEmit",
    "test": "pnpm build:deps && vitest --run"
  },
  "dependencies": {
    "@zeus-web/alert": "workspace:*",
    "@zeus-web/avatar": "workspace:*",
    "@zeus-web/badge": "workspace:*",
    "@zeus-web/button": "workspace:*",
    "@zeus-web/card": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
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

## 2.2 新增 `examples/vue-showcase/src/demos/visual/index.ts`

```ts id="jiq1au"
import type { Component } from 'vue'

import AlertDemoPage from './AlertDemoPage.vue'
import AvatarDemoPage from './AvatarDemoPage.vue'
import BadgeDemoPage from './BadgeDemoPage.vue'
import CardDemoPage from './CardDemoPage.vue'
import ProgressDemoPage from './ProgressDemoPage.vue'
import SeparatorDemoPage from './SeparatorDemoPage.vue'
import SkeletonDemoPage from './SkeletonDemoPage.vue'

export const vueVisualDemoPages: Record<string, Component> = {
  card: CardDemoPage,
  badge: BadgeDemoPage,
  separator: SeparatorDemoPage,
  skeleton: SkeletonDemoPage,
  alert: AlertDemoPage,
  progress: ProgressDemoPage,
  avatar: AvatarDemoPage,
}

export const vueVisualDemoNames = Object.keys(vueVisualDemoPages)
```

---

## 2.3 替换 `examples/vue-showcase/src/demos/index.ts`

```ts id="g2toq4"
import type { Component } from 'vue'

import { p0VueDemoPages } from './p0'
import { vueFormsDemoPages } from './forms'
import { vueVisualDemoPages } from './visual'

export const vueShowcaseDemoPages: Record<string, Component> = {
  ...p0VueDemoPages,
  ...vueFormsDemoPages,
  ...vueVisualDemoPages,
}

export const vueShowcaseDemoNames = Object.keys(vueShowcaseDemoPages)
```

---

## 2.4 新增 `examples/vue-showcase/src/demos/visual/CardDemoPage.vue`

```vue id="dvfq0o"
<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@zeus-web/card/vue'
import { Badge } from '@zeus-web/badge/vue'
import { Button } from '@zeus-web/button/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
</script>

<template>
  <DemoPage
    eyebrow="Layout"
    title="Card capability page"
    description="Tests Card composition, header/content/footer layout, nested badges and production dashboard usage."
  >
    <template #meta>
      <span class="showcase-badge">card</span>
      <span class="showcase-badge">@zeus-web/card/vue</span>
    </template>

    <DemoSection title="Basic" description="Composable card regions.">
      <Card>
        <CardHeader>
          <CardTitle>Project health</CardTitle>
          <CardDescription>
            Current deployment quality and operational signals.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p class="showcase-form-note">
            No critical regressions detected in the latest canary.
          </p>
        </CardContent>

        <CardFooter>
          <Button size="sm" variant="primary">View report</Button>
        </CardFooter>
      </Card>
    </DemoSection>

    <DemoSection title="Compositions">
      <DemoGrid :columns="3">
        <Card>
          <CardHeader>
            <CardTitle>Errors</CardTitle>
            <CardDescription>Last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="showcase-metric">12</div>
            <Badge variant="danger">+3</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latency</CardTitle>
            <CardDescription>P95 response time</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="showcase-metric">188ms</div>
            <Badge variant="success">stable</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>Active users</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="showcase-metric">4.2k</div>
            <Badge variant="secondary">live</Badge>
          </CardContent>
        </Card>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="[]" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['card', 'card-foreground', 'border', 'muted-foreground']"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-dashboard-grid">
        <Card>
          <CardHeader>
            <CardTitle>Release readiness</CardTitle>
            <CardDescription>Production deployment summary.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>All smoke checks passed. Canary traffic is healthy.</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline">Cancel</Button>
            <Button variant="primary">Ship release</Button>
          </CardFooter>
        </Card>
      </div>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.5 新增 `examples/vue-showcase/src/demos/visual/BadgeDemoPage.vue`

```vue id="uz0d1m"
<script setup lang="ts">
import { Badge } from '@zeus-web/badge/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'

const variants = [
  'default',
  'secondary',
  'outline',
  'danger',
  'success',
  'warning',
] as const
const sizes = ['sm', 'md', 'lg'] as const
</script>

<template>
  <DemoPage
    eyebrow="Feedback"
    title="Badge capability page"
    description="Tests Badge variants, sizes and production status usage."
  >
    <template #meta>
      <span class="showcase-badge">badge</span>
      <span class="showcase-badge">@zeus-web/badge/vue</span>
    </template>

    <DemoSection title="Variants">
      <DemoGrid :columns="3">
        <div
          v-for="variant in variants"
          :key="variant"
          class="showcase-demo-card"
        >
          <Badge :variant="variant">{{ variant }}</Badge>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes">
      <DemoGrid :columns="3">
        <div v-for="size in sizes" :key="size" class="showcase-demo-card">
          <Badge :size="size">{{ size }}</Badge>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card showcase-production-row">
        <Badge variant="success">healthy</Badge>
        <Badge variant="warning">degraded</Badge>
        <Badge variant="danger">incident</Badge>
        <Badge variant="outline">canary</Badge>
      </div>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'variant',
            type: '\'default\' | \'secondary\' | \'outline\' | \'danger\' | \'success\' | \'warning\'',
            defaultValue: '\'default\'',
            description: 'Visual semantic variant.',
          },
          {
            name: 'size',
            type: '\'sm\' | \'md\' | \'lg\'',
            defaultValue: '\'md\'',
            description: 'Badge size.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['primary', 'secondary', 'destructive', 'border']"
      />
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.6 新增 `examples/vue-showcase/src/demos/visual/SeparatorDemoPage.vue`

```vue id="cqzb62"
<script setup lang="ts">
import { Separator } from '@zeus-web/separator/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
</script>

<template>
  <DemoPage
    eyebrow="Layout"
    title="Separator capability page"
    description="Tests horizontal, vertical, decorative and semantic separators."
  >
    <template #meta>
      <span class="showcase-badge">separator</span>
      <span class="showcase-badge">@zeus-web/separator/vue</span>
    </template>

    <DemoSection title="Horizontal">
      <div class="showcase-demo-card">
        <p>Account settings</p>
        <Separator />
        <p class="showcase-form-note">
          Configure billing, members and deployment permissions.
        </p>
      </div>
    </DemoSection>

    <DemoSection title="Vertical">
      <div class="showcase-demo-card showcase-toolbar-row">
        <span>Overview</span>
        <Separator orientation="vertical" />
        <span>Usage</span>
        <Separator orientation="vertical" />
        <span>Settings</span>
      </div>
    </DemoSection>

    <DemoSection title="Semantic separator">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <strong>Decorative</strong>
          <Separator decorative />
        </div>

        <div class="showcase-demo-card">
          <strong>Semantic</strong>
          <Separator :decorative="false" orientation="horizontal" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'orientation',
            type: '\'horizontal\' | \'vertical\'',
            defaultValue: '\'horizontal\'',
            description: 'Separator direction.',
          },
          {
            name: 'decorative',
            type: 'boolean',
            defaultValue: 'true',
            description: 'Whether the separator is hidden from assistive tech.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['border', 'muted-foreground']" />
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.7 新增 `examples/vue-showcase/src/demos/visual/SkeletonDemoPage.vue`

```vue id="xk7yz9"
<script setup lang="ts">
import { Skeleton } from '@zeus-web/skeleton/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
</script>

<template>
  <DemoPage
    eyebrow="Feedback"
    title="Skeleton capability page"
    description="Tests Skeleton variants, animation toggle and loading-card composition."
  >
    <template #meta>
      <span class="showcase-badge">skeleton</span>
      <span class="showcase-badge">@zeus-web/skeleton/vue</span>
    </template>

    <DemoSection title="Variants">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Skeleton variant="text" />
          <Skeleton variant="text" />
          <Skeleton variant="text" />
        </div>

        <div class="showcase-demo-card">
          <Skeleton variant="rect" />
        </div>

        <div class="showcase-demo-card">
          <Skeleton variant="circle" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Animation">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <strong>Animated</strong>
          <Skeleton animated variant="rect" />
        </div>

        <div class="showcase-demo-card">
          <strong>Static</strong>
          <Skeleton :animated="false" variant="rect" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <div class="showcase-loading-row">
          <Skeleton variant="circle" />
          <div class="showcase-loading-stack">
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>
        </div>
        <Skeleton variant="rect" />
      </div>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'variant',
            type: '\'text\' | \'rect\' | \'circle\'',
            defaultValue: '\'rect\'',
            description: 'Skeleton shape variant.',
          },
          {
            name: 'animated',
            type: 'boolean',
            defaultValue: 'true',
            description: 'Enables loading animation.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['muted', 'muted-foreground']" />
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.8 新增 `examples/vue-showcase/src/demos/visual/AlertDemoPage.vue`

```vue id="3i6yd4"
<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@zeus-web/alert/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'

const variants = ['default', 'info', 'success', 'warning', 'danger'] as const
</script>

<template>
  <DemoPage
    eyebrow="Feedback"
    title="Alert capability page"
    description="Tests Alert variants, live region behavior and production incident messaging."
  >
    <template #meta>
      <span class="showcase-badge">alert</span>
      <span class="showcase-badge">@zeus-web/alert/vue</span>
    </template>

    <DemoSection title="Variants">
      <DemoGrid :columns="2">
        <Alert v-for="variant in variants" :key="variant" :variant="variant">
          <AlertTitle>{{ variant }} alert</AlertTitle>
          <AlertDescription>
            This is a {{ variant }} message for operational feedback.
          </AlertDescription>
        </Alert>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Live regions">
      <DemoGrid :columns="3">
        <Alert live="polite" variant="info">
          <AlertTitle>Polite</AlertTitle>
          <AlertDescription>Non-urgent background status.</AlertDescription>
        </Alert>

        <Alert live="assertive" variant="danger">
          <AlertTitle>Assertive</AlertTitle>
          <AlertDescription>Important incident notification.</AlertDescription>
        </Alert>

        <Alert live="off">
          <AlertTitle>Off</AlertTitle>
          <AlertDescription>Static decorative message.</AlertDescription>
        </Alert>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Production pattern">
      <Alert variant="warning" live="assertive">
        <AlertTitle>Canary degradation detected</AlertTitle>
        <AlertDescription>
          Error rate increased by 2.4% in the last 10 minutes. Check traces
          before promoting.
        </AlertDescription>
      </Alert>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'variant',
            type: '\'default\' | \'info\' | \'success\' | \'warning\' | \'danger\'',
            defaultValue: '\'default\'',
            description: 'Visual semantic alert variant.',
          },
          {
            name: 'live',
            type: '\'polite\' | \'assertive\' | \'off\'',
            defaultValue: '\'polite\'',
            description: 'ARIA live region politeness.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['background', 'foreground', 'destructive', 'border']"
      />
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.9 新增 `examples/vue-showcase/src/demos/visual/ProgressDemoPage.vue`

```vue id="malho3"
<script setup lang="ts">
import { Button } from '@zeus-web/button/vue'
import { Progress } from '@zeus-web/progress/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'

const value = ref(64)

function decrease() {
  value.value = Math.max(0, value.value - 10)
}

function increase() {
  value.value = Math.min(100, value.value + 10)
}
</script>

<template>
  <DemoPage
    eyebrow="Feedback"
    title="Progress capability page"
    description="Tests determinate, indeterminate, max/value clamping and production progress usage."
  >
    <template #meta>
      <span class="showcase-badge">progress</span>
      <span class="showcase-badge">@zeus-web/progress/vue</span>
    </template>

    <DemoSection title="Determinate">
      <DemoGrid :columns="3">
        <Progress :value="24" label="Upload progress" />
        <Progress :value="64" label="Build progress" />
        <Progress :value="100" label="Complete progress" />
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <div class="showcase-demo-card">
        <Progress :value="value" :max="100" label="Controlled progress">
          <span class="showcase-progress-label">{{ value }}%</span>
        </Progress>

        <div class="showcase-production-row">
          <Button variant="outline" size="sm" @press="decrease">-10</Button>
          <Button variant="primary" size="sm" @press="increase">+10</Button>
        </div>
      </div>
    </DemoSection>

    <DemoSection title="Indeterminate">
      <Progress indeterminate label="Loading deployment status" />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <strong>Release rollout</strong>
        <Progress :value="72" label="Release rollout progress">
          <span class="showcase-progress-label">72% traffic shifted</span>
        </Progress>
      </div>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'value',
            type: 'number',
            description: 'Current determinate progress value.',
          },
          {
            name: 'max',
            type: 'number',
            defaultValue: '100',
            description: 'Maximum progress value.',
          },
          {
            name: 'indeterminate',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Shows loading state without a known value.',
          },
          {
            name: 'label',
            type: 'string',
            description: 'Accessible label for the progressbar.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['primary', 'muted', 'ring']" />
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.10 新增 `examples/vue-showcase/src/demos/visual/AvatarDemoPage.vue`

```vue id="9e8zmz"
<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@zeus-web/avatar/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { useDemoEventLog } from '../p0/event-utils'

const events = useDemoEventLog()
</script>

<template>
  <DemoPage
    eyebrow="Data display"
    title="Avatar capability page"
    description="Tests Avatar sizes, shapes, image/fallback composition and image load/error events."
  >
    <template #meta>
      <span class="showcase-badge">avatar</span>
      <span class="showcase-badge">@zeus-web/avatar/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="3">
        <Avatar>
          <AvatarFallback>BC</AvatarFallback>
        </Avatar>

        <Avatar shape="square">
          <AvatarFallback>ZW</AvatarFallback>
        </Avatar>

        <Avatar image-status="error">
          <AvatarImage
            src="/missing-avatar.png"
            alt="Missing avatar"
            @image-error="events.log('image-error', $event)"
          />
          <AvatarFallback>ER</AvatarFallback>
        </Avatar>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes and shapes">
      <DemoGrid :columns="3">
        <Avatar size="sm">
          <AvatarFallback>SM</AvatarFallback>
        </Avatar>

        <Avatar size="md">
          <AvatarFallback>MD</AvatarFallback>
        </Avatar>

        <Avatar size="lg">
          <AvatarFallback>LG</AvatarFallback>
        </Avatar>

        <Avatar shape="circle">
          <AvatarFallback>CI</AvatarFallback>
        </Avatar>

        <Avatar shape="square">
          <AvatarFallback>SQ</AvatarFallback>
        </Avatar>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Fallback">
      <DemoGrid :columns="2">
        <Avatar image-status="idle">
          <AvatarFallback :delay-ms="0">JD</AvatarFallback>
        </Avatar>

        <Avatar image-status="loading">
          <AvatarFallback :delay-ms="300">LD</AvatarFallback>
        </Avatar>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'image-load',
            reactName: 'onImageLoad',
            vueName: 'image-load',
            description: 'Emitted when avatar image loads.',
          },
          {
            name: 'image-error',
            reactName: 'onImageError',
            vueName: 'image-error',
            description: 'Emitted when avatar image fails.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'size',
            type: '\'sm\' | \'md\' | \'lg\'',
            defaultValue: '\'md\'',
            description: 'Avatar size.',
          },
          {
            name: 'shape',
            type: '\'circle\' | \'square\'',
            defaultValue: '\'circle\'',
            description: 'Avatar shape.',
          },
          {
            name: 'imageStatus',
            type: '\'idle\' | \'loading\' | \'loaded\' | \'error\'',
            defaultValue: '\'idle\'',
            description: 'Current image loading status.',
          },
          {
            name: 'delayMs',
            type: 'number',
            defaultValue: '0',
            description: 'AvatarFallback display delay in milliseconds.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['muted', 'muted-foreground', 'border']" />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card showcase-user-row">
        <Avatar size="lg">
          <AvatarFallback>BC</AvatarFallback>
        </Avatar>

        <div>
          <strong>bai cie</strong>
          <p class="showcase-form-note">Maintainer · Zeus Web</p>
        </div>
      </div>
    </DemoSection>
  </DemoPage>
</template>
```

---

## 2.11 新增 `examples/vue-showcase/src/__tests__/visual-demos.spec.ts`

```ts id="0ejfue"
import { mount } from '@vue/test-utils'

import { vueShowcaseDemoNames } from '../demos'
import { vueVisualDemoNames, vueVisualDemoPages } from '../demos/visual'

const expectedVisualNames = [
  'alert',
  'avatar',
  'badge',
  'card',
  'progress',
  'separator',
  'skeleton',
]

describe('vue visual showcase demos', () => {
  it('registers visual demo pages', () => {
    expect([...vueVisualDemoNames].sort()).toEqual(expectedVisualNames)
  })

  it('merges visual demos into the global showcase demo registry', () => {
    expect(vueShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedVisualNames),
    )
  })

  it.each(expectedVisualNames)('renders %s demo page', name => {
    const DemoPage = vueVisualDemoPages[name]

    expect(DemoPage).toBeTruthy()

    const wrapper = mount(DemoPage)

    expect(wrapper.text()).toContain('capability page')
  })
})
```

---

# 3. CSS 追加到 React/Vue 两边

追加到：

```txt id="ld8lhf"
examples/react-showcase/src/app.css
examples/vue-showcase/src/app.css
```

```css id="99ri9b"
zw-card,
zw-alert {
  display: block;
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
}

zw-card {
  overflow: hidden;
}

zw-card-header,
zw-card-content,
zw-card-footer {
  display: block;
  padding: 1rem;
}

zw-card-header {
  border-bottom: 1px solid hsl(var(--border));
}

zw-card-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  border-top: 1px solid hsl(var(--border));
}

zw-card-title,
zw-alert-title {
  display: block;
  font-weight: 700;
}

zw-card-description,
zw-alert-description {
  display: block;
  margin-top: 0.25rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.5;
}

zw-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  font-weight: 700;
  line-height: 1;
}

zw-badge[data-size='sm'] {
  padding: 0.125rem 0.45rem;
  font-size: 0.7rem;
}

zw-badge[data-size='md'] {
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
}

zw-badge[data-size='lg'] {
  padding: 0.28rem 0.75rem;
  font-size: 0.85rem;
}

zw-badge[data-variant='default'] {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

zw-badge[data-variant='secondary'] {
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

zw-badge[data-variant='outline'] {
  border-color: hsl(var(--border));
  color: hsl(var(--foreground));
}

zw-badge[data-variant='danger'] {
  background: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
}

zw-badge[data-variant='success'] {
  background: hsl(142 72% 29%);
  color: white;
}

zw-badge[data-variant='warning'] {
  background: hsl(38 92% 50%);
  color: hsl(38 92% 10%);
}

zw-separator {
  display: block;
  flex: none;
  background: hsl(var(--border));
}

zw-separator[data-orientation='horizontal'] {
  width: 100%;
  height: 1px;
}

zw-separator[data-orientation='vertical'] {
  width: 1px;
  height: 1.5rem;
}

zw-skeleton {
  display: block;
  background: hsl(var(--muted));
  position: relative;
  overflow: hidden;
}

zw-skeleton[data-variant='text'] {
  height: 0.85rem;
  width: 100%;
  border-radius: 999px;
}

zw-skeleton[data-variant='rect'] {
  height: 5rem;
  width: 100%;
  border-radius: 0.75rem;
}

zw-skeleton[data-variant='circle'] {
  width: 4rem;
  height: 4rem;
  border-radius: 999px;
}

zw-skeleton[data-animated]::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    hsl(var(--background) / 0.65),
    transparent
  );
  animation: showcase-skeleton 1.4s infinite;
}

@keyframes showcase-skeleton {
  100% {
    transform: translateX(100%);
  }
}

zw-alert {
  padding: 1rem;
}

zw-alert[data-variant='info'] {
  border-color: hsl(217 91% 60% / 0.45);
}

zw-alert[data-variant='success'] {
  border-color: hsl(142 72% 29% / 0.45);
}

zw-alert[data-variant='warning'] {
  border-color: hsl(38 92% 50% / 0.55);
}

zw-alert[data-variant='danger'] {
  border-color: hsl(var(--destructive) / 0.55);
}

zw-progress {
  display: grid;
  gap: 0.5rem;
  width: 100%;
}

zw-progress::part(root) {
  width: 100%;
}

zw-progress span[data-slot='progress-indicator'] {
  display: block;
  height: 0.65rem;
  border-radius: 999px;
  background: hsl(var(--primary));
  width: calc(var(--showcase-progress-value, 1) * 1%);
}

zw-progress[data-state='indeterminate'] span[data-slot='progress-indicator'] {
  width: 45%;
  animation: showcase-progress-indeterminate 1.2s infinite ease-in-out;
}

zw-progress {
  position: relative;
  min-height: 0.65rem;
  border-radius: 999px;
  background: hsl(var(--muted));
  overflow: hidden;
}

zw-progress[data-percent='0'] {
  --showcase-progress-value: 0;
}

zw-progress[data-percent='24'] {
  --showcase-progress-value: 24;
}

zw-progress[data-percent='64'] {
  --showcase-progress-value: 64;
}

zw-progress[data-percent='72'] {
  --showcase-progress-value: 72;
}

zw-progress[data-percent='100'] {
  --showcase-progress-value: 100;
}

@keyframes showcase-progress-indeterminate {
  0% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(260%);
  }
}

.showcase-progress-label {
  display: block;
  margin-top: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

zw-avatar {
  display: inline-grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-weight: 800;
}

zw-avatar[data-size='sm'] {
  width: 2rem;
  height: 2rem;
  font-size: 0.75rem;
}

zw-avatar[data-size='md'] {
  width: 2.75rem;
  height: 2.75rem;
  font-size: 0.875rem;
}

zw-avatar[data-size='lg'] {
  width: 4rem;
  height: 4rem;
  font-size: 1.125rem;
}

zw-avatar[data-shape='circle'] {
  border-radius: 999px;
}

zw-avatar[data-shape='square'] {
  border-radius: 0.75rem;
}

zw-avatar-image,
zw-avatar-fallback {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
}

zw-avatar-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.showcase-dashboard-grid {
  display: grid;
  gap: 1rem;
}

.showcase-metric {
  margin-bottom: 0.75rem;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.showcase-toolbar-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.showcase-loading-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: center;
}

.showcase-loading-stack {
  display: grid;
  gap: 0.5rem;
}

.showcase-user-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}
```

---

# 4. 注意：Progress 宽度问题

当前 `Progress` 组件会输出 `data-percent`。
上面的 CSS 为常用 demo 值写了：

```css id="8mm11v"
zw-progress[data-percent='24'] {
  --showcase-progress-value: 24;
}
zw-progress[data-percent='64'] {
  --showcase-progress-value: 64;
}
zw-progress[data-percent='72'] {
  --showcase-progress-value: 72;
}
zw-progress[data-percent='100'] {
  --showcase-progress-value: 100;
}
```

这只是 showcase demo 的临时可视化方案。后续如果要支持任意值，建议在 Progress primitive 内部直接写 CSS var，例如：

```txt id="z2nj3k"
style="--progress-percent: 72%"
```

但 Phase 6 不改 primitive，只做 showcase 页。

---

# 5. 验收命令

```bash id="f36svd"
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

```bash id="loegvj"
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

# Phase 6 完成标准

```txt id="bs6i1w"
Phase 6 done 当且仅当：

1. React /components/card 渲染真实 Card demo。
2. React /components/badge 渲染真实 Badge demo。
3. React /components/separator 渲染真实 Separator demo。
4. React /components/skeleton 渲染真实 Skeleton demo。
5. React /components/alert 渲染真实 Alert demo。
6. React /components/progress 渲染真实 Progress demo。
7. React /components/avatar 渲染真实 Avatar demo。
8. Vue 对应 7 个路由也渲染真实 demo。
9. reactShowcaseDemoPages / vueShowcaseDemoPages 统一注册 P0 + Forms + Visual。
10. visual-demos 单测通过。
11. showcase:test 通过。
12. showcase:build 通过。
```

---

# 建议提交

```txt id="v2tqxr"
feat(examples): add visual showcase component pages
```

---

# 下一阶段建议

Phase 7 做 Disclosure / Navigation 批次：

```txt id="oqwde6"
collapsible
accordion
tooltip
```

这批要重点处理：

```txt id="0sm2eq"
1. controlled / uncontrolled open state
2. keyboard interaction
3. event log
4. hover/focus/toggle preview
5. tooltip 的定位和延迟策略
```

如果 Phase 7 做完，当前 20 个 beta 组件就只剩少量未完成项，showcase 基本成型。
