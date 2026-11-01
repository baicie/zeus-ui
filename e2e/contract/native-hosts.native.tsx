/**
 * Native (Zeus JSX) fixture hosts for the PR-24 cross-host contract matrix.
 *
 * `vitest.config.ts` compiles `e2e/**\/*.native.tsx` with the Zeus DOM
 * transform. The event attributes are kebab-case (`onvalue-change`) because
 * that is the spelling the compiler binds as a `value-change` DOM listener;
 * `onValueChange` compiles to `valuechange` and never fires. That rule is
 * pinned by `cross-host-contract.spec.ts` so a compiler change is noticed.
 */

import type {
  DataGridColumn,
  DataGridRowData,
  DataGridSelectionChangeDetail,
} from '@zeus-web/data-grid'

/**
 * The compiled JSX expression is typed as `JSXValue` (it can be a text node or
 * an array), but these factories always return a single custom element.
 */
function host(value: unknown): HTMLElement {
  return value as HTMLElement
}

/** Renders a bare `<zw-input>` bound to `value-change` and `focus-change`. */
export function NativeInput(props: {
  value?: string
  invalid?: boolean
  required?: boolean
  ariaLabel?: string
  onValueChange?: (value: string) => void
  onFocusChange?: (focused: boolean) => void
}): HTMLElement {
  return host(
    <zw-input
      value={props.value}
      invalid={props.invalid}
      required={props.required}
      aria-label={props.ariaLabel}
      onvalue-change={(event: CustomEvent<{ value: string }>) =>
        props.onValueChange?.(event.detail.value)
      }
      onfocus-change={(event: CustomEvent<{ focused: boolean }>) =>
        props.onFocusChange?.(event.detail.focused)
      }
    />,
  )
}

/** Renders a `<zw-select>` with two options. */
export function NativeSelect(props: {
  placeholder?: string
  onValueChange?: (value: string) => void
}): HTMLElement {
  return host(
    <zw-select
      placeholder={props.placeholder}
      onvalue-change={(event: CustomEvent<{ value: string }>) =>
        props.onValueChange?.(event.detail.value)
      }
    >
      <data value="one">One</data>
      <data value="two">Two</data>
    </zw-select>,
  )
}

/** Renders a `<zw-dialog>` with a trigger and forwards `open-change`. */
export function NativeDialog(props: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}): HTMLElement {
  return host(
    <zw-dialog
      open={props.open}
      onopen-change={(event: CustomEvent<{ open: boolean }>) =>
        props.onOpenChange?.(event.detail.open)
      }
    >
      <zw-dialog-trigger>
        <button type="button">open</button>
      </zw-dialog-trigger>
      <zw-dialog-content>body</zw-dialog-content>
    </zw-dialog>,
  )
}

/** Renders a `<zw-form-field>` wrapping a `<zw-input>`. */
export function NativeFormField(props: {
  invalid?: boolean
  required?: boolean
}): HTMLElement {
  return host(
    <zw-form-field invalid={props.invalid} required={props.required}>
      <zw-form-field-label>Name</zw-form-field-label>
      <zw-form-field-description>Help</zw-form-field-description>
      <zw-form-field-control>
        <zw-input name="name" />
      </zw-form-field-control>
      <zw-form-field-message>Enter a name</zw-form-field-message>
    </zw-form-field>,
  )
}

/** Renders a `<zw-popover>` with trigger and content. */
export function NativePopover(props: {
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}): HTMLElement {
  return host(
    <zw-popover
      default-open={props.defaultOpen}
      onopen-change={(event: CustomEvent<{ open: boolean }>) =>
        props.onOpenChange?.(event.detail.open)
      }
    >
      <zw-popover-trigger>
        <button type="button">open</button>
      </zw-popover-trigger>
      <zw-popover-content>content</zw-popover-content>
    </zw-popover>,
  )
}

/** Renders a `<zw-data-grid>` with the shared contract columns and rows. */
export function NativeDataGrid(props: {
  columns: DataGridColumn[]
  rows: DataGridRowData[]
  selectionMode?: 'none' | 'single' | 'multiple'
  onSelectionChange?: (keys: string[]) => void
  onRowAction?: (action: string) => void
}): HTMLElement {
  return host(
    <zw-data-grid
      prop:columns={props.columns}
      prop:rows={props.rows}
      prop:selectionMode={props.selectionMode}
      onselection-change={(event: CustomEvent<DataGridSelectionChangeDetail>) =>
        props.onSelectionChange?.(event.detail.selection.keys)
      }
      onrow-action={(event: CustomEvent<{ action: string }>) =>
        props.onRowAction?.(event.detail.action)
      }
    />,
  )
}
