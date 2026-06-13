import type { Context } from '@zeus-js/runtime-dom'
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { provideDOMContext, resolveDOMContext } from '@zeus-js/runtime-dom'
import {
  createContext,
  defineElement,
  event,
  Host,
  prop,
  Slot,
} from '@zeus-js/zeus'

export type RadioGroupOrientation = 'horizontal' | 'vertical'
export type RadioGroupSize = 'sm' | 'md' | 'lg'

export interface RadioGroupProps {
  ariaLabel?: string
  ariaDescribedby?: string
  value?: string
  defaultValue?: string
  name?: string
  orientation?: RadioGroupOrientation
  size?: RadioGroupSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
}

export interface RadioGroupValueChangeDetail {
  value: string
  nativeEvent: Event
}

export interface RadioGroupElement extends HTMLElement {
  value?: string
}

interface RadioGroupEmits extends Record<string, EventDefinition<unknown>> {
  valueChange: EventDefinition<RadioGroupValueChangeDetail>
}

interface RadioGroupContextValue {
  getName: () => string
  getValue: () => string | undefined
  setValue: (value: string, nativeEvent?: Event) => void
  isDisabled: () => boolean
  isRequired: () => boolean
  isInvalid: () => boolean
  getSize: () => RadioGroupSize
}

const RadioGroupContext =
  createContext<RadioGroupContextValue>() as Context<RadioGroupContextValue>

let radioGroupId = 0

function createRadioName(): string {
  radioGroupId += 1
  return `zw-radio-group-${radioGroupId}`
}

function resolveValue(props: RadioGroupProps): string | undefined {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return undefined
}

function setupRadioGroup(
  props: RadioGroupProps,
  ctx: DefineElementContext<RadioGroupElement, RadioGroupEmits>,
) {
  const fallbackName = createRadioName()

  const context: RadioGroupContextValue = {
    getName: () => props.name || fallbackName,
    getValue: () => resolveValue(props),
    setValue: (value, nativeEvent) => {
      ctx.host.value = value
      ctx.emit.valueChange({
        value,
        nativeEvent: nativeEvent ?? new Event('change'),
      })
    },
    isDisabled: () => Boolean(props.disabled),
    isRequired: () => Boolean(props.required),
    isInvalid: () => Boolean(props.invalid),
    getSize: () => props.size || 'md',
  }

  /**
   * Web Component children are independent custom elements.
   *
   * Owner-tree provide/inject does not cross from <zw-radio-group> into
   * <zw-radio-group-item>. Use the DOM bridge instead.
   */
  provideDOMContext(ctx.host, RadioGroupContext, context)

  return (
    <Host
      data-slot="radio-group-root"
      role="radiogroup"
      data-orientation={() => props.orientation || 'vertical'}
      data-size={() => context.getSize()}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
      aria-label={() => props.ariaLabel}
      aria-describedby={() => props.ariaDescribedby}
      aria-required={() => (props.required ? 'true' : undefined)}
      aria-invalid={() => (props.invalid ? 'true' : undefined)}
    >
      <Slot />
    </Host>
  )
}

export const RadioGroup = defineElement<
  RadioGroupProps,
  RadioGroupElement,
  RadioGroupEmits
>(
  'zw-radio-group',
  {
    shadow: false,
    props: {
      value: {
        type: String,
        reflect: true,
      },
      defaultValue: {
        type: String,
        attr: 'default-value',
      },
      name: String,
      orientation: prop(['horizontal', 'vertical'], {
        default: 'vertical',
        reflect: true,
      }),
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      disabled: prop(Boolean),
      required: prop(Boolean),
      invalid: prop(Boolean),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
      ariaDescribedby: prop(String, {
        attr: 'aria-describedby',
      }),
    },
    emits: {
      valueChange: event<{ value: string; nativeEvent: Event }>(),
    },
    meta: {
      description: 'Headless radio group primitive.',
    },
  },
  setupRadioGroup,
)

export interface RadioGroupItemProps {
  value?: string
  disabled?: boolean
}

export interface RadioGroupItemElement extends HTMLElement {
  checked?: boolean
  focus: () => void
  blur: () => void
}

export interface RadioGroupItemFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

interface RadioGroupItemEmits extends Record<string, EventDefinition<unknown>> {
  focusChange: EventDefinition<RadioGroupItemFocusChangeDetail>
}

function createFallbackRadioGroupContext(
  _props: RadioGroupItemProps,
): RadioGroupContextValue {
  const fallbackName = createRadioName()
  let value: string | undefined

  return {
    getName: () => fallbackName,
    getValue: () => value,
    setValue: nextValue => {
      value = nextValue
    },
    isDisabled: () => false,
    isRequired: () => false,
    isInvalid: () => false,
    getSize: () => 'md',
  }
}

function setupRadioGroupItem(
  props: RadioGroupItemProps,
  ctx: DefineElementContext<RadioGroupItemElement, RadioGroupItemEmits>,
) {
  const result = resolveDOMContext(ctx.host, RadioGroupContext)

  const group = result.found
    ? result.value!
    : createFallbackRadioGroupContext(props)

  let control!: HTMLInputElement

  const isChecked = () =>
    Boolean(props.value && group.getValue() === props.value)

  const isDisabled = () => Boolean(props.disabled || group.isDisabled())

  ctx.expose({
    focus(): void {
      control.focus()
    },
    blur(): void {
      control.blur()
    },
  })

  return (
    <Host
      data-slot="radio-group-item"
      data-value={() => props.value}
      data-state={() => (isChecked() ? 'checked' : 'unchecked')}
      data-disabled={() => (isDisabled() ? '' : undefined)}
    >
      <label part="root">
        <input
          ref={(element: HTMLInputElement | null) => {
            if (element) control = element
          }}
          part="control"
          data-slot="radio-group-control"
          prop:type={() => 'radio'}
          prop:checked={() => isChecked()}
          name={() => group.getName()}
          value={() => props.value}
          disabled={() => isDisabled()}
          required={() => Boolean(group.isRequired())}
          aria-checked={() => String(isChecked())}
          aria-invalid={() => (group.isInvalid() ? 'true' : undefined)}
          onChange={nativeEvent => {
            if (props.value && !isDisabled()) {
              group.setValue(props.value, nativeEvent)
            }
          }}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        />

        <span part="indicator" data-slot="radio-group-indicator">
          <Slot name="indicator" />
        </span>

        <span part="label" data-slot="radio-group-label">
          <Slot />
        </span>
      </label>
    </Host>
  )
}

export const RadioGroupItem = defineElement<
  RadioGroupItemProps,
  RadioGroupItemElement,
  RadioGroupItemEmits
>(
  'zw-radio-group-item',
  {
    shadow: false,
    props: {
      value: String,
      disabled: prop(Boolean),
    },
    emits: {
      focusChange: event<{
        focused: boolean
        nativeEvent: FocusEvent
      }>(),
    },
    meta: {
      description: 'Headless radio group item primitive.',
    },
  },
  setupRadioGroupItem,
)
