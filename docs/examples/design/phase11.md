下面给 Phase 11：**Playground Page 完整化**。

当前仓库里 `/playground` 还是占位：React 只展示 3 个 `planned` 场景 card，并说明后续才会做 admin dashboard、settings form、project creation flow。 Vue 也是同样占位。
依赖已经足够：React/Vue showcase 都已经依赖 button、input、select、checkbox、switch、dialog、alert、badge、progress、icons、themes 等包。

Phase 11 不改 Web-C runtime 懒加载路线；那条线仍然是组件库提供 loader/auto、runtime 只提供 bootstrapLazy/HostRef/ProxyElement。

---

# Phase 11 目标

```txt id="fyq0qf"
Playground Page:
  - Admin dashboard 真实组合场景
  - Settings form 真实组合场景
  - Project creation flow 真实组合场景
  - React / Vue 双端一致
  - 使用现有 Zeus Web 组件组合，而不是纯 HTML 静态卡片
  - 支持基础状态切换、表单输入、环境选择、事件日志
  - 增加单测覆盖场景切换、表单状态、创建流程文案
```

---

# 变更文件

```txt id="gk2765"
examples/showcase-shared/src/types.ts
examples/showcase-shared/src/playground.ts
examples/showcase-shared/src/index.ts

examples/react-showcase/src/routes/PlaygroundPage.tsx
examples/react-showcase/src/routes/PlaygroundPage.test.tsx
examples/react-showcase/src/app.css

examples/vue-showcase/src/routes/PlaygroundPage.vue
examples/vue-showcase/src/routes/PlaygroundPage.spec.ts
examples/vue-showcase/src/app.css

docs/internal/examples/showcase-roadmap.md
```

---

# 1. 修改 `examples/showcase-shared/src/types.ts`

在文件末尾 `ShowcaseValidationResult` 前追加：

```ts id="gorh02"
export type ShowcasePlaygroundScenarioId =
  | 'admin-dashboard'
  | 'settings-form'
  | 'project-creation'

export interface ShowcasePlaygroundScenario {
  id: ShowcasePlaygroundScenarioId
  title: string
  description: string
  components: string[]
}

export type ShowcasePlaygroundServiceStatus =
  | 'healthy'
  | 'degraded'
  | 'incident'

export interface ShowcasePlaygroundService {
  name: string
  owner: string
  status: ShowcasePlaygroundServiceStatus
  uptime: number
  latency: number
  errorRate: number
}

export interface ShowcasePlaygroundActivity {
  id: string
  title: string
  description: string
  tone: 'info' | 'success' | 'warning' | 'danger'
}

export interface ShowcasePlaygroundProjectTemplate {
  value: string
  label: string
  description: string
}
```

---

# 2. 新增 `examples/showcase-shared/src/playground.ts`

```ts id="ae37xq"
import type {
  ShowcasePlaygroundActivity,
  ShowcasePlaygroundProjectTemplate,
  ShowcasePlaygroundScenario,
  ShowcasePlaygroundService,
} from './types'

export const playgroundScenarios: ShowcasePlaygroundScenario[] = [
  {
    id: 'admin-dashboard',
    title: 'Admin dashboard',
    description:
      'Operational dashboard composed with cards, badges, progress, alerts and controls.',
    components: [
      '@zeus-web/alert',
      '@zeus-web/badge',
      '@zeus-web/button',
      '@zeus-web/progress',
      '@zeus-web/select',
      '@zeus-web/switch',
    ],
  },
  {
    id: 'settings-form',
    title: 'Settings form',
    description:
      'Production settings form composed with inputs, selects, checkboxes and switches.',
    components: [
      '@zeus-web/button',
      '@zeus-web/checkbox',
      '@zeus-web/input',
      '@zeus-web/select',
      '@zeus-web/switch',
    ],
  },
  {
    id: 'project-creation',
    title: 'Project creation',
    description:
      'Project creation flow composed with dialog, form controls, validation and event logs.',
    components: [
      '@zeus-web/dialog',
      '@zeus-web/input',
      '@zeus-web/select',
      '@zeus-web/checkbox',
      '@zeus-web/button',
      '@zeus-web/badge',
    ],
  },
]

export const playgroundDashboardServices: ShowcasePlaygroundService[] = [
  {
    name: 'RUM Collector',
    owner: 'Frontend Platform',
    status: 'healthy',
    uptime: 99.98,
    latency: 42,
    errorRate: 0.03,
  },
  {
    name: 'Replay Worker',
    owner: 'Observability',
    status: 'degraded',
    uptime: 99.12,
    latency: 118,
    errorRate: 0.41,
  },
  {
    name: 'Release API',
    owner: 'Developer Experience',
    status: 'incident',
    uptime: 97.82,
    latency: 246,
    errorRate: 2.18,
  },
]

export const playgroundActivityItems: ShowcasePlaygroundActivity[] = [
  {
    id: 'deploy-canary',
    title: 'Canary rollout started',
    description: 'zeus-web@0.1.0-beta.8 is rolling out to staging.',
    tone: 'info',
  },
  {
    id: 'rum-healthy',
    title: 'RUM collector recovered',
    description: 'Error rate returned below 0.1% after retry policy update.',
    tone: 'success',
  },
  {
    id: 'replay-lag',
    title: 'Replay worker lag detected',
    description: 'Compression queue latency is above the warning threshold.',
    tone: 'warning',
  },
]

export const playgroundProjectTemplates: ShowcasePlaygroundProjectTemplate[] = [
  {
    value: 'component-library',
    label: 'Component library',
    description: 'Design system package with React, Vue and Web-C outputs.',
  },
  {
    value: 'dashboard',
    label: 'Dashboard app',
    description: 'Internal admin dashboard with forms, tables and alerts.',
  },
  {
    value: 'docs',
    label: 'Documentation site',
    description: 'Documentation app with examples and component usage pages.',
  },
]

export function getPlaygroundScenario(
  id: ShowcasePlaygroundScenario['id'],
): ShowcasePlaygroundScenario {
  return (
    playgroundScenarios.find(scenario => scenario.id === id) ??
    playgroundScenarios[0]
  )
}
```

---

# 3. 修改 `examples/showcase-shared/src/index.ts`

增加一行：

```ts id="ujb0dj"
export * from './playground'
```

最终：

```ts id="jzwn1h"
export * from './components'
export * from './demo'
export * from './icon-snippets'
export * from './icons'
export * from './implemented'
export * from './playground'
export * from './routes'
export * from './themes'
export * from './types'
export * from './validate'
```

---

# 4. 替换 `examples/react-showcase/src/routes/PlaygroundPage.tsx`

```tsx id="jbl5vm"
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@zeus-web/alert/react'
import { Badge } from '@zeus-web/badge/react'
import { Button } from '@zeus-web/button/react'
import { Checkbox } from '@zeus-web/checkbox/react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@zeus-web/dialog/react'
import { Input } from '@zeus-web/input/react'
import { Progress } from '@zeus-web/progress/react'
import { Select } from '@zeus-web/select/react'
import { Switch } from '@zeus-web/switch/react'

import {
  playgroundActivityItems,
  playgroundDashboardServices,
  playgroundProjectTemplates,
  playgroundScenarios,
  type ShowcasePlaygroundActivity,
  type ShowcasePlaygroundScenarioId,
  type ShowcasePlaygroundService,
  type ShowcasePlaygroundServiceStatus,
} from '@zeus-web/example-showcase-shared'

type ProgressStyle = CSSProperties & {
  '--showcase-progress-value': number
}

interface PlaygroundEvent {
  id: number
  name: string
  detail: string
}

function progressStyle(value: number): ProgressStyle {
  return {
    '--showcase-progress-value': value,
  }
}

function readDetailValue(event: unknown, fallback = ''): string {
  const detail = (event as { detail?: { value?: unknown } })?.detail
  return typeof detail?.value === 'string' ? detail.value : fallback
}

function readDetailChecked(event: unknown, fallback: boolean): boolean {
  const detail = (event as { detail?: { checked?: unknown } })?.detail
  return typeof detail?.checked === 'boolean' ? detail.checked : fallback
}

function readDetailOpen(event: unknown, fallback: boolean): boolean {
  const detail = (event as { detail?: { open?: unknown } })?.detail
  return typeof detail?.open === 'boolean' ? detail.open : fallback
}

function statusVariant(status: ShowcasePlaygroundServiceStatus) {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'degraded':
      return 'warning'
    case 'incident':
      return 'danger'
    default:
      return 'secondary'
  }
}

function activityVariant(tone: ShowcasePlaygroundActivity['tone']) {
  switch (tone) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'danger':
      return 'danger'
    case 'info':
    default:
      return 'info'
  }
}

export function PlaygroundPage() {
  const [activeScenario, setActiveScenario] =
    useState<ShowcasePlaygroundScenarioId>('admin-dashboard')
  const [environment, setEnvironment] = useState('production')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [strictMode, setStrictMode] = useState(true)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true)
  const [releaseProgress, setReleaseProgress] = useState(68)
  const [organizationName, setOrganizationName] = useState('Zeus Platform')
  const [projectName, setProjectName] = useState('zeus-showcase')
  const [projectTemplate, setProjectTemplate] = useState('component-library')
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [createdProjects, setCreatedProjects] = useState<string[]>([
    'zeus-ui',
    'zeus-docs',
  ])
  const [events, setEvents] = useState<PlaygroundEvent[]>([])

  const scenario = useMemo(() => {
    return playgroundScenarios.find(item => item.id === activeScenario)
  }, [activeScenario])

  const degradedServices = playgroundDashboardServices.filter(
    service => service.status !== 'healthy',
  )
  const organizationInvalid = organizationName.trim().length < 3
  const projectNameInvalid = projectName.trim().length < 3

  function logEvent(name: string, detail: string) {
    setEvents(current =>
      [
        {
          id: Date.now(),
          name,
          detail,
        },
        ...current,
      ].slice(0, 6),
    )
  }

  function createProject() {
    if (projectNameInvalid) {
      logEvent('project-create-blocked', 'Project name is too short.')
      return
    }

    setCreatedProjects(current => {
      if (current.includes(projectName.trim())) {
        return current
      }

      return [projectName.trim(), ...current]
    })
    setProjectDialogOpen(false)
    logEvent(
      'project-created',
      `${projectName.trim()} · ${projectTemplate} · ${environment}`,
    )
  }

  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Playground</p>
        <h1 className="showcase-title">Production composition playground</h1>
        <p className="showcase-description">
          Validate how Zeus Web components compose in production-like screens:
          dashboard operations, settings forms and project creation flows.
        </p>

        <div className="showcase-page-meta">
          <span className="showcase-badge">
            {playgroundScenarios.length} scenarios
          </span>
          <span className="showcase-badge">React + Vue parity</span>
          <span className="showcase-badge">stateful composition</span>
        </div>
      </header>

      <section className="showcase-playground-layout">
        <aside className="showcase-playground-sidebar">
          <h2>Scenarios</h2>

          <div className="showcase-playground-nav">
            {playgroundScenarios.map(item => (
              <button
                key={item.id}
                type="button"
                className="showcase-playground-nav-item"
                data-active={item.id === activeScenario}
                aria-pressed={item.id === activeScenario}
                onClick={() => setActiveScenario(item.id)}
              >
                <span>{item.title}</span>
                <small>{item.description}</small>
              </button>
            ))}
          </div>

          <div className="showcase-playground-stack">
            <h3>Components used</h3>
            <div className="showcase-playground-badges">
              {scenario?.components.map(component => (
                <span key={component} className="showcase-badge">
                  {component}
                </span>
              ))}
            </div>
          </div>

          <div className="showcase-playground-event-log">
            <h3>Event log</h3>
            {events.length > 0 ? (
              <ol>
                {events.map(event => (
                  <li key={event.id}>
                    <strong>{event.name}</strong>
                    <span>{event.detail}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>
                No events yet. Interact with controls to record state changes.
              </p>
            )}
          </div>
        </aside>

        <main className="showcase-playground-main">
          {activeScenario === 'admin-dashboard' && (
            <section className="showcase-playground-panel">
              <div className="showcase-playground-panel-header">
                <div>
                  <span className="showcase-badge">Admin dashboard</span>
                  <h2>Operational overview</h2>
                  <p>
                    Realistic monitoring shell with environment filter, rollout
                    progress, service health and live activity.
                  </p>
                </div>

                <div className="showcase-playground-actions">
                  <Select
                    value={environment}
                    aria-label="Dashboard environment"
                    onValueChange={(event: unknown) => {
                      const next = readDetailValue(event, environment)
                      setEnvironment(next)
                      logEvent('environment-change', next)
                    }}
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </Select>

                  <Switch
                    checked={autoRefresh}
                    onCheckedChange={(event: unknown) => {
                      const next = readDetailChecked(event, autoRefresh)
                      setAutoRefresh(next)
                      logEvent('auto-refresh-change', String(next))
                    }}
                  >
                    Auto refresh
                  </Switch>
                </div>
              </div>

              {degradedServices.length > 0 && (
                <Alert variant="warning" live="polite">
                  <AlertTitle>Attention required</AlertTitle>
                  <AlertDescription>
                    {degradedServices.length} service(s) need review before
                    promoting the next canary.
                  </AlertDescription>
                </Alert>
              )}

              <div className="showcase-playground-metrics">
                <MetricCard
                  title="Active sessions"
                  value="128.4k"
                  detail="+12.8% today"
                />
                <MetricCard
                  title="Replay queue"
                  value="42ms"
                  detail="p95 compression wait"
                />
                <MetricCard
                  title="Release health"
                  value={`${releaseProgress}%`}
                  detail={`${environment} rollout`}
                />
              </div>

              <div className="showcase-playground-card">
                <div className="showcase-playground-card-header">
                  <h3>Release progress</h3>
                  <div className="showcase-playground-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        setReleaseProgress(value => Math.max(0, value - 10))
                        logEvent('release-progress', '-10')
                      }}
                    >
                      Roll back
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={() => {
                        setReleaseProgress(value => Math.min(100, value + 10))
                        logEvent('release-progress', '+10')
                      }}
                    >
                      Promote
                    </Button>
                  </div>
                </div>

                <Progress
                  value={releaseProgress}
                  max={100}
                  label="Release progress"
                  style={progressStyle(releaseProgress)}
                >
                  <span className="showcase-progress-label">
                    {releaseProgress}%
                  </span>
                </Progress>
              </div>

              <div className="showcase-playground-grid-2">
                <div className="showcase-playground-card">
                  <h3>Service health</h3>

                  <div className="showcase-playground-service-list">
                    {playgroundDashboardServices.map(service => (
                      <ServiceRow key={service.name} service={service} />
                    ))}
                  </div>
                </div>

                <div className="showcase-playground-card">
                  <h3>Activity</h3>

                  <div className="showcase-playground-activity-list">
                    {playgroundActivityItems.map(item => (
                      <Alert key={item.id} variant={activityVariant(item.tone)}>
                        <AlertTitle>{item.title}</AlertTitle>
                        <AlertDescription>{item.description}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeScenario === 'settings-form' && (
            <section className="showcase-playground-panel">
              <div className="showcase-playground-panel-header">
                <div>
                  <span className="showcase-badge">Settings form</span>
                  <h2>Workspace configuration</h2>
                  <p>
                    Form composition with controlled fields, validation feedback
                    and feature toggles.
                  </p>
                </div>
              </div>

              <div className="showcase-playground-form-grid">
                <label className="showcase-playground-field">
                  <span>Organization name</span>
                  <Input
                    value={organizationName}
                    invalid={organizationInvalid}
                    placeholder="Organization name"
                    onValueChange={(event: unknown) => {
                      const next = readDetailValue(event, organizationName)
                      setOrganizationName(next)
                      logEvent('organization-name-change', next)
                    }}
                  />
                  {organizationInvalid && (
                    <small>Use at least 3 characters.</small>
                  )}
                </label>

                <label className="showcase-playground-field">
                  <span>Default environment</span>
                  <Select
                    value={environment}
                    aria-label="Default environment"
                    onValueChange={(event: unknown) => {
                      const next = readDetailValue(event, environment)
                      setEnvironment(next)
                      logEvent('default-environment-change', next)
                    }}
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </Select>
                </label>

                <div className="showcase-playground-card showcase-playground-form-card">
                  <h3>Feature flags</h3>
                  <Switch
                    checked={strictMode}
                    onCheckedChange={(event: unknown) => {
                      const next = readDetailChecked(event, strictMode)
                      setStrictMode(next)
                      logEvent('strict-mode-change', String(next))
                    }}
                  >
                    Strict release guard
                  </Switch>
                  <Checkbox
                    checked={analyticsEnabled}
                    onCheckedChange={(event: unknown) => {
                      const next = readDetailChecked(event, analyticsEnabled)
                      setAnalyticsEnabled(next)
                      logEvent('analytics-change', String(next))
                    }}
                  >
                    Enable product analytics
                  </Checkbox>
                </div>

                <Alert
                  variant={organizationInvalid ? 'warning' : 'success'}
                  live="polite"
                >
                  <AlertTitle>
                    {organizationInvalid
                      ? 'Validation warning'
                      : 'Settings ready'}
                  </AlertTitle>
                  <AlertDescription>
                    {organizationInvalid
                      ? 'Fix validation issues before saving the workspace.'
                      : `${organizationName} is configured for ${environment}.`}
                  </AlertDescription>
                </Alert>
              </div>
            </section>
          )}

          {activeScenario === 'project-creation' && (
            <section className="showcase-playground-panel">
              <div className="showcase-playground-panel-header">
                <div>
                  <span className="showcase-badge">Project creation</span>
                  <h2>Create and review projects</h2>
                  <p>
                    Dialog-based creation flow with validation, template
                    selection and an event trail.
                  </p>
                </div>

                <Dialog
                  open={projectDialogOpen}
                  onOpenChange={(event: unknown) => {
                    const next = readDetailOpen(event, projectDialogOpen)
                    setProjectDialogOpen(next)
                    logEvent('project-dialog-open-change', String(next))
                  }}
                >
                  <DialogTrigger>Create project</DialogTrigger>
                  <DialogContent>
                    <DialogTitle>Create project</DialogTitle>
                    <DialogDescription>
                      Configure a new Zeus Web project from a production-ready
                      template.
                    </DialogDescription>

                    <div className="showcase-playground-dialog-form">
                      <label className="showcase-playground-field">
                        <span>Project name</span>
                        <Input
                          value={projectName}
                          invalid={projectNameInvalid}
                          placeholder="project-name"
                          onValueChange={(event: unknown) => {
                            setProjectName(readDetailValue(event, projectName))
                          }}
                        />
                        {projectNameInvalid && (
                          <small>Use at least 3 characters.</small>
                        )}
                      </label>

                      <label className="showcase-playground-field">
                        <span>Template</span>
                        <Select
                          value={projectTemplate}
                          aria-label="Project template"
                          onValueChange={(event: unknown) => {
                            setProjectTemplate(
                              readDetailValue(event, projectTemplate),
                            )
                          }}
                        >
                          {playgroundProjectTemplates.map(template => (
                            <option key={template.value} value={template.value}>
                              {template.label}
                            </option>
                          ))}
                        </Select>
                      </label>

                      <Checkbox defaultChecked>
                        Include React, Vue and Web-C examples
                      </Checkbox>
                    </div>

                    <div className="showcase-playground-dialog-actions">
                      <DialogClose>Cancel</DialogClose>
                      <Button variant="primary" onPress={createProject}>
                        Create
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="showcase-playground-grid-2">
                <div className="showcase-playground-card">
                  <h3>Templates</h3>

                  <div className="showcase-playground-template-list">
                    {playgroundProjectTemplates.map(template => (
                      <button
                        key={template.value}
                        type="button"
                        className="showcase-playground-template-card"
                        data-active={template.value === projectTemplate}
                        onClick={() => {
                          setProjectTemplate(template.value)
                          logEvent('project-template-change', template.value)
                        }}
                      >
                        <strong>{template.label}</strong>
                        <span>{template.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="showcase-playground-card">
                  <h3>Created projects</h3>

                  <div className="showcase-playground-project-list">
                    {createdProjects.map(project => (
                      <div
                        key={project}
                        className="showcase-playground-project-row"
                      >
                        <span>{project}</span>
                        <Badge variant="outline">{environment}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </section>
    </div>
  )
}

function MetricCard(props: { title: string; value: string; detail: string }) {
  return (
    <article className="showcase-playground-metric-card">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
      <small>{props.detail}</small>
    </article>
  )
}

function ServiceRow(props: { service: ShowcasePlaygroundService }) {
  return (
    <div className="showcase-playground-service-row">
      <div>
        <strong>{props.service.name}</strong>
        <span>{props.service.owner}</span>
      </div>

      <div className="showcase-playground-service-meta">
        <Badge variant={statusVariant(props.service.status)}>
          {props.service.status}
        </Badge>
        <span>{props.service.uptime}%</span>
        <span>{props.service.latency}ms</span>
        <span>{props.service.errorRate}% errors</span>
      </div>
    </div>
  )
}
```

---

# 5. 替换 `examples/vue-showcase/src/routes/PlaygroundPage.vue`

```vue id="xj9j3s"
<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@zeus-web/alert/vue'
import { Badge } from '@zeus-web/badge/vue'
import { Button } from '@zeus-web/button/vue'
import { Checkbox } from '@zeus-web/checkbox/vue'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@zeus-web/dialog/vue'
import { Input } from '@zeus-web/input/vue'
import { Progress } from '@zeus-web/progress/vue'
import { Select } from '@zeus-web/select/vue'
import { Switch } from '@zeus-web/switch/vue'
import {
  playgroundActivityItems,
  playgroundDashboardServices,
  playgroundProjectTemplates,
  playgroundScenarios,
  type ShowcasePlaygroundActivity,
  type ShowcasePlaygroundScenarioId,
  type ShowcasePlaygroundServiceStatus,
} from '@zeus-web/example-showcase-shared'
import { computed, ref } from 'vue'

interface PlaygroundEvent {
  id: number
  name: string
  detail: string
}

const activeScenario = ref<ShowcasePlaygroundScenarioId>('admin-dashboard')
const environment = ref('production')
const autoRefresh = ref(true)
const strictMode = ref(true)
const analyticsEnabled = ref(true)
const releaseProgress = ref(68)
const organizationName = ref('Zeus Platform')
const projectName = ref('zeus-showcase')
const projectTemplate = ref('component-library')
const projectDialogOpen = ref(false)
const createdProjects = ref(['zeus-ui', 'zeus-docs'])
const events = ref<PlaygroundEvent[]>([])

const scenario = computed(() => {
  return playgroundScenarios.find(item => item.id === activeScenario.value)
})

const degradedServices = computed(() => {
  return playgroundDashboardServices.filter(
    service => service.status !== 'healthy',
  )
})

const organizationInvalid = computed(() => {
  return organizationName.value.trim().length < 3
})

const projectNameInvalid = computed(() => {
  return projectName.value.trim().length < 3
})

const progressStyle = computed(() => {
  return {
    '--showcase-progress-value': releaseProgress.value,
  }
})

function readDetailValue(event: unknown, fallback = ''): string {
  const detail = (event as { detail?: { value?: unknown } })?.detail
  return typeof detail?.value === 'string' ? detail.value : fallback
}

function readDetailChecked(event: unknown, fallback: boolean): boolean {
  const detail = (event as { detail?: { checked?: unknown } })?.detail
  return typeof detail?.checked === 'boolean' ? detail.checked : fallback
}

function readDetailOpen(event: unknown, fallback: boolean): boolean {
  const detail = (event as { detail?: { open?: unknown } })?.detail
  return typeof detail?.open === 'boolean' ? detail.open : fallback
}

function statusVariant(status: ShowcasePlaygroundServiceStatus) {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'degraded':
      return 'warning'
    case 'incident':
      return 'danger'
    default:
      return 'secondary'
  }
}

function activityVariant(tone: ShowcasePlaygroundActivity['tone']) {
  switch (tone) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'danger':
      return 'danger'
    case 'info':
    default:
      return 'info'
  }
}

function logEvent(name: string, detail: string) {
  events.value = [
    {
      id: Date.now(),
      name,
      detail,
    },
    ...events.value,
  ].slice(0, 6)
}

function setActiveScenario(id: ShowcasePlaygroundScenarioId) {
  activeScenario.value = id
}

function handleEnvironmentChange(event: unknown) {
  const next = readDetailValue(event, environment.value)
  environment.value = next
  logEvent('environment-change', next)
}

function handleDefaultEnvironmentChange(event: unknown) {
  const next = readDetailValue(event, environment.value)
  environment.value = next
  logEvent('default-environment-change', next)
}

function handleAutoRefreshChange(event: unknown) {
  const next = readDetailChecked(event, autoRefresh.value)
  autoRefresh.value = next
  logEvent('auto-refresh-change', String(next))
}

function handleStrictModeChange(event: unknown) {
  const next = readDetailChecked(event, strictMode.value)
  strictMode.value = next
  logEvent('strict-mode-change', String(next))
}

function handleAnalyticsChange(event: unknown) {
  const next = readDetailChecked(event, analyticsEnabled.value)
  analyticsEnabled.value = next
  logEvent('analytics-change', String(next))
}

function handleProjectDialogOpenChange(event: unknown) {
  const next = readDetailOpen(event, projectDialogOpen.value)
  projectDialogOpen.value = next
  logEvent('project-dialog-open-change', String(next))
}

function promoteRelease(delta: number) {
  releaseProgress.value = Math.max(
    0,
    Math.min(100, releaseProgress.value + delta),
  )
  logEvent('release-progress', String(delta))
}

function createProject() {
  if (projectNameInvalid.value) {
    logEvent('project-create-blocked', 'Project name is too short.')
    return
  }

  const nextProject = projectName.value.trim()

  if (!createdProjects.value.includes(nextProject)) {
    createdProjects.value = [nextProject, ...createdProjects.value]
  }

  projectDialogOpen.value = false
  logEvent(
    'project-created',
    `${nextProject} · ${projectTemplate.value} · ${environment.value}`,
  )
}
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Playground</p>
      <h1 class="showcase-title">Production composition playground</h1>
      <p class="showcase-description">
        Validate how Zeus Web components compose in production-like screens:
        dashboard operations, settings forms and project creation flows.
      </p>

      <div class="showcase-page-meta">
        <span class="showcase-badge"
          >{{ playgroundScenarios.length }} scenarios</span
        >
        <span class="showcase-badge">React + Vue parity</span>
        <span class="showcase-badge">stateful composition</span>
      </div>
    </header>

    <section class="showcase-playground-layout">
      <aside class="showcase-playground-sidebar">
        <h2>Scenarios</h2>

        <div class="showcase-playground-nav">
          <button
            v-for="item in playgroundScenarios"
            :key="item.id"
            type="button"
            class="showcase-playground-nav-item"
            :data-active="item.id === activeScenario"
            :aria-pressed="item.id === activeScenario"
            @click="setActiveScenario(item.id)"
          >
            <span>{{ item.title }}</span>
            <small>{{ item.description }}</small>
          </button>
        </div>

        <div class="showcase-playground-stack">
          <h3>Components used</h3>
          <div class="showcase-playground-badges">
            <span
              v-for="component in scenario?.components"
              :key="component"
              class="showcase-badge"
            >
              {{ component }}
            </span>
          </div>
        </div>

        <div class="showcase-playground-event-log">
          <h3>Event log</h3>
          <ol v-if="events.length > 0">
            <li v-for="event in events" :key="event.id">
              <strong>{{ event.name }}</strong>
              <span>{{ event.detail }}</span>
            </li>
          </ol>
          <p v-else>
            No events yet. Interact with controls to record state changes.
          </p>
        </div>
      </aside>

      <main class="showcase-playground-main">
        <section
          v-if="activeScenario === 'admin-dashboard'"
          class="showcase-playground-panel"
        >
          <div class="showcase-playground-panel-header">
            <div>
              <span class="showcase-badge">Admin dashboard</span>
              <h2>Operational overview</h2>
              <p>
                Realistic monitoring shell with environment filter, rollout
                progress, service health and live activity.
              </p>
            </div>

            <div class="showcase-playground-actions">
              <Select
                :value="environment"
                aria-label="Dashboard environment"
                @value-change="handleEnvironmentChange"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </Select>

              <Switch
                :checked="autoRefresh"
                @checked-change="handleAutoRefreshChange"
              >
                Auto refresh
              </Switch>
            </div>
          </div>

          <Alert
            v-if="degradedServices.length > 0"
            variant="warning"
            live="polite"
          >
            <AlertTitle>Attention required</AlertTitle>
            <AlertDescription>
              {{ degradedServices.length }} service(s) need review before
              promoting the next canary.
            </AlertDescription>
          </Alert>

          <div class="showcase-playground-metrics">
            <article class="showcase-playground-metric-card">
              <span>Active sessions</span>
              <strong>128.4k</strong>
              <small>+12.8% today</small>
            </article>
            <article class="showcase-playground-metric-card">
              <span>Replay queue</span>
              <strong>42ms</strong>
              <small>p95 compression wait</small>
            </article>
            <article class="showcase-playground-metric-card">
              <span>Release health</span>
              <strong>{{ releaseProgress }}%</strong>
              <small>{{ environment }} rollout</small>
            </article>
          </div>

          <div class="showcase-playground-card">
            <div class="showcase-playground-card-header">
              <h3>Release progress</h3>
              <div class="showcase-playground-actions">
                <Button
                  size="sm"
                  variant="outline"
                  @press="promoteRelease(-10)"
                >
                  Roll back
                </Button>
                <Button size="sm" variant="primary" @press="promoteRelease(10)">
                  Promote
                </Button>
              </div>
            </div>

            <Progress
              :value="releaseProgress"
              :max="100"
              label="Release progress"
              :style="progressStyle"
            >
              <span class="showcase-progress-label"
                >{{ releaseProgress }}%</span
              >
            </Progress>
          </div>

          <div class="showcase-playground-grid-2">
            <div class="showcase-playground-card">
              <h3>Service health</h3>

              <div class="showcase-playground-service-list">
                <div
                  v-for="service in playgroundDashboardServices"
                  :key="service.name"
                  class="showcase-playground-service-row"
                >
                  <div>
                    <strong>{{ service.name }}</strong>
                    <span>{{ service.owner }}</span>
                  </div>

                  <div class="showcase-playground-service-meta">
                    <Badge :variant="statusVariant(service.status)">
                      {{ service.status }}
                    </Badge>
                    <span>{{ service.uptime }}%</span>
                    <span>{{ service.latency }}ms</span>
                    <span>{{ service.errorRate }}% errors</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="showcase-playground-card">
              <h3>Activity</h3>

              <div class="showcase-playground-activity-list">
                <Alert
                  v-for="item in playgroundActivityItems"
                  :key="item.id"
                  :variant="activityVariant(item.tone)"
                >
                  <AlertTitle>{{ item.title }}</AlertTitle>
                  <AlertDescription>{{ item.description }}</AlertDescription>
                </Alert>
              </div>
            </div>
          </div>
        </section>

        <section
          v-if="activeScenario === 'settings-form'"
          class="showcase-playground-panel"
        >
          <div class="showcase-playground-panel-header">
            <div>
              <span class="showcase-badge">Settings form</span>
              <h2>Workspace configuration</h2>
              <p>
                Form composition with controlled fields, validation feedback and
                feature toggles.
              </p>
            </div>
          </div>

          <div class="showcase-playground-form-grid">
            <label class="showcase-playground-field">
              <span>Organization name</span>
              <Input
                :value="organizationName"
                :invalid="organizationInvalid"
                placeholder="Organization name"
                @value-change="
                  event => {
                    organizationName = readDetailValue(event, organizationName)
                    logEvent('organization-name-change', organizationName)
                  }
                "
              />
              <small v-if="organizationInvalid"
                >Use at least 3 characters.</small
              >
            </label>

            <label class="showcase-playground-field">
              <span>Default environment</span>
              <Select
                :value="environment"
                aria-label="Default environment"
                @value-change="handleDefaultEnvironmentChange"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </Select>
            </label>

            <div class="showcase-playground-card showcase-playground-form-card">
              <h3>Feature flags</h3>
              <Switch
                :checked="strictMode"
                @checked-change="handleStrictModeChange"
              >
                Strict release guard
              </Switch>
              <Checkbox
                :checked="analyticsEnabled"
                @checked-change="handleAnalyticsChange"
              >
                Enable product analytics
              </Checkbox>
            </div>

            <Alert
              :variant="organizationInvalid ? 'warning' : 'success'"
              live="polite"
            >
              <AlertTitle>
                {{
                  organizationInvalid ? 'Validation warning' : 'Settings ready'
                }}
              </AlertTitle>
              <AlertDescription>
                {{
                  organizationInvalid
                    ? 'Fix validation issues before saving the workspace.'
                    : `${organizationName} is configured for ${environment}.`
                }}
              </AlertDescription>
            </Alert>
          </div>
        </section>

        <section
          v-if="activeScenario === 'project-creation'"
          class="showcase-playground-panel"
        >
          <div class="showcase-playground-panel-header">
            <div>
              <span class="showcase-badge">Project creation</span>
              <h2>Create and review projects</h2>
              <p>
                Dialog-based creation flow with validation, template selection
                and an event trail.
              </p>
            </div>

            <Dialog
              :open="projectDialogOpen"
              @open-change="handleProjectDialogOpenChange"
            >
              <DialogTrigger>Create project</DialogTrigger>
              <DialogContent>
                <DialogTitle>Create project</DialogTitle>
                <DialogDescription>
                  Configure a new Zeus Web project from a production-ready
                  template.
                </DialogDescription>

                <div class="showcase-playground-dialog-form">
                  <label class="showcase-playground-field">
                    <span>Project name</span>
                    <Input
                      :value="projectName"
                      :invalid="projectNameInvalid"
                      placeholder="project-name"
                      @value-change="
                        event => {
                          projectName = readDetailValue(event, projectName)
                        }
                      "
                    />
                    <small v-if="projectNameInvalid">
                      Use at least 3 characters.
                    </small>
                  </label>

                  <label class="showcase-playground-field">
                    <span>Template</span>
                    <Select
                      :value="projectTemplate"
                      aria-label="Project template"
                      @value-change="
                        event => {
                          projectTemplate = readDetailValue(
                            event,
                            projectTemplate,
                          )
                        }
                      "
                    >
                      <option
                        v-for="template in playgroundProjectTemplates"
                        :key="template.value"
                        :value="template.value"
                      >
                        {{ template.label }}
                      </option>
                    </Select>
                  </label>

                  <Checkbox default-checked>
                    Include React, Vue and Web-C examples
                  </Checkbox>
                </div>

                <div class="showcase-playground-dialog-actions">
                  <DialogClose>Cancel</DialogClose>
                  <Button variant="primary" @press="createProject">
                    Create
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div class="showcase-playground-grid-2">
            <div class="showcase-playground-card">
              <h3>Templates</h3>

              <div class="showcase-playground-template-list">
                <button
                  v-for="template in playgroundProjectTemplates"
                  :key="template.value"
                  type="button"
                  class="showcase-playground-template-card"
                  :data-active="template.value === projectTemplate"
                  @click="
                    () => {
                      projectTemplate = template.value
                      logEvent('project-template-change', template.value)
                    }
                  "
                >
                  <strong>{{ template.label }}</strong>
                  <span>{{ template.description }}</span>
                </button>
              </div>
            </div>

            <div class="showcase-playground-card">
              <h3>Created projects</h3>

              <div class="showcase-playground-project-list">
                <div
                  v-for="project in createdProjects"
                  :key="project"
                  class="showcase-playground-project-row"
                >
                  <span>{{ project }}</span>
                  <Badge variant="outline">{{ environment }}</Badge>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </section>
  </div>
</template>
```

---

# 6. 追加 CSS：React/Vue 两个 `app.css` 都加

追加到：

```txt id="y85wx0"
examples/react-showcase/src/app.css
examples/vue-showcase/src/app.css
```

```css id="ysuiw1"
.showcase-playground-layout {
  display: grid;
  grid-template-columns: 20rem minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.showcase-playground-sidebar,
.showcase-playground-panel,
.showcase-playground-card,
.showcase-playground-metric-card {
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
}

.showcase-playground-sidebar {
  position: sticky;
  top: 5rem;
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.showcase-playground-sidebar h2,
.showcase-playground-sidebar h3,
.showcase-playground-panel h2,
.showcase-playground-card h3 {
  margin: 0;
}

.showcase-playground-nav {
  display: grid;
  gap: 0.5rem;
}

.showcase-playground-nav-item {
  display: grid;
  gap: 0.35rem;
  width: 100%;
  border: 1px solid hsl(var(--border));
  border-radius: 0.8rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  cursor: pointer;
  padding: 0.75rem;
  text-align: left;
}

.showcase-playground-nav-item:hover,
.showcase-playground-nav-item[data-active='true'] {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.16);
}

.showcase-playground-nav-item span {
  font-weight: 800;
}

.showcase-playground-nav-item small {
  color: hsl(var(--muted-foreground));
  line-height: 1.45;
}

.showcase-playground-stack {
  display: grid;
  gap: 0.75rem;
}

.showcase-playground-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.showcase-playground-event-log {
  display: grid;
  gap: 0.75rem;
}

.showcase-playground-event-log ol {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.showcase-playground-event-log li {
  display: grid;
  gap: 0.2rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  background: hsl(var(--background));
  padding: 0.65rem;
}

.showcase-playground-event-log li span,
.showcase-playground-event-log p {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.85rem;
  line-height: 1.45;
}

.showcase-playground-main {
  min-width: 0;
}

.showcase-playground-panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.showcase-playground-panel-header,
.showcase-playground-card-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.showcase-playground-panel-header h2 {
  margin: 0.65rem 0 0;
  font-size: 1.4rem;
}

.showcase-playground-panel-header p {
  max-width: 42rem;
  margin: 0.35rem 0 0;
  color: hsl(var(--muted-foreground));
  line-height: 1.55;
}

.showcase-playground-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
}

.showcase-playground-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.showcase-playground-metric-card {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
}

.showcase-playground-metric-card span {
  color: hsl(var(--muted-foreground));
  font-size: 0.82rem;
  font-weight: 700;
}

.showcase-playground-metric-card strong {
  font-size: 1.6rem;
}

.showcase-playground-metric-card small {
  color: hsl(var(--muted-foreground));
}

.showcase-playground-card {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
}

.showcase-playground-grid-2,
.showcase-playground-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.showcase-playground-service-list,
.showcase-playground-activity-list,
.showcase-playground-template-list,
.showcase-playground-project-list,
.showcase-playground-dialog-form {
  display: grid;
  gap: 0.75rem;
}

.showcase-playground-service-row,
.showcase-playground-project-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  border: 1px solid hsl(var(--border));
  border-radius: 0.8rem;
  background: hsl(var(--background));
  padding: 0.75rem;
}

.showcase-playground-service-row > div:first-child {
  display: grid;
  gap: 0.2rem;
}

.showcase-playground-service-row span {
  color: hsl(var(--muted-foreground));
  font-size: 0.82rem;
}

.showcase-playground-service-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.showcase-playground-field {
  display: grid;
  gap: 0.45rem;
}

.showcase-playground-field > span {
  color: hsl(var(--muted-foreground));
  font-size: 0.82rem;
  font-weight: 800;
}

.showcase-playground-field small {
  color: hsl(var(--destructive));
  font-size: 0.78rem;
}

.showcase-playground-form-card {
  align-content: start;
}

.showcase-playground-template-card {
  display: grid;
  gap: 0.35rem;
  width: 100%;
  border: 1px solid hsl(var(--border));
  border-radius: 0.8rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  cursor: pointer;
  padding: 0.8rem;
  text-align: left;
}

.showcase-playground-template-card:hover,
.showcase-playground-template-card[data-active='true'] {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.16);
}

.showcase-playground-template-card span {
  color: hsl(var(--muted-foreground));
  line-height: 1.45;
}

.showcase-playground-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1rem;
}

@media (max-width: 1100px) {
  .showcase-playground-layout {
    grid-template-columns: 1fr;
  }

  .showcase-playground-sidebar {
    position: static;
  }

  .showcase-playground-metrics,
  .showcase-playground-grid-2,
  .showcase-playground-form-grid {
    grid-template-columns: 1fr;
  }
}
```

---

# 7. 新增 `examples/react-showcase/src/routes/PlaygroundPage.test.tsx`

测试尽量不依赖自定义组件真实事件，只覆盖页面结构和场景切换。

```tsx id="kafkgq"
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PlaygroundPage } from './PlaygroundPage'

describe('react PlaygroundPage', () => {
  it('renders playground scenarios', () => {
    render(<PlaygroundPage />)

    expect(
      screen.getByRole('heading', {
        name: 'Production composition playground',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Admin dashboard/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Settings form/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Project creation/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('@zeus-web/alert')).toBeInTheDocument()
  })

  it('switches to settings form scenario', async () => {
    const user = userEvent.setup()

    render(<PlaygroundPage />)

    await user.click(screen.getByRole('button', { name: /Settings form/ }))

    expect(
      screen.getByRole('heading', { name: 'Workspace configuration' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Organization name')).toBeInTheDocument()
    expect(screen.getByText('Feature flags')).toBeInTheDocument()
  })

  it('switches to project creation scenario', async () => {
    const user = userEvent.setup()

    render(<PlaygroundPage />)

    await user.click(screen.getByRole('button', { name: /Project creation/ }))

    expect(
      screen.getByRole('heading', { name: 'Create and review projects' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByText('Created projects')).toBeInTheDocument()
    expect(screen.getByText('Component library')).toBeInTheDocument()
  })
})
```

---

# 8. 新增 `examples/vue-showcase/src/routes/PlaygroundPage.spec.ts`

```ts id="y6qhhx"
import { mount } from '@vue/test-utils'

import PlaygroundPage from './PlaygroundPage.vue'

describe('vue PlaygroundPage', () => {
  it('renders playground scenarios', () => {
    const wrapper = mount(PlaygroundPage)

    expect(wrapper.text()).toContain('Production composition playground')
    expect(wrapper.text()).toContain('Admin dashboard')
    expect(wrapper.text()).toContain('Settings form')
    expect(wrapper.text()).toContain('Project creation')
    expect(wrapper.text()).toContain('@zeus-web/alert')
  })

  it('switches to settings form scenario', async () => {
    const wrapper = mount(PlaygroundPage)

    const button = wrapper
      .findAll('button')
      .find(item => item.text().includes('Settings form'))

    expect(button).toBeDefined()

    await button?.trigger('click')

    expect(wrapper.text()).toContain('Workspace configuration')
    expect(wrapper.text()).toContain('Organization name')
    expect(wrapper.text()).toContain('Feature flags')
  })

  it('switches to project creation scenario', async () => {
    const wrapper = mount(PlaygroundPage)

    const button = wrapper
      .findAll('button')
      .find(item => item.text().includes('Project creation'))

    expect(button).toBeDefined()

    await button?.trigger('click')

    expect(wrapper.text()).toContain('Create and review projects')
    expect(wrapper.text()).toContain('Templates')
    expect(wrapper.text()).toContain('Created projects')
    expect(wrapper.text()).toContain('Component library')
  })
})
```

---

# 9. 修改 `docs/internal/examples/showcase-roadmap.md`

把 Phase 11 标记为 Done：

```md id="3l62tg"
| Phase 11 | Done | Playground page with admin dashboard, settings form and project creation flow |
```

并追加：

```md id="5tpxdv"
### Playground

- admin dashboard scenario
- settings form scenario
- project creation scenario
- component composition badges
- event log
- React / Vue parity tests
```

---

# 验收命令

```bash id="ut1mki"
pnpm --filter @zeus-web/example-showcase-shared check
pnpm showcase:test
pnpm showcase:build
pnpm site:check
```

# Phase 11 完成判断

```txt id="o7yrei"
React /playground:
  - 不是 planned placeholder
  - Admin dashboard 有真实指标、服务健康、活动、发布进度
  - Settings form 有可控字段、校验反馈、开关/复选框
  - Project creation 有 dialog flow、模板选择、项目列表
  - 单测覆盖三类场景切换

Vue /playground:
  - 与 React 能力一致
  - 单测覆盖三类场景切换

Shared:
  - playground 数据从 showcase-shared 统一输出
  - React/Vue 不重复维护 scenario metadata

Roadmap:
  - Phase 11 标记 Done
```

建议分支名：

```txt id="ez9rzx"
feat/showcase-playground-page
```

建议 PR title：

```txt id="c8m188"
feat(examples): complete showcase playground page
```
