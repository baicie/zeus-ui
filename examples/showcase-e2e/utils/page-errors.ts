import type { Page } from '@playwright/test'
import { expect } from 'vitest'

const ignoredConsolePatterns = [
  /Download the React DevTools/i,
  /Vue Devtools/i,
  /vite\/client/i,
  /HMR connection/i,
  /Failed to load resource.*vite/i,
  /Failed to load resource.*404/i,
  /\[zeus:web-c\] Failed to initialize/i,
  /\[Zeus context\] No provider found/i,
]

export interface PageErrorCollector {
  assertClean: () => Promise<void>
}

export function collectPageErrors(page: Page): PageErrorCollector {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []

  page.on('pageerror', error => {
    pageErrors.push(error.stack || error.message)
  })

  page.on('console', message => {
    if (message.type() !== 'error') {
      return
    }

    const text = message.text()

    if (ignoredConsolePatterns.some(pattern => pattern.test(text))) {
      return
    }

    consoleErrors.push(text)
  })

  return {
    assertClean() {
      return Promise.resolve()
        .then(() => {
          expect(pageErrors).toEqual([])
        })
        .then(() => {
          expect(consoleErrors).toEqual([])
        })
    },
  }
}
