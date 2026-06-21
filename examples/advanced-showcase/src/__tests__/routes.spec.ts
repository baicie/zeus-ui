import { describe, expect, it } from 'vitest'

import { advancedShowcaseRoutes } from '../routes'

describe('advanced showcase routes', () => {
  it('defines one page for every advanced showcase component', () => {
    expect(advancedShowcaseRoutes.map(route => route.path)).toEqual([
      '/',
      '/data-grid',
      '/revogrid-adapter',
      '/chat',
      '/virtual-list',
      '/agent-console',
    ])
  })

  it('keeps route labels stable', () => {
    expect(advancedShowcaseRoutes.map(route => route.label)).toEqual([
      'Overview',
      'Data Grid',
      'RevoGrid Adapter',
      'Chat',
      'Virtual List',
      'Agent Console',
    ])
  })

  it('has renderable components for every route', () => {
    for (const route of advancedShowcaseRoutes) {
      expect(typeof route.Component).toBe('function')
    }
  })
})
