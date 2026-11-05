import type { DataGridRowKey } from './data-grid-row-key'

/**
 * Framework-neutral payload handed to a cell renderer.
 *
 * This module must not import the DataGrid component or the public `types.ts`
 * barrel: framework consumers (for example the React 18 fixture) import the
 * adapter directly, and dragging Zeus JSX source into their type graph would
 * type-check it against the consumer's JSX namespace.
 */
export interface DataGridCellRendererInput<TRow = unknown, TValue = unknown> {
  rowKey: DataGridRowKey
  columnId: string
  row: TRow
  value: TValue
}

export interface DataGridCellRenderer<
  TRow = unknown,
  TValue = unknown,
  THandle = unknown,
  TContainer = HTMLElement,
> {
  /* eslint-disable ts/method-signature-style -- bivariant handles keep framework-specific adapters assignable. */
  mount(
    container: TContainer,
    input: DataGridCellRendererInput<TRow, TValue>,
  ): THandle
  update(handle: THandle, input: DataGridCellRendererInput<TRow, TValue>): void
  dispose(handle: THandle): void
  /* eslint-enable ts/method-signature-style */
}
