export const WEB_C_INSTANCE_BENCHMARK_KEY = '__ZEUS_WEB_C_INSTANCE_BENCHMARK__'

export type WebCInstanceBenchmarkKind =
  | 'native-button-baseline'
  | 'native-button'
  | 'react-button'
  | 'vue-button-baseline'
  | 'vue-native-button'
  | 'vue-button'
  | 'native-accordion'

export interface WebCInstanceBenchmarkInput {
  kind: WebCInstanceBenchmarkKind
  count: number
}

export interface WebCOperationMetric {
  durationMs: number
}

export interface WebCStructureSnapshot {
  buttonCount: number
  customElementCount: number
  totalElementCount: number
  updatedElementCount: number
}

export interface WebCMountMetric extends WebCOperationMetric {
  structure: WebCStructureSnapshot
}

export interface WebCInstanceBenchmarkApi {
  prepare: (kind: WebCInstanceBenchmarkKind) => Promise<void>
  mount: (input: WebCInstanceBenchmarkInput) => Promise<WebCMountMetric>
  update: () => Promise<WebCOperationMetric>
  disconnect: () => Promise<WebCOperationMetric>
  reconnect: () => Promise<WebCOperationMetric>
  dispose: () => Promise<WebCOperationMetric>
  snapshot: () => WebCStructureSnapshot
}
