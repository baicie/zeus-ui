import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { showcaseTargets, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'
import {
  showcaseComponentRoutes,
  showcaseFoundationRoutes,
} from './utils/routes'

describe.each(showcaseTargets)('$name showcase routes', target => {
  describe('foundation routes', () => {
    for (const route of showcaseFoundationRoutes) {
      it(`renders ${route.path}`, () => {
        return withShowcasePage(target, page => {
          const errors = collectPageErrors(page)

          return page
            .goto(route.path)
            .then(() =>
              expectPage(page.getByText(route.title).first()).toBeVisible(),
            )
            .then(() =>
              expectPage(page.locator('body')).not.toContainText(
                'is not part of the current showcase metadata',
              ),
            )
            .then(() => errors.assertClean())
        })
      })
    }
  })

  describe('component routes', () => {
    for (const componentName of showcaseComponentRoutes) {
      it(`renders ${componentName}`, () => {
        return withShowcasePage(target, page => {
          const errors = collectPageErrors(page)

          return page
            .goto(`/components/${componentName}`)
            .then(() =>
              expectPage(page.locator('body')).toContainText(componentName),
            )
            .then(() =>
              expectPage(page.locator('body')).not.toContainText('Not found'),
            )
            .then(() =>
              expectPage(page.locator('body')).not.toContainText(
                'is not part of the current showcase metadata',
              ),
            )
            .then(() => errors.assertClean())
        })
      })
    }
  })

  it('renders not found route', () => {
    return withShowcasePage(target, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/unknown-route')
        .then(() =>
          expectPage(page.locator('body')).toContainText(/not found/i),
        )
        .then(() => errors.assertClean())
    })
  })
})
