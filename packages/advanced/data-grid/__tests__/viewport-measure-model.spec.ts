import { describe, expect, it } from 'vitest'

import {
  createDataGridViewportMeasureController,
  resolveDataGridViewportMeasurement,
  shouldEmitDataGridViewportResize,
} from '../src/core'

describe('viewport measure model', () => {
  it('uses client height when available', () => {
    expect(
      resolveDataGridViewportMeasurement({
        clientHeight: 240,
        rowHeight: 40,
        rowCount: 100,
      }),
    ).toEqual({
      size: 240,
      source: 'client',
    })
  })

  it('falls back to visible row estimate when client height is zero', () => {
    expect(
      resolveDataGridViewportMeasurement({
        clientHeight: 0,
        rowHeight: 40,
        rowCount: 100,
      }),
    ).toEqual({
      size: 400,
      source: 'fallback',
    })
  })

  it('caps fallback by row count', () => {
    expect(
      resolveDataGridViewportMeasurement({
        clientHeight: 0,
        rowHeight: 40,
        rowCount: 3,
      }),
    ).toEqual({
      size: 120,
      source: 'fallback',
    })
  })

  it('keeps at least one row fallback for empty data', () => {
    expect(
      resolveDataGridViewportMeasurement({
        clientHeight: 0,
        rowHeight: 40,
        rowCount: 0,
      }),
    ).toEqual({
      size: 40,
      source: 'fallback',
    })
  })

  it('detects viewport resize changes', () => {
    expect(
      shouldEmitDataGridViewportResize(
        {
          size: 40,
          source: 'fallback',
        },
        {
          size: 80,
          source: 'fallback',
        },
      ),
    ).toBe(true)

    expect(
      shouldEmitDataGridViewportResize(
        {
          size: 80,
          source: 'fallback',
        },
        {
          size: 80,
          source: 'client',
        },
      ),
    ).toBe(true)

    expect(
      shouldEmitDataGridViewportResize(
        {
          size: 80,
          source: 'client',
        },
        {
          size: 80,
          source: 'client',
        },
      ),
    ).toBe(false)
  })

  it('tracks latest measurement in controller', () => {
    const controller = createDataGridViewportMeasureController()

    expect(controller.measure(0, 40, 2)).toEqual({
      size: 80,
      source: 'fallback',
    })

    expect(controller.measure(240, 40, 2)).toEqual({
      size: 240,
      source: 'client',
    })

    expect(controller.getMeasurement()).toEqual({
      size: 240,
      source: 'client',
    })
  })
})
