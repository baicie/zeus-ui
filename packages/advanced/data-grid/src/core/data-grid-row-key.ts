/**
 * Stable identity used by the headless grid and framework renderer boundary.
 *
 * Keep this type free of component JSX imports so renderer consumers can
 * type-check against the adapter without loading the DOM component module.
 */
export type DataGridRowKey = string
