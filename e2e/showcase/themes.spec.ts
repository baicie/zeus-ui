import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import { showcaseTargets, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe.each(showcaseTargets)('$name showcase themes page', target => {
  it('switches theme, mode, radius and motion', () => {
    return withShowcasePage(target, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/themes')
        .then(() =>
          expectPage(
            page.getByRole('heading', { name: 'Themes' }),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(page.getByText('Semantic token palette')).toBeVisible(),
        )
        .then(() =>
          expectPage(page.getByText('Component preview')).toBeVisible(),
        )
        .then(() => page.getByRole('button', { name: /Slate/ }).click())
        .then(() => page.getByLabel('Theme mode').selectOption('dark'))
        .then(() => page.getByLabel('Radius preset').selectOption('xl'))
        .then(() => page.getByLabel('Motion preset').selectOption('expressive'))
        .then(() =>
          expectPage(page.getByLabel('Theme mode')).toHaveValue('dark'),
        )
        .then(() =>
          expectPage(page.getByLabel('Radius preset')).toHaveValue('xl'),
        )
        .then(() =>
          expectPage(page.getByLabel('Motion preset')).toHaveValue(
            'expressive',
          ),
        )
        .then(() =>
          expectPage(
            page.getByText("import '@zeus-web/themes/slate.css'"),
          ).toBeVisible(),
        )
        .then(() => errors.assertClean())
    })
  })

  it('copies HTML theme snippet', () => {
    return withShowcasePage(target, (page, context) => {
      const errors = collectPageErrors(page)

      return context
        .grantPermissions(['clipboard-read', 'clipboard-write'])
        .then(() => page.goto('/themes'))
        .then(() => page.getByRole('button', { name: 'HTML usage' }).click())
        .then(() => page.getByRole('button', { name: 'Copy snippet' }).click())
        .then(() =>
          expectPage(
            page.getByRole('button', { name: 'Copied' }),
          ).toBeVisible(),
        )
        .then(() =>
          page
            .evaluate(() => navigator.clipboard.readText())
            .then(text => {
              expect(text).toContain('data-theme="default"')
            }),
        )
        .then(() => errors.assertClean())
    })
  })
})
