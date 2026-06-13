import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'

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

  it('loads primitive presentation styles', () => {
    return withShowcasePage(target, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/components/button')
        .then(() =>
          page
            .locator("zw-button[data-variant='primary'] [data-slot='button']")
            .first()
            .evaluate(element => {
              const style = getComputedStyle(element)

              return {
                backgroundColor: style.backgroundColor,
                borderRadius: style.borderRadius,
                display: style.display,
                minHeight: style.minHeight,
              }
            }),
        )
        .then(style => {
          expect(style.display).toBe('flex')
          expect(style.borderRadius).not.toBe('0px')
          expect(style.minHeight).not.toBe('0px')
          expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
        })
        .then(() => errors.assertClean())
    })
  })
})
