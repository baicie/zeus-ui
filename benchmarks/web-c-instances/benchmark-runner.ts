import type {
  Browser,
  BrowserContext,
  CDPSession,
  Page,
} from '@playwright/test'

import type { WebCInstanceBenchmarkScenario } from './benchmark-config'
import type {
  WebCInstanceBenchmarkChurnSampleResult,
  WebCInstanceBenchmarkSampleResult,
} from './benchmark-results'
import type {
  WebCInstanceBenchmarkApi,
  WebCInstanceBenchmarkInput,
  WebCMountMetric,
  WebCOperationMetric,
  WebCStructureSnapshot,
} from './src/benchmark-types'
import { WEB_C_INSTANCE_BENCHMARK_KEY } from './src/benchmark-types'

const BENCHMARK_URL = 'http://127.0.0.1:5177'

type PageOperationName = 'update' | 'disconnect' | 'reconnect' | 'dispose'

interface PageDiagnostics {
  errors: string[]
}

function collectPageDiagnostics(page: Page): PageDiagnostics {
  const errors: string[] = []

  page.on('pageerror', error => {
    errors.push(error.stack || error.message)
  })

  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })

  page.on('requestfailed', request => {
    const failure = request.failure()
    const errorText = failure ? failure.errorText : 'request failed'
    errors.push(`${errorText}: ${request.url()}`)
  })

  return { errors }
}

function collectHeapUsage(session: CDPSession): Promise<number> {
  return session
    .send('HeapProfiler.collectGarbage')
    .then(() => session.send('Runtime.getHeapUsage'))
    .then(result => result.usedSize)
}

function waitForBenchmarkApi(page: Page): Promise<void> {
  return page
    .goto(BENCHMARK_URL)
    .then(() =>
      page.waitForFunction(key => {
        return typeof Reflect.get(globalThis, key) === 'object'
      }, WEB_C_INSTANCE_BENCHMARK_KEY),
    )
    .then(() => {})
}

function preparePage(
  page: Page,
  scenario: WebCInstanceBenchmarkScenario,
): Promise<void> {
  return page.evaluate(
    ({ key, kind }) => {
      const api = Reflect.get(globalThis, key) as WebCInstanceBenchmarkApi
      return api.prepare(kind)
    },
    {
      key: WEB_C_INSTANCE_BENCHMARK_KEY,
      kind: scenario.kind,
    },
  )
}

function mountPage(
  page: Page,
  input: WebCInstanceBenchmarkInput,
): Promise<WebCMountMetric> {
  return page.evaluate(
    ({ key, benchmarkInput }) => {
      const api = Reflect.get(globalThis, key) as WebCInstanceBenchmarkApi
      return api.mount(benchmarkInput)
    },
    {
      key: WEB_C_INSTANCE_BENCHMARK_KEY,
      benchmarkInput: input,
    },
  )
}

function runPageOperation(
  page: Page,
  operation: PageOperationName,
): Promise<WebCOperationMetric> {
  return page.evaluate(
    ({ key, operationName }) => {
      const api = Reflect.get(globalThis, key) as WebCInstanceBenchmarkApi
      return api[operationName]()
    },
    {
      key: WEB_C_INSTANCE_BENCHMARK_KEY,
      operationName: operation,
    },
  )
}

function getPageSnapshot(page: Page): Promise<WebCStructureSnapshot> {
  return page.evaluate(key => {
    const api = Reflect.get(globalThis, key) as WebCInstanceBenchmarkApi
    return api.snapshot()
  }, WEB_C_INSTANCE_BENCHMARK_KEY)
}

function getDocumentCustomElementCount(page: Page): Promise<number> {
  return page.locator('body *').evaluateAll(elements => {
    return elements.filter(element => element.localName.startsWith('zw-'))
      .length
  })
}

function assertCleanDiagnostics(diagnostics: PageDiagnostics): void {
  if (diagnostics.errors.length > 0) {
    throw new Error(
      `Benchmark page reported errors:\n${diagnostics.errors.join('\n')}`,
    )
  }
}

export function runBenchmarkSample(
  browser: Browser,
  scenario: WebCInstanceBenchmarkScenario,
  count: number,
  sample: number,
): Promise<WebCInstanceBenchmarkSampleResult> {
  let context: BrowserContext | undefined
  let page: Page
  let session: CDPSession
  let diagnostics: PageDiagnostics
  let heapBefore = 0
  let heapMounted = 0
  let mountMetric: WebCMountMetric
  let updateMetric: WebCOperationMetric
  let disconnectMetric: WebCOperationMetric
  let reconnectMetric: WebCOperationMetric
  let reconnectStructure: WebCStructureSnapshot
  let disposeMetric: WebCOperationMetric

  return browser
    .newContext()
    .then(nextContext => {
      context = nextContext
      return nextContext.newPage()
    })
    .then(nextPage => {
      page = nextPage
      diagnostics = collectPageDiagnostics(page)
      return waitForBenchmarkApi(page)
    })
    .then(() => page.context().newCDPSession(page))
    .then(nextSession => {
      session = nextSession
      return preparePage(page, scenario)
    })
    .then(() => collectHeapUsage(session))
    .then(heap => {
      heapBefore = heap
      return mountPage(page, {
        kind: scenario.kind,
        count,
      })
    })
    .then(metric => {
      mountMetric = metric
      return collectHeapUsage(session)
    })
    .then(heap => {
      heapMounted = heap
      return runPageOperation(page, 'update')
    })
    .then(metric => {
      updateMetric = metric
      return runPageOperation(page, 'disconnect')
    })
    .then(metric => {
      disconnectMetric = metric
      return runPageOperation(page, 'reconnect')
    })
    .then(metric => {
      reconnectMetric = metric
      return getPageSnapshot(page)
    })
    .then(snapshot => {
      reconnectStructure = snapshot
      return runPageOperation(page, 'dispose')
    })
    .then(metric => {
      disposeMetric = metric
      return collectHeapUsage(session)
    })
    .then(heapAfterDispose => {
      return getDocumentCustomElementCount(page).then(
        documentCustomElementCountAfterDispose => {
          assertCleanDiagnostics(diagnostics)

          return {
            kind: scenario.kind,
            label: scenario.label,
            count,
            sample,
            mountMs: mountMetric.durationMs,
            updateMs: updateMetric.durationMs,
            disconnectMs: disconnectMetric.durationMs,
            reconnectMs: reconnectMetric.durationMs,
            disposeMs: disposeMetric.durationMs,
            heapMountedDeltaBytes: heapMounted - heapBefore,
            heapRetainedBytes: heapAfterDispose - heapBefore,
            mountStructure: mountMetric.structure,
            reconnectStructure,
            documentCustomElementCountAfterDispose,
          }
        },
      )
    })
    .finally(() => {
      if (!context) return Promise.resolve()
      return context.close()
    })
}

export function runBenchmarkChurnSample(
  browser: Browser,
  scenario: WebCInstanceBenchmarkScenario,
  count: number,
  rounds: number,
  sample: number,
): Promise<WebCInstanceBenchmarkChurnSampleResult> {
  let context: BrowserContext | undefined
  let page: Page
  let session: CDPSession
  let diagnostics: PageDiagnostics
  let heapBefore = 0
  const heapRetainedBytesByRound: number[] = []
  const documentCustomElementCountAfterDisposeByRound: number[] = []

  return browser
    .newContext()
    .then(nextContext => {
      context = nextContext
      return nextContext.newPage()
    })
    .then(nextPage => {
      page = nextPage
      diagnostics = collectPageDiagnostics(page)
      return waitForBenchmarkApi(page)
    })
    .then(() => page.context().newCDPSession(page))
    .then(nextSession => {
      session = nextSession
      return preparePage(page, scenario)
    })
    .then(() => collectHeapUsage(session))
    .then(heap => {
      heapBefore = heap
      let sequence = Promise.resolve()

      for (let round = 1; round <= rounds; round += 1) {
        sequence = sequence
          .then(() => {
            return mountPage(page, {
              kind: scenario.kind,
              count,
            })
          })
          .then(() => runPageOperation(page, 'update'))
          .then(() => runPageOperation(page, 'dispose'))
          .then(() => collectHeapUsage(session))
          .then(heapAfterDispose => {
            heapRetainedBytesByRound.push(heapAfterDispose - heapBefore)
            return getDocumentCustomElementCount(page)
          })
          .then(documentCustomElementCountAfterDispose => {
            documentCustomElementCountAfterDisposeByRound.push(
              documentCustomElementCountAfterDispose,
            )
          })
      }

      return sequence
    })
    .then(() => {
      assertCleanDiagnostics(diagnostics)

      return {
        kind: scenario.kind,
        label: scenario.label,
        count,
        sample,
        heapRetainedBytesByRound,
        documentCustomElementCountAfterDisposeByRound,
      }
    })
    .finally(() => {
      if (!context) return Promise.resolve()
      return context.close()
    })
}
