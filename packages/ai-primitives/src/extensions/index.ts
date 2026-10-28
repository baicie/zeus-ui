/**
 * Optional S2 capabilities (AI2-512). Separate entry so the core primitives
 * stay free of voice, audio and palette code; none of them bundles a media
 * or speech SDK.
 */

export * from './summaries'
export * from './voice'
