/**
 * Types for `verify-historical-release.mjs`.
 *
 * The module ships as plain `.mjs` so the verification workflow can run it
 * with `node` directly. This declaration keeps the tests strict.
 */

export type ItemStatus = 'PASS' | 'FAIL' | 'UNKNOWN'
export type Verdict = 'PASS' | 'FAIL' | 'INCOMPLETE'

export declare const ITEMS: readonly string[]

export interface HistoricalReleaseOptions {
  version: string
  tag: string
  target: string
  registry: string
  baselineFound?: string
}

export interface ItemResult {
  status: ItemStatus
  detail: string
  failures: string[]
}

export interface HistoricalReleaseReport {
  schema: string
  version: string
  tag: string
  registry: string
  target: string
  checkedAt: string
  baselineFound: boolean
  packageCount: number
  verdict: Verdict
  items: Record<string, ItemResult>
}

export interface VerificationDependencies {
  fetchJson?: (url: string) => Promise<{ status: number, body: unknown }>
  downloadAndHash?: (
    url: string,
  ) => Promise<{ ok: boolean, status?: number, sha512?: string, bytes?: number }>
}

export declare function parseArgs(args: string[]): Record<string, string>

export declare function readTargetPackages(targetRoot: string): Array<{
  name: string
  version: string
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
  optionalDependencies: Record<string, string>
}>

export declare function verifyHistoricalRelease(
  options: HistoricalReleaseOptions,
  deps?: VerificationDependencies,
): Promise<HistoricalReleaseReport>
