import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import { docsShowcaseTarget, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe('select playground', () => {
  it('uses a custom popup and supports keyboard selection', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)
      const combobox = page.getByRole('combobox', {
        name: 'Deployment environment',
      })
      const listbox = page.getByRole('listbox', {
        name: 'Deployment environment',
      })
      const playground = page.locator(
        '.component-playground[data-playground="select"]',
      )

      return page
        .goto('components/select')
        .then(() => combobox.evaluate(element => element.tagName))
        .then(tagName => expect(tagName).toBe('BUTTON'))
        .then(() =>
          expectPage(
            page.locator('select[data-slot="select-native"]'),
          ).toHaveAttribute('aria-hidden', 'true'),
        )
        .then(() =>
          expectPage(combobox).toHaveAttribute('aria-expanded', 'false'),
        )
        .then(() => combobox.click())
        .then(() =>
          expectPage(combobox).toHaveAttribute('aria-expanded', 'true'),
        )
        .then(() => expectPage(listbox).toBeVisible())
        .then(() => combobox.press('ArrowDown'))
        .then(() =>
          combobox.getAttribute('aria-activedescendant').then(activeId => {
            expect(activeId).toBeTruthy()
            return expectPage(page.locator(`#${activeId}`)).toHaveAttribute(
              'data-value',
              'production',
            )
          }),
        )
        .then(() => combobox.press('Enter'))
        .then(() =>
          expectPage(combobox).toHaveAttribute('aria-expanded', 'false'),
        )
        .then(() =>
          expectPage(page.getByText(/Deploy to:\s*Production/)).toBeVisible(),
        )
        .then(() => combobox.click())
        .then(() => combobox.press('Home'))
        .then(() => combobox.press('Escape'))
        .then(() =>
          expectPage(page.getByText(/Deploy to:\s*Production/)).toBeVisible(),
        )
        .then(() =>
          playground
            .getByRole('combobox', { name: 'Theme' })
            .selectOption('dark'),
        )
        .then(() =>
          playground.evaluate(element => {
            return globalThis
              .getComputedStyle(element)
              .getPropertyValue('--background')
              .trim()
          }),
        )
        .then(background => expect(background).toBe('240 10% 3.9%'))
        .then(() => errors.assertClean())
    })
  })

  it('localizes the popup and supports Chinese typeahead', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)
      const combobox = page.getByRole('combobox', { name: '部署环境' })

      return page
        .goto('zh/components/select')
        .then(() => combobox.dispatchEvent('keydown', { key: '生' }))
        .then(() =>
          expectPage(combobox).toHaveAttribute('aria-expanded', 'true'),
        )
        .then(() =>
          combobox.getAttribute('aria-activedescendant').then(activeId => {
            expect(activeId).toBeTruthy()
            return expectPage(page.locator(`#${activeId}`)).toHaveText(
              '生产环境',
            )
          }),
        )
        .then(() => combobox.press('Enter'))
        .then(() =>
          expectPage(page.getByText(/部署到:\s*生产环境/)).toBeVisible(),
        )
        .then(() => errors.assertClean())
    })
  })

  it('participates in FormData, required validation, and reset', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('components/select')
        .then(() =>
          page.evaluate(() => {
            const form = document.createElement('form')
            form.id = 'select-form-fixture'
            form.style.cssText =
              'position:fixed;right:8px;bottom:8px;z-index:1000;width:18rem'
            form.innerHTML = [
              '<zw-select aria-label="Fixture environment" name="environment" default-value="" required>',
              '<option value="">Choose environment</option>',
              '<option value="staging">Staging</option>',
              '<option value="production">Production</option>',
              '</zw-select>',
            ].join('')
            document.body.append(form)
          }),
        )
        .then(() => {
          const form = page.locator('#select-form-fixture')
          const select = form.locator('zw-select')
          const combobox = form.getByRole('combobox', {
            name: 'Fixture environment',
          })

          return expectPage(select)
            .toHaveAttribute('data-state', 'closed')
            .then(() =>
              expectPage
                .poll(() =>
                  form.evaluate(element =>
                    (element as HTMLFormElement).checkValidity(),
                  ),
                )
                .toBe(false),
            )
            .then(() => combobox.press('End'))
            .then(() => expectPage(select).toHaveAttribute('data-side', 'top'))
            .then(() => combobox.press('Enter'))
            .then(() =>
              expectPage(select).toHaveAttribute('data-value', 'production'),
            )
            .then(() =>
              form.evaluate(element =>
                (element as HTMLFormElement).checkValidity(),
              ),
            )
            .then(valid => expect(valid).toBe(true))
            .then(() =>
              form.evaluate(element => {
                return Array.from(
                  new FormData(element as HTMLFormElement).entries(),
                ).map(entry => [entry[0], String(entry[1])])
              }),
            )
            .then(values =>
              expect(values).toEqual([['environment', 'production']]),
            )
            .then(() =>
              form.evaluate(element => {
                ;(element as HTMLFormElement).reset()
              }),
            )
            .then(() => expectPage(select).toHaveAttribute('data-value', ''))
            .then(() =>
              expectPage(combobox).toContainText('Choose environment'),
            )
            .then(() =>
              form.evaluate(element =>
                (element as HTMLFormElement).checkValidity(),
              ),
            )
            .then(valid => expect(valid).toBe(false))
            .then(() =>
              form.evaluate(element => {
                return Array.from(
                  new FormData(element as HTMLFormElement).entries(),
                ).map(entry => [entry[0], String(entry[1])])
              }),
            )
            .then(values => expect(values).toEqual([['environment', '']]))
            .then(() =>
              select.evaluate(element => element.removeAttribute('required')),
            )
            .then(() =>
              form.evaluate(element =>
                (element as HTMLFormElement).checkValidity(),
              ),
            )
            .then(valid => expect(valid).toBe(true))
            .then(() =>
              select.evaluate(element => element.setAttribute('required', '')),
            )
            .then(() =>
              select.evaluate(element => element.setAttribute('disabled', '')),
            )
            .then(() =>
              form.evaluate(element =>
                (element as HTMLFormElement).checkValidity(),
              ),
            )
            .then(valid => expect(valid).toBe(true))
            .then(() =>
              form.evaluate(element => {
                return Array.from(
                  new FormData(element as HTMLFormElement).entries(),
                )
              }),
            )
            .then(values => expect(values).toEqual([]))
            .then(() =>
              select.evaluate(element => element.removeAttribute('disabled')),
            )
            .then(() =>
              expectPage(select).not.toHaveAttribute('data-disabled', ''),
            )
            .then(() =>
              expectPage
                .poll(() =>
                  form.evaluate(element =>
                    (element as HTMLFormElement).checkValidity(),
                  ),
                )
                .toBe(false),
            )
        })
        .then(() => errors.assertClean())
    })
  })

  it('restores selected options when the form resets', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('components/select')
        .then(() =>
          page.evaluate(() => {
            const form = document.createElement('form')
            form.id = 'select-reset-fixture'
            form.innerHTML = [
              '<zw-select aria-label="Reset environment" name="environment">',
              '<option value="development" selected>Development</option>',
              '<option value="production">Production</option>',
              '</zw-select>',
            ].join('')
            document.body.append(form)
          }),
        )
        .then(() => {
          const form = page.locator('#select-reset-fixture')
          const select = form.locator('zw-select')
          const combobox = form.getByRole('combobox', {
            name: 'Reset environment',
          })

          return expectPage(combobox)
            .toContainText('Development')
            .then(() => combobox.press('End'))
            .then(() => combobox.press('Enter'))
            .then(() =>
              expectPage(select).toHaveAttribute('data-value', 'production'),
            )
            .then(() =>
              form.evaluate(element => {
                const target = element as HTMLFormElement
                target.reset()
                return Array.from(new FormData(target).entries()).map(entry => [
                  entry[0],
                  String(entry[1]),
                ])
              }),
            )
            .then(values =>
              expect(values).toEqual([['environment', 'development']]),
            )
            .then(() =>
              expectPage(select).toHaveAttribute('data-value', 'development'),
            )
            .then(() => expectPage(combobox).toContainText('Development'))
        })
        .then(() => errors.assertClean())
    })
  })

  it('omits a selected disabled option from FormData', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('components/select')
        .then(() =>
          page.evaluate(() => {
            const form = document.createElement('form')
            form.id = 'select-disabled-option-fixture'
            form.innerHTML = [
              '<zw-select aria-label="Disabled environment" name="environment" required>',
              '<option value="archived" disabled selected>Archived</option>',
              '<option value="active">Active</option>',
              '</zw-select>',
            ].join('')
            document.body.append(form)
          }),
        )
        .then(() => {
          const form = page.locator('#select-disabled-option-fixture')
          const select = form.locator('zw-select')

          return expectPage(select)
            .toHaveAttribute('data-value', 'archived')
            .then(() =>
              form.evaluate(element =>
                (element as HTMLFormElement).checkValidity(),
              ),
            )
            .then(valid => expect(valid).toBe(false))
            .then(() =>
              form.evaluate(element => {
                return Array.from(
                  new FormData(element as HTMLFormElement).entries(),
                )
              }),
            )
            .then(values => expect(values).toEqual([]))
        })
        .then(() => errors.assertClean())
    })
  })

  it('separates fieldset disabled state from the authored attribute', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('components/select')
        .then(() =>
          page.evaluate(() => {
            const form = document.createElement('form')
            form.id = 'select-fieldset-fixture'
            form.innerHTML = [
              '<fieldset disabled>',
              '  <zw-select aria-label="Fieldset environment" name="environment">',
              '    <option value="development">Development</option>',
              '    <option value="production">Production</option>',
              '  </zw-select>',
              '</fieldset>',
            ].join('')
            document.body.append(form)
          }),
        )
        .then(() => {
          const form = page.locator('#select-fieldset-fixture')
          const fieldset = form.locator('fieldset')
          const select = form.locator('zw-select')
          const combobox = form.getByRole('combobox', {
            name: 'Fieldset environment',
          })
          const initialState = Promise.all([
            expectPage(select).not.toHaveAttribute('disabled'),
            expectPage(combobox).toBeDisabled(),
          ])

          return initialState
            .then(() =>
              fieldset.evaluate(element => element.removeAttribute('disabled')),
            )
            .then(() =>
              Promise.all([
                expectPage(select).not.toHaveAttribute('disabled'),
                expectPage(combobox).toBeEnabled(),
              ]),
            )
        })
        .then(() => errors.assertClean())
    })
  })

  it('treats property-only disabled as intrinsic form disabled state', () => {
    return withShowcasePage(docsShowcaseTarget, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('components/select')
        .then(() =>
          page.evaluate(() => {
            const form = document.createElement('form')
            form.id = 'select-property-disabled-fixture'
            form.innerHTML = [
              '<zw-select aria-label="Property disabled environment" name="environment" required>',
              '  <option value="">Choose environment</option>',
              '  <option value="production">Production</option>',
              '</zw-select>',
            ].join('')
            document.body.append(form)

            const select = form.querySelector('zw-select') as HTMLElement & {
              disabled?: boolean
            }
            select.disabled = true
          }),
        )
        .then(() => {
          const form = page.locator('#select-property-disabled-fixture')
          const select = form.locator('zw-select')
          const combobox = form.getByRole('combobox', {
            name: 'Property disabled environment',
          })

          return expectPage(select)
            .toHaveAttribute('disabled', '')
            .then(() => expectPage(combobox).toBeDisabled())
            .then(() =>
              form.evaluate(element =>
                (element as HTMLFormElement).checkValidity(),
              ),
            )
            .then(valid => expect(valid).toBe(true))
            .then(() =>
              form.evaluate(element =>
                Array.from(new FormData(element as HTMLFormElement).entries()),
              ),
            )
            .then(values => expect(values).toEqual([]))
        })
        .then(() => errors.assertClean())
    })
  })
})
