import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { expectNoAccessibilityViolations } from './utils/accessibility'
import {
  docsShowcaseTarget,
  waitForZeusElements,
  withShowcasePage,
} from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

const accessibilityRoutes = [
  {
    route: 'components/input',
    scope: '.component-playground',
  },
  {
    route: 'components/dialog',
    scope: '.component-playground',
  },
  {
    route: 'components/tabs',
    scope: '.component-playground',
  },
  {
    route: 'components/select',
    scope: '.component-playground',
  },
  {
    route: 'components/data-grid',
    scope: '.data-grid-playground',
    ready: '[data-slot="data-grid-cell"]',
  },
] as const

describe.each(accessibilityRoutes)('accessibility gate: $route', fixture => {
  it('has no axe violations in the component playground', () => {
    return withShowcasePage(docsShowcaseTarget, async page => {
      const errors = collectPageErrors(page)

      await page.goto(fixture.route)
      const scope = page.locator(fixture.scope)
      await scope.waitFor({ state: 'visible' })
      if (!('ready' in fixture)) {
        await expectPage(scope).toHaveAttribute('data-ready', 'true')
      }
      if ('ready' in fixture) {
        await page.locator(fixture.ready).first().waitFor({ state: 'visible' })
      }
      await waitForZeusElements(scope)
      await expectNoAccessibilityViolations(page, { include: fixture.scope })
      errors.assertClean()
    })
  })
})
