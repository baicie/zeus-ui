<script setup lang="ts">
import type {
  ShowcasePlaygroundActivity,
  ShowcasePlaygroundScenarioId,
  ShowcasePlaygroundServiceStatus,
} from '@zeus-web/example-showcase-shared'
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
import {
  getPlaygroundScenario,
  playgroundActivityItems,
  playgroundDashboardServices,
  playgroundProjectTemplates,
  playgroundScenarios,
} from '@zeus-web/example-showcase-shared'
import { Input } from '@zeus-web/input/vue'
import { Progress } from '@zeus-web/progress/vue'
import { Select } from '@zeus-web/select/vue'
import { Switch } from '@zeus-web/switch/vue'
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
const eventId = ref(0)

const scenario = computed(() => {
  return getPlaygroundScenario(activeScenario.value)
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
  eventId.value += 1

  events.value = [
    {
      id: eventId.value,
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
              v-for="component in scenario.components"
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
                  aria-label="Roll back release"
                  @press="promoteRelease(-10)"
                >
                  Roll back
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  aria-label="Promote release"
                  @press="promoteRelease(10)"
                >
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
