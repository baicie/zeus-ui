export type VirtualScrollAlign = 'start' | 'center' | 'end'

export type EstimateSize = number | ((index: number) => number)

export interface VirtualRange {
  start: number
  end: number
  overscanStart: number
  overscanEnd: number
}

export interface VirtualItem<TData = unknown> {
  index: number
  key: string
  start: number
  size: number
  end: number
  data?: TData
}

export interface VirtualizerOptions {
  count: number
  estimateSize: EstimateSize
  overscan?: number
  getItemKey?: (index: number) => string
}

export interface ScrollToIndexOptions {
  align?: VirtualScrollAlign
  viewportSize?: number
}

export interface Virtualizer {
  getCount: () => number
  getTotalSize: () => number
  getRange: (scrollOffset: number, viewportSize: number) => VirtualRange
  getItems: (range: VirtualRange) => VirtualItem[]
  getOffsetForIndex: (index: number, options?: ScrollToIndexOptions) => number
  measure: (index: number, size: number) => void
  resetMeasurements: () => void
}

export type {
  VirtualListProps,
  VirtualListElement,
  VirtualListRangeChangeDetail,
  VirtualListScrollOffsetChangeDetail,
} from './components/virtual-list'
