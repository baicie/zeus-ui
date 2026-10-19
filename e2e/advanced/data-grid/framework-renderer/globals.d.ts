interface DataGridFixtureSnapshot {
  hostConnected: boolean
  reactText: string
  vueText: string
  portalText: string
  teleportText: string
  externalTargetExists: boolean
  externalSentinelCount: number
  reactMounted: number
  reactDisposed: number
  vueMounted: number
  vueDisposed: number
}

interface DataGridFixtureUpdateResult extends DataGridFixtureSnapshot {
  sameReactButton: boolean
  sameVueButton: boolean
}

interface DataGridFixtureApi {
  update: (value: string) => Promise<DataGridFixtureUpdateResult>
  disconnect: () => void
  reconnect: () => void
  snapshot: () => DataGridFixtureSnapshot
}

interface Window {
  __dataGridFixture: DataGridFixtureApi
}
