import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import {
  docsShowcaseTarget,
  waitForZeusElements,
  withShowcasePage,
} from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe('showcase keyboard interactions', () => {
  it('traps dialog focus and returns it to the trigger on Escape', () => {
    return withShowcasePage(docsShowcaseTarget, async page => {
      const errors = collectPageErrors(page)

      await page.goto('components/dialog')
      const playground = page.locator(
        '.component-playground[data-playground="dialog"]',
      )
      await expectPage(playground).toHaveAttribute('data-ready', 'true')
      await waitForZeusElements(playground)

      const trigger = page.getByRole('button', { name: 'Open project dialog' })
      await trigger.focus()
      await trigger.press('Enter')

      const dialog = page.getByRole('dialog', { name: 'Create project' })
      const cancel = dialog.getByRole('button', { name: 'Cancel' })
      const create = dialog.getByRole('button', { name: 'Create project' })
      const title = playground.locator('[data-slot="dialog-title"]')
      const description = playground.locator('[data-slot="dialog-description"]')
      await expectPage(dialog).toBeVisible()
      await expectPage(dialog).toHaveAttribute('aria-modal', 'true')
      await expectPage(dialog).toHaveAttribute(
        'aria-labelledby',
        (await title.getAttribute('id')) || '',
      )
      await expectPage(dialog).toHaveAttribute(
        'aria-describedby',
        (await description.getAttribute('id')) || '',
      )
      await expectPage(cancel).toBeFocused()

      await cancel.press('Shift+Tab')
      await expectPage(create).toBeFocused()
      await create.press('Tab')
      await expectPage(cancel).toBeFocused()
      await cancel.press('Escape')

      await expectPage(dialog).toBeHidden()
      await expectPage(trigger).toHaveAttribute('aria-expanded', 'false')
      await expectPage(trigger).toBeFocused()
      errors.assertClean()
    })
  })

  it('moves tab focus and selection with arrow, Home, and End keys', () => {
    return withShowcasePage(docsShowcaseTarget, async page => {
      const errors = collectPageErrors(page)

      await page.goto('components/tabs')
      const playground = page.locator(
        '.component-playground[data-playground="tabs"]',
      )
      await expectPage(playground).toHaveAttribute('data-ready', 'true')
      await waitForZeusElements(playground)

      const tablist = playground.getByRole('tablist')
      const overview = playground.getByRole('tab', { name: 'Overview' })
      const activity = playground.getByRole('tab', { name: 'Activity' })
      const settings = playground.getByRole('tab', { name: 'Settings' })

      await expectPage(tablist).toHaveAttribute(
        'aria-orientation',
        'horizontal',
      )
      await expectPage(overview).toHaveAttribute('aria-selected', 'true')
      await expectPage(overview).toHaveAttribute('tabindex', '0')
      await overview.focus()
      await page.keyboard.press('ArrowRight')
      await expectPage(activity).toBeFocused()
      await expectPage(activity).toHaveAttribute('aria-selected', 'true')

      const activityPanelId = await activity.getAttribute('aria-controls')
      const activityPanel = playground.locator(`#${activityPanelId}`)
      await expectPage(activityPanel).toHaveRole('tabpanel')
      await expectPage(activityPanel).toHaveAttribute(
        'aria-labelledby',
        (await activity.getAttribute('id')) || '',
      )
      await expectPage(activityPanel).toBeVisible()

      await page.keyboard.press('End')
      await expectPage(settings).toBeFocused()
      await expectPage(settings).toHaveAttribute('aria-selected', 'true')
      await page.keyboard.press('Home')
      await expectPage(overview).toBeFocused()
      await expectPage(overview).toHaveAttribute('aria-selected', 'true')
      errors.assertClean()
    })
  })

  it('commits the active select option and moves focus on Tab', () => {
    return withShowcasePage(docsShowcaseTarget, async page => {
      const errors = collectPageErrors(page)

      await page.goto('components/select')
      const playground = page.locator(
        '.component-playground[data-playground="select"]',
      )
      await expectPage(playground).toHaveAttribute('data-ready', 'true')
      await waitForZeusElements(playground)

      const combobox = playground.getByRole('combobox', {
        name: 'Deployment environment',
      })
      const select = playground.locator('zw-select')
      await combobox.focus()
      await combobox.press('Enter')
      await expectPage(combobox).toHaveAttribute('aria-expanded', 'true')

      const listbox = page.getByRole('listbox', {
        name: 'Deployment environment',
      })
      await expectPage(listbox).toBeVisible()
      await combobox.press('ArrowDown')

      const activeId = await combobox.getAttribute('aria-activedescendant')
      expect(activeId).toBeTruthy()
      await expectPage(page.locator(`#${activeId}`)).toHaveAttribute(
        'data-value',
        'production',
      )

      await combobox.press('Tab')
      await expectPage(combobox).toHaveAttribute('aria-expanded', 'false')
      await expectPage(listbox).toBeHidden()
      await expectPage(combobox).not.toBeFocused()
      await expectPage(page.getByText(/Deploy to:\s*Production/)).toBeVisible()
      await expectPage(select).toHaveAttribute('data-value', 'production')
      errors.assertClean()
    })
  })

  it('keeps the active descendant aligned with keyboard grid navigation', () => {
    return withShowcasePage(docsShowcaseTarget, async page => {
      const errors = collectPageErrors(page)

      await page.goto('components/data-grid')
      const gridHost = page.getByTestId('data-grid-playground-grid')
      const grid = gridHost.getByRole('grid', {
        name: 'High performance data grid playground',
      })
      await expectPage(
        page.locator('.data-grid-playground__grid-frame'),
      ).toHaveAttribute('aria-busy', 'false')
      await expectPage(
        gridHost.locator('[data-slot="data-grid-cell"]').first(),
      ).toBeVisible()
      await expectPage(
        gridHost.locator(
          '[data-slot="data-grid-cell"][data-row-key="row-1"][data-column-id="column-2"]',
        ),
      ).toBeVisible()

      await expectPage(grid).toHaveAttribute('aria-rowcount', '10001')
      await expectPage(gridHost).toHaveAttribute('data-column-count', '20')
      await expectPage(grid).toHaveAttribute('aria-colcount', '20')

      const firstCell = gridHost.getByRole('gridcell').first()
      await firstCell.focus()
      await expectPage(firstCell).toBeFocused()

      const initialActiveDescendant = await grid.getAttribute(
        'aria-activedescendant',
      )
      await firstCell.press('ArrowRight')

      const activeCell = gridHost.locator(
        '[data-slot="data-grid-cell"][data-active]',
      )
      await expectPage(activeCell).toHaveAttribute('data-row-key', 'row-1')
      await expectPage(activeCell).toHaveAttribute('data-column-id', 'column-2')
      await expectPage(activeCell).toBeFocused()

      const activeCellId = await activeCell.getAttribute('id')
      expect(activeCellId).toBeTruthy()
      expect(activeCellId).not.toBe(initialActiveDescendant)
      await expectPage(grid).toHaveAttribute(
        'aria-activedescendant',
        activeCellId || '',
      )

      await activeCell.press('ArrowDown')
      await expectPage(activeCell).toHaveAttribute('data-row-key', 'row-2')
      await expectPage(activeCell).toHaveAttribute('data-column-id', 'column-2')
      await expectPage(
        gridHost.locator('[data-slot="data-grid-row"][data-row-key="row-2"]'),
      ).toHaveAttribute('aria-rowindex', '3')
      await expectPage(activeCell).toBeFocused()

      const nextActiveCellId = await activeCell.getAttribute('id')
      await expectPage(grid).toHaveAttribute(
        'aria-activedescendant',
        nextActiveCellId || '',
      )
      errors.assertClean()
    })
  })
})
