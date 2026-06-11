import type { Page, Response } from '@playwright/test'
import { expect } from 'vitest'

const ignoredConsolePatterns = [
  /Download the React DevTools/i,
  /Vue Devtools/i,
  /vite\/client/i,
  /HMR connection/i,
  /Failed to load resource: the server responded with a status of 404 \(Not Found\)/i,
  /^\[zeus:web-c\] Failed to initialize <zw-.+>\. Error: \[Zeus context\] No provider found for context\./i,
]

const ignoredResponsePatterns = [/\/favicon\.ico$/]

export interface PageErrorCollector {
  assertClean: () => Promise<void>
}

function shouldIgnoreResponse(response: Response): boolean {
  const url = response.url()

  return ignoredResponsePatterns.some(pattern => pattern.test(url))
}

export function collectPageErrors(page: Page): PageErrorCollector {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const failedResponses: string[] = []
  const requestFailures: string[] = []

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

  page.on('response', response => {
    if (shouldIgnoreResponse(response)) {
      return
    }

    const status = response.status()

    if (status >= 400) {
      failedResponses.push(`${status} ${response.url()}`)
    }
  })

  page.on('requestfailed', request => {
    const failure = request.failure()
    const errorText = failure ? failure.errorText : 'request failed'

    requestFailures.push(`${errorText} ${request.url()}`)
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
        .then(() => {
          expect(failedResponses).toEqual([])
        })
        .then(() => {
          expect(requestFailures).toEqual([])
        })
    },
  }
}
