import type {
  WebCInstanceBenchmarkApi,
  WebCInstanceBenchmarkInput,
  WebCInstanceBenchmarkKind,
  WebCMountMetric,
  WebCOperationMetric,
  WebCStructureSnapshot,
} from './src/benchmark-types'
import { chromium } from '@playwright/test'

import { describe, expect, it } from 'vitest'
import { WEB_C_INSTANCE_BENCHMARK_KEY } from './src/benchmark-types'

const BENCHMARK_URL = 'http://127.0.0.1:5177'

describe('web-c instance benchmark infrastructure', () => {
  it('runs a complete custom element lifecycle in Chromium', () => {
    return chromium.launch({ headless: true }).then(browser => {
      return browser
        .newPage()
        .then(page => {
          return page
            .goto(BENCHMARK_URL)
            .then(() =>
              page.waitForFunction(key => {
                return typeof Reflect.get(globalThis, key) === 'object'
              }, WEB_C_INSTANCE_BENCHMARK_KEY),
            )
            .then(() => {
              return page.evaluate(
                ({ key, kind }) => {
                  const api = Reflect.get(
                    globalThis,
                    key,
                  ) as WebCInstanceBenchmarkApi
                  return api.prepare(kind)
                },
                {
                  key: WEB_C_INSTANCE_BENCHMARK_KEY,
                  kind: 'native-button' as WebCInstanceBenchmarkKind,
                },
              )
            })
            .then(() => {
              return page.evaluate(
                ({ key, input }) => {
                  const api = Reflect.get(
                    globalThis,
                    key,
                  ) as WebCInstanceBenchmarkApi
                  return api.mount(input)
                },
                {
                  key: WEB_C_INSTANCE_BENCHMARK_KEY,
                  input: {
                    kind: 'native-button',
                    count: 10,
                  } as WebCInstanceBenchmarkInput,
                },
              )
            })
            .then((metric: WebCMountMetric) => {
              expect(metric.durationMs).toBeGreaterThanOrEqual(0)
              expect(metric.structure).toEqual({
                buttonCount: 10,
                customElementCount: 10,
                totalElementCount: 51,
                updatedElementCount: 0,
              })
            })
            .then(() => {
              return page.evaluate(key => {
                const api = Reflect.get(
                  globalThis,
                  key,
                ) as WebCInstanceBenchmarkApi
                return api.update()
              }, WEB_C_INSTANCE_BENCHMARK_KEY)
            })
            .then((metric: WebCOperationMetric) => {
              expect(metric.durationMs).toBeGreaterThanOrEqual(0)
              return page.evaluate(key => {
                const api = Reflect.get(
                  globalThis,
                  key,
                ) as WebCInstanceBenchmarkApi
                return api.snapshot()
              }, WEB_C_INSTANCE_BENCHMARK_KEY)
            })
            .then((snapshot: WebCStructureSnapshot) => {
              expect(snapshot.updatedElementCount).toBe(10)
              return page.evaluate(key => {
                const api = Reflect.get(
                  globalThis,
                  key,
                ) as WebCInstanceBenchmarkApi
                return api.disconnect().then(() => api.reconnect())
              }, WEB_C_INSTANCE_BENCHMARK_KEY)
            })
            .then((metric: WebCOperationMetric) => {
              expect(metric.durationMs).toBeGreaterThanOrEqual(0)
              return page.evaluate(key => {
                const api = Reflect.get(
                  globalThis,
                  key,
                ) as WebCInstanceBenchmarkApi
                return api.dispose()
              }, WEB_C_INSTANCE_BENCHMARK_KEY)
            })
            .then((metric: WebCOperationMetric) => {
              expect(metric.durationMs).toBeGreaterThanOrEqual(0)
              return page.locator('zw-button').count()
            })
            .then(count => expect(count).toBe(0))
        })
        .finally(() => browser.close())
    })
  })
})
