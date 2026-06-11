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
    status: 'healthy' as const,
    uptime: 99.98,
    latency: 42,
    errorRate: 0.03,
  },
  {
    name: 'Replay Worker',
    owner: 'Observability',
    status: 'degraded' as const,
    uptime: 99.12,
    latency: 118,
    errorRate: 0.41,
  },
  {
    name: 'Release API',
    owner: 'Developer Experience',
    status: 'incident' as const,
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
