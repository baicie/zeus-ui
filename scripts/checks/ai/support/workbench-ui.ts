import type { Page } from '@playwright/test'
/**
 * Shared UI actions for the Workbench gates.
 *
 * The composer-ownership rules are the ones the maintainer's P0 report was
 * about, so they are asserted the same way everywhere: by counting what a
 * person can actually see and type into, not by looking for a `data-testid`
 * that happens to exist somewhere in the DOM.
 */
import { expect } from '@playwright/test'

export type ComposerKind = 'host' | 'byok'

/** Opens the topbar model picker. */
export async function openModePicker(page: Page): Promise<void> {
  const trigger = page.getByTestId('model-picker')
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click()
  }
  await expect(page.getByTestId('model-menu')).toBeVisible()
}

/**
 * Switches the run mode the way a person does: the topbar picker, then one
 * item in it.
 *
 * Every gate uses this so the interaction itself stays covered. The menu must
 * then be gone — a picker that stays open after a selection is a real defect
 * (the production-build gate found `setMode('host')` returning early while
 * already on Agent and leaving it open), so this waits rather than dismissing.
 */
export async function selectMode(
  page: Page,
  mode: 'host' | 'byok',
): Promise<void> {
  await openModePicker(page)
  await page.getByTestId(`mode-${mode}`).click()
  await expect(page.getByTestId('model-menu')).toBeHidden({ timeout: 15_000 })
}

/**
 * Every textarea a person can see, with the composer that owns it. A node that
 * is detached, `display: none`, zero-sized or hidden by an ancestor is not
 * counted: "invisible duplicate" is exactly the failure not to mask.
 */
export async function visibleComposers(
  page: Page,
): Promise<Array<{ kind: ComposerKind; value: string; testid: string }>> {
  return page.evaluate(`(() => {
    const seen = []
    for (const node of document.querySelectorAll('textarea')) {
      const rect = node.getBoundingClientRect()
      let hidden = false
      for (let el = node; el; el = el.parentElement) {
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') {
          hidden = true
          break
        }
      }
      if (hidden || rect.width === 0 || rect.height === 0) continue
      seen.push({
        kind: node.closest('zw-ai-composer') ? 'host' : 'byok',
        value: node.value,
        testid: node.dataset.testid || '',
      })
    }
    return seen
  })()`)
}

/**
 * The core invariant: the reader can find exactly one input, and it belongs
 * to the mode they chose.
 */
export async function expectSingleComposer(
  page: Page,
  kind: ComposerKind,
): Promise<void> {
  const composers = await visibleComposers(page)
  expect(
    composers.map(entry => entry.kind),
    `visible composers: ${JSON.stringify(composers)}`,
  ).toEqual([kind])
}

/** Focuses the composer and types like a person: click, then keys. */
export async function typeInComposer(
  page: Page,
  kind: ComposerKind,
  text: string,
): Promise<void> {
  const input =
    kind === 'host'
      ? page.locator('zw-ai-composer textarea')
      : page.getByTestId('byok-input')
  await input.click()
  await page.keyboard.type(text)
}
