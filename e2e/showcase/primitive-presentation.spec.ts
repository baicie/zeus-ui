import type { Locator } from '@playwright/test'

import { expect as expectPage } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import {
  docsShowcaseTarget,
  showcaseTargets,
  withShowcasePage,
} from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

interface PrimitivePresentationTarget {
  name: string
  baseURL: string
  routePrefix: string
  inputPlaceholder: string
  secondTabValue: string
}

interface TabsPanelState {
  value: string | null
  state: string | null
  hidden: boolean
  display: string
}

interface InputPresentationState {
  rootBorderWidth: string
  rootBoxShadow: string
  controlBorderWidth: string
  controlBoxShadow: string
}

const primitivePresentationTargets: PrimitivePresentationTarget[] = [
  {
    name: showcaseTargets[0].name,
    baseURL: showcaseTargets[0].baseURL,
    routePrefix: '/components/',
    inputPlaceholder: 'Email address',
    secondTabValue: 'usage',
  },
  {
    name: showcaseTargets[1].name,
    baseURL: showcaseTargets[1].baseURL,
    routePrefix: '/components/',
    inputPlaceholder: 'Email address',
    secondTabValue: 'usage',
  },
  {
    name: docsShowcaseTarget.name,
    baseURL: docsShowcaseTarget.baseURL,
    routePrefix: 'components/',
    inputPlaceholder: 'you@example.com',
    secondTabValue: 'activity',
  },
]

function readTabsPanelStates(root: Locator): Promise<TabsPanelState[]> {
  return root.evaluate(element => {
    return Array.from(element.querySelectorAll('zw-tabs-content')).map(
      panel => ({
        value: panel.getAttribute('data-value'),
        state: panel.getAttribute('data-state'),
        hidden: panel.hasAttribute('hidden'),
        display: getComputedStyle(panel).display,
      }),
    )
  })
}

function readInputPresentationState(
  control: Locator,
): Promise<InputPresentationState> {
  return control.evaluate(element => {
    const host = element.closest('zw-input')
    const root = host && host.querySelector("[part='root']")

    if (!root) throw new Error('Missing zw-input visual root')

    const rootStyle = getComputedStyle(root)
    const controlStyle = getComputedStyle(element)

    return {
      rootBorderWidth: rootStyle.borderTopWidth,
      rootBoxShadow: rootStyle.boxShadow,
      controlBorderWidth: controlStyle.borderTopWidth,
      controlBoxShadow: controlStyle.boxShadow,
    }
  })
}

describe.each(primitivePresentationTargets)(
  '$name primitive presentation',
  target => {
    it('shows only the active tabs panel', () => {
      return withShowcasePage(target, page => {
        const errors = collectPageErrors(page)
        const tabs = page.locator('zw-tabs').first()
        const secondTrigger = tabs.locator(
          `zw-tabs-trigger[data-value='${target.secondTabValue}'] button`,
        )

        return page
          .goto(`${target.routePrefix}tabs`)
          .then(() => expectPage(tabs).toBeVisible())
          .then(() => readTabsPanelStates(tabs))
          .then(states => {
            expect(states.filter(state => state.display !== 'none')).toEqual([
              {
                value: 'overview',
                state: 'active',
                hidden: false,
                display: 'block',
              },
            ])
          })
          .then(() => secondTrigger.click())
          .then(() => readTabsPanelStates(tabs))
          .then(states => {
            expect(states.filter(state => state.display !== 'none')).toEqual([
              {
                value: target.secondTabValue,
                state: 'active',
                hidden: false,
                display: 'block',
              },
            ])
          })
          .then(() => errors.assertClean())
      })
    })

    it('draws the input focus ring on the visual root', () => {
      return withShowcasePage(target, page => {
        const errors = collectPageErrors(page)
        const control = page.locator(
          `input[placeholder='${target.inputPlaceholder}']`,
        )

        return page
          .goto(`${target.routePrefix}input`)
          .then(() => expectPage(control).toBeVisible())
          .then(() => readInputPresentationState(control))
          .then(state => {
            expect(state.rootBorderWidth).not.toBe('0px')
            expect(state.controlBorderWidth).toBe('0px')
            expect(state.rootBoxShadow).toBe('none')
            expect(state.controlBoxShadow).toBe('none')
          })
          .then(() => control.focus())
          .then(() => page.waitForTimeout(200))
          .then(() => readInputPresentationState(control))
          .then(state => {
            expect(state.rootBoxShadow).not.toBe('none')
            expect(state.controlBoxShadow).toBe('none')
          })
          .then(() => errors.assertClean())
      })
    })
  },
)

describe.each(showcaseTargets)('$name switch presentation', target => {
  it('applies size presets and a focus ring', () => {
    return withShowcasePage(target, page => {
      const errors = collectPageErrors(page)
      const smallTrack = page.locator(
        "zw-switch[size='sm'] [data-slot='switch-track']",
      )
      const mediumControl = page.locator(
        "zw-switch[size='md'] [data-slot='switch-control']",
      )
      const mediumTrack = page.locator(
        "zw-switch[size='md'] [data-slot='switch-track']",
      )
      const largeTrack = page.locator(
        "zw-switch[size='lg'] [data-slot='switch-track']",
      )

      return page
        .goto('/components/switch')
        .then(() =>
          Promise.all([
            smallTrack.evaluate(
              element => element.getBoundingClientRect().width,
            ),
            mediumTrack.evaluate(
              element => element.getBoundingClientRect().width,
            ),
            largeTrack.evaluate(
              element => element.getBoundingClientRect().width,
            ),
          ]),
        )
        .then(widths => {
          expect(widths[0]).toBeLessThan(widths[1])
          expect(widths[1]).toBeLessThan(widths[2])
        })
        .then(() => mediumControl.focus())
        .then(() => page.waitForTimeout(200))
        .then(() =>
          mediumTrack.evaluate(element => getComputedStyle(element).boxShadow),
        )
        .then(boxShadow => expect(boxShadow).not.toBe('none'))
        .then(() => errors.assertClean())
    })
  })
})
