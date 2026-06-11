import type {
  ShowcasePlaygroundActivity,
  ShowcasePlaygroundScenarioId,
  ShowcasePlaygroundService,
  ShowcasePlaygroundServiceStatus,
} from '@zeus-web/example-showcase-shared'
import type { CSSProperties } from 'react'

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
import {
  playgroundActivityItems,
  playgroundDashboardServices,
  playgroundProjectTemplates,
  playgroundScenarios,
} from '@zeus-web/example-showcase-shared'
import { Input } from '@zeus-web/input/react'
import { Progress } from '@zeus-web/progress/react'
import { Select } from '@zeus-web/select/react'
import { Switch } from '@zeus-web/switch/react'

import { useMemo, useState } from 'react'

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
        <span>
          {props.service.latency}
          ms
        </span>
        <span>{props.service.errorRate}% errors</span>
      </div>
    </div>
  )
}
