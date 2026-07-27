import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import { docsShowcaseTarget, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

const GRID_TEST_ID = 'data-grid-playground-grid'
const WINDOW_TEST_ID = 'data-grid-playground-window'

describe('docs data grid playground', () => {
  it('keeps 100 and 1,000 column datasets within the DOM budget', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)
      const grid = page.getByTestId(GRID_TEST_ID)
      const applyButton = page.getByRole('button', { name: 'Apply data' })
      const controls = page.locator('.data-grid-playground__controls')
      const lastButton = page.getByRole('button', {
        name: 'Jump to last row and column',
      })
      const windowStatus = page.getByTestId(WINDOW_TEST_ID)

      return page
        .goto('playground/data-grid/')
        .then(() =>
          expectPage(
            page.getByRole('heading', {
              name: /High-performance data grid/i,
            }),
          ).toBeVisible(),
        )
        .then(() =>
          page.locator('img.VPImage.logo').evaluate(element => {
            return (
              Boolean(Reflect.get(element, 'complete')) &&
              Number(Reflect.get(element, 'naturalWidth')) > 0
            )
          }),
        )
        .then(logoLoaded => expect(logoLoaded).toBe(true))
        .then(() => expectPage(grid).toBeVisible())
        .then(() => expectPage(grid).toHaveAttribute('data-row-count', '10000'))
        .then(() => expectPage(grid).toHaveAttribute('data-column-count', '20'))
        .then(() =>
          expectPage(
            grid.locator('[data-slot="data-grid-cell"]').first(),
          ).toBeVisible(),
        )
        .then(() => grid.locator('[data-slot="data-grid-cell"]').count())
        .then(cellCount => {
          expect(cellCount).toBeGreaterThan(0)
          expect(cellCount).toBeLessThanOrEqual(300)
        })
        .then(() =>
          controls.evaluate(element => {
            return element.scrollWidth <= element.clientWidth
          }),
        )
        .then(controlsFit => expect(controlsFit).toBe(true))
        .then(() =>
          page
            .getByRole('button', {
              name: 'Select 100k x 100',
              exact: true,
            })
            .click(),
        )
        .then(() => expectPage(applyButton).toBeEnabled())
        .then(() => applyButton.click())
        .then(() =>
          expectPage(grid).toHaveAttribute('data-row-count', '100000'),
        )
        .then(() =>
          expectPage(grid).toHaveAttribute('data-column-count', '100'),
        )
        .then(() =>
          page.getByRole('button', { name: '48', exact: true }).click(),
        )
        .then(() =>
          expectPage
            .poll(() =>
              grid
                .locator('[data-slot="data-grid-spacer"]')
                .evaluate(element => {
                  const style = Reflect.get(element, 'style')
                  return Number.parseFloat(String(Reflect.get(style, 'height')))
                }),
            )
            .toBe(4_800_000),
        )
        .then(() =>
          page
            .getByRole('button', { name: 'Reset widths', exact: true })
            .click(),
        )
        .then(() => expectPage(lastButton).toBeEnabled())
        .then(() => lastButton.click())
        .then(() =>
          expectPage(windowStatus).toContainText(
            /Rows \d[\d,]*-100,000 of 100,000/,
          ),
        )
        .then(() =>
          expectPage(windowStatus).toContainText(/Columns \d+-100 of 100/),
        )
        .then(() =>
          expectPage(
            grid.locator('[data-slot="data-grid-row"][data-row-index="99999"]'),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(
            grid.locator(
              '[data-slot="data-grid-cell"][data-row-key="row-100000"][aria-colindex="100"]',
            ),
          ).toBeVisible(),
        )
        .then(() =>
          page.getByRole('button', { name: 'Select 100k x 1000' }).click(),
        )
        .then(() => expectPage(applyButton).toBeEnabled())
        .then(() => applyButton.click())
        .then(() =>
          expectPage(grid).toHaveAttribute('data-column-count', '1000'),
        )
        .then(() =>
          expectPage(
            grid.locator('[data-slot="data-grid-cell"]').first(),
          ).toBeVisible(),
        )
        .then(() => grid.locator('[data-slot="data-grid-cell"]').count())
        .then(cellCount => {
          expect(cellCount).toBeGreaterThan(0)
          expect(cellCount).toBeLessThanOrEqual(300)
        })
        .then(() => expectPage(lastButton).toBeEnabled())
        .then(() => lastButton.click())
        .then(() =>
          expectPage(windowStatus).toContainText(
            /Rows \d[\d,]*-100,000 of 100,000/,
          ),
        )
        .then(() =>
          expectPage(windowStatus).toContainText(
            /Columns \d[\d,]*-1,000 of 1,000/,
          ),
        )
        .then(() =>
          expectPage(
            grid.locator('[data-slot="data-grid-row"][data-row-index="99999"]'),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(
            grid.locator(
              '[data-slot="data-grid-cell"][data-row-key="row-100000"][aria-colindex="1000"]',
            ),
          ).toBeVisible(),
        )
        .then(() => grid.locator('[data-slot="data-grid-cell"]').count())
        .then(cellCount => {
          expect(cellCount).toBeGreaterThan(0)
          expect(cellCount).toBeLessThanOrEqual(300)
        })
        .then(() => errors.assertClean())
    })
  })
})
