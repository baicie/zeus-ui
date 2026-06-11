import {
  getPlaygroundScenario,
  playgroundDashboardServices,
  playgroundProjectTemplates,
  playgroundScenarios,
} from '../playground'

describe('showcase playground metadata', () => {
  it('defines the required Phase 11 scenarios', () => {
    expect(playgroundScenarios.map(scenario => scenario.id)).toEqual([
      'admin-dashboard',
      'settings-form',
      'project-creation',
    ])
  })

  it('keeps every scenario connected to component packages', () => {
    for (const scenario of playgroundScenarios) {
      expect(scenario.components.length).toBeGreaterThan(0)
      expect(
        scenario.components.every(component =>
          component.startsWith('@zeus-web/'),
        ),
      ).toBe(true)
    }
  })

  it('returns fallback scenario for unknown ids', () => {
    expect(getPlaygroundScenario('admin-dashboard').id).toBe('admin-dashboard')

    expect(
      getPlaygroundScenario(
        'unknown' as Parameters<typeof getPlaygroundScenario>[0],
      ).id,
    ).toBe('admin-dashboard')
  })

  it('defines production-like service and template fixtures', () => {
    expect(playgroundDashboardServices.length).toBeGreaterThanOrEqual(3)
    expect(playgroundProjectTemplates.map(template => template.value)).toEqual([
      'component-library',
      'dashboard',
      'docs',
    ])
  })
})
