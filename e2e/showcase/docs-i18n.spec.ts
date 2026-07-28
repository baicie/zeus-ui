import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import { docsShowcaseTarget, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe('docs internationalization', () => {
  it('uses English at the root and preserves the component route when switching languages', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)
      const languageMenu = page.locator('.VPNavBarTranslations')

      return page
        .goto('components/button')
        .then(response => {
          expect(response).not.toBeNull()
          expect(response && response.ok()).toBe(true)
          expect(new URL(page.url()).pathname).toBe(
            '/zeus-ui/components/button',
          )
        })
        .then(() =>
          expectPage(page.locator('html')).toHaveAttribute('lang', 'en-US'),
        )
        .then(() =>
          expectPage(
            page.getByRole('heading', {
              level: 1,
              name: 'Button',
            }),
          ).toBeVisible(),
        )
        .then(() =>
          languageMenu
            .getByRole('button', {
              name: 'Change language',
            })
            .click(),
        )
        .then(() =>
          languageMenu
            .getByRole('link', {
              name: '简体中文',
            })
            .click(),
        )
        .then(() =>
          expectPage(page).toHaveURL(
            'http://127.0.0.1:5175/zeus-ui/zh/components/button',
          ),
        )
        .then(() =>
          expectPage(page.locator('html')).toHaveAttribute('lang', 'zh-CN'),
        )
        .then(() =>
          expectPage(
            page.getByRole('heading', {
              level: 1,
              name: '按钮',
            }),
          ).toBeVisible(),
        )
        .then(() =>
          languageMenu
            .getByRole('button', {
              name: '切换语言',
            })
            .click(),
        )
        .then(() =>
          languageMenu
            .getByRole('link', {
              name: 'English',
            })
            .click(),
        )
        .then(() =>
          expectPage(page).toHaveURL(
            'http://127.0.0.1:5175/zeus-ui/components/button',
          ),
        )
        .then(() =>
          expectPage(page.locator('html')).toHaveAttribute('lang', 'en-US'),
        )
        .then(() => errors.assertClean())
    })
  })
})
