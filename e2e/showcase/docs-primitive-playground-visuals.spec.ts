import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import { docsShowcaseTarget, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

interface ElementVisualMetrics {
  backgroundColor: string
  height: number
  width: number
}

function readVisualMetrics(element: HTMLElement): ElementVisualMetrics {
  const rect = element.getBoundingClientRect()

  return {
    backgroundColor: getComputedStyle(element).backgroundColor,
    height: rect.height,
    width: rect.width,
  }
}

function expectVisibleSurface(metrics: ElementVisualMetrics): void {
  expect(metrics.width).toBeGreaterThan(0)
  expect(metrics.height).toBeGreaterThan(0)
  expect(metrics.backgroundColor).not.toBe('transparent')
  expect(metrics.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
}

describe('docs primitive playground visuals', () => {
  it('renders horizontal and vertical separators as visible surfaces', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)
      const playground = page.locator(
        '.component-playground[data-playground="separator"]',
      )
      const horizontal = playground.locator(
        'zw-separator[orientation="horizontal"]',
      )
      const verticals = playground.locator(
        'zw-separator[orientation="vertical"]',
      )

      return page
        .goto('playground/separator/')
        .then(() =>
          expectPage(playground).toHaveAttribute('data-ready', 'true'),
        )
        .then(() => expectPage(horizontal).toHaveCount(1))
        .then(() => expectPage(verticals).toHaveCount(2))
        .then(() => horizontal.evaluate(readVisualMetrics))
        .then(metrics => expectVisibleSurface(metrics))
        .then(() =>
          verticals.evaluateAll(elements => {
            return elements.map(element => {
              const rect = element.getBoundingClientRect()

              return {
                backgroundColor: getComputedStyle(element).backgroundColor,
                height: rect.height,
                width: rect.width,
              }
            })
          }),
        )
        .then(metrics => {
          metrics.forEach(item => expectVisibleSurface(item))
        })
        .then(() => errors.assertClean())
    })
  })

  it('renders skeleton placeholders as visible surfaces', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)
      const playground = page.locator(
        '.component-playground[data-playground="skeleton"]',
      )
      const skeletons = playground.locator('zw-skeleton')

      return page
        .goto('playground/skeleton/')
        .then(() =>
          expectPage(playground).toHaveAttribute('data-ready', 'true'),
        )
        .then(() => expectPage(skeletons).toHaveCount(4))
        .then(() => skeletons.first().evaluate(readVisualMetrics))
        .then(metrics => expectVisibleSurface(metrics))
        .then(() => errors.assertClean())
    })
  })

  it('renders progress tracks and indicators as visible surfaces', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)
      const playground = page.locator(
        '.component-playground[data-playground="progress"]',
      )
      const progress = playground.locator('zw-progress[data-percent="64"]')
      const indicator = progress.locator('[data-slot="progress-indicator"]')
      const indeterminate = playground.locator(
        'zw-progress[data-state="indeterminate"]',
      )
      const indeterminateIndicator = indeterminate.locator(
        '[data-slot="progress-indicator"]',
      )

      return page
        .goto('playground/progress/')
        .then(() =>
          expectPage(playground).toHaveAttribute('data-ready', 'true'),
        )
        .then(() => expectPage(progress).toHaveAttribute('data-percent', '64'))
        .then(() => progress.evaluate(readVisualMetrics))
        .then(metrics => expectVisibleSurface(metrics))
        .then(() => indicator.evaluate(readVisualMetrics))
        .then(metrics => expectVisibleSurface(metrics))
        .then(() => expectPage(indeterminate).toHaveCount(1))
        .then(() => indeterminate.evaluate(readVisualMetrics))
        .then(metrics => expectVisibleSurface(metrics))
        .then(() => indeterminateIndicator.evaluate(readVisualMetrics))
        .then(metrics => expectVisibleSurface(metrics))
        .then(() => errors.assertClean())
    })
  })

  it('visually distinguishes alert variants and text hierarchy', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)
      const playground = page.locator(
        '.component-playground[data-playground="alert"]',
      )
      const alerts = playground.locator('zw-alert')

      return page
        .goto('playground/alert/')
        .then(() =>
          expectPage(playground).toHaveAttribute('data-ready', 'true'),
        )
        .then(() => expectPage(alerts).toHaveCount(3))
        .then(() =>
          alerts.evaluateAll(elements => {
            return elements.map(element => {
              const style = getComputedStyle(element)

              return {
                backgroundColor: style.backgroundColor,
                borderLeftColor: style.borderLeftColor,
                borderLeftWidth: Number.parseFloat(style.borderLeftWidth),
              }
            })
          }),
        )
        .then(styles => {
          expect(
            new Set(
              styles.map(style =>
                [style.backgroundColor, style.borderLeftColor].join('|'),
              ),
            ).size,
          ).toBe(styles.length)

          styles.forEach(style => {
            expect(style.backgroundColor).not.toBe('transparent')
            expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
            expect(style.borderLeftWidth).toBeGreaterThan(0)
          })
        })
        .then(() =>
          playground
            .locator('zw-alert')
            .first()
            .evaluate(element => {
              const title = element.querySelector('zw-alert-title')
              const description = element.querySelector('zw-alert-description')

              return {
                descriptionWeight: description
                  ? Number.parseInt(
                      getComputedStyle(description).fontWeight,
                      10,
                    )
                  : 0,
                titleWeight: title
                  ? Number.parseInt(getComputedStyle(title).fontWeight, 10)
                  : 0,
              }
            }),
        )
        .then(weights => {
          expect(weights.titleWeight).toBeGreaterThan(weights.descriptionWeight)
        })
        .then(() => errors.assertClean())
    })
  })
})
