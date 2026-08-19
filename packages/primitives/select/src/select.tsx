import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import {
  createEffect,
  defineElement,
  event,
  Host,
  prop,
  Slot,
} from '@zeus-js/zeus'

export type SelectSize = 'sm' | 'md' | 'lg'

export interface SelectProps {
  id?: string
  value?: string
  defaultValue?: string
  values?: string[]
  defaultValues?: string[]
  placeholder?: string
  size?: SelectSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  multiple?: boolean
  name?: string
  ariaLabel?: string
  ariaLabelledby?: string
  ariaDescribedby?: string
  ariaErrormessage?: string
}

export interface SelectValueChangeDetail {
  value: string
  values: string[]
  nativeEvent: Event
}

export interface SelectFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface SelectElement extends HTMLElement {
  value?: string
  values?: string[]
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  multiple?: boolean
  focus: () => void
  blur: () => void
}

interface SelectEmits extends Record<string, EventDefinition<unknown>> {
  valueChange: EventDefinition<SelectValueChangeDetail>
  focusChange: EventDefinition<SelectFocusChangeDetail>
}

interface SelectOptionRecord {
  id: string
  value: string
  label: string
  disabled: boolean
  selected: boolean
  source: HTMLOptionElement
  element: HTMLDivElement
}

interface SelectFormController {
  setFormDisabled: (disabled: boolean) => void
  setValues: (values: string[]) => void
}

const TYPEAHEAD_RESET_MS = 500
const SELECT_BOOLEAN_ATTRIBUTES = [
  'disabled',
  'required',
  'invalid',
  'multiple',
] as const

let selectId = 0
const selectFormControllers = new WeakMap<SelectElement, SelectFormController>()
const selectFormDisabledStates = new WeakMap<SelectElement, boolean>()

function createSelectId(): string {
  selectId += 1
  return `zw-select-${selectId}`
}

function deserializeBooleanAttribute(value: string | null): boolean {
  return value !== null
}

function resolveValue(props: SelectProps): string {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return ''
}

function resolveMultipleValues(props: SelectProps): string[] | undefined {
  if (props.values !== undefined) return props.values
  if (props.value !== undefined) return [props.value]
  if (props.defaultValues !== undefined) return props.defaultValues
  if (props.defaultValue !== undefined) return [props.defaultValue]
  return undefined
}

function getDefaultOptionValues(
  host: HTMLElement,
  multiple: boolean,
): string[] {
  const control = host.querySelector<HTMLSelectElement>(
    '[data-slot="select-native"]',
  )
  if (!control) return []

  const sourceOptions = Array.from(control.options)
  const selected = sourceOptions.filter(option => option.defaultSelected)

  if (multiple) return selected.map(option => option.value)

  const fallback = selected[0] || sourceOptions[0]
  return fallback ? [fallback.value] : []
}

function getResetValues(props: SelectProps, host: HTMLElement): string[] {
  if (props.multiple) {
    if (props.defaultValues !== undefined) return props.defaultValues.slice()
    if (props.defaultValue !== undefined) return [props.defaultValue]
    return getDefaultOptionValues(host, true)
  }

  if (props.defaultValue !== undefined) return [props.defaultValue]
  return getDefaultOptionValues(host, false)
}

function getRestoredValues(
  state: string | File | FormData | null,
  name: string | undefined,
): string[] {
  if (state instanceof FormData) {
    const values = name ? state.getAll(name) : Array.from(state.values())
    return values.filter((value): value is string => typeof value === 'string')
  }

  return typeof state === 'string' ? [state] : []
}

function setHostValues(
  host: SelectElement,
  values: string[],
  multiple: boolean,
): void {
  if (multiple) host.values = values.slice()
  host.value = values[0] || ''
}

function getSelectedValues(control: HTMLSelectElement): string[] {
  return Array.from(control.selectedOptions).map(option => option.value)
}

function normalizeTypeaheadText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .trim()
    .toLocaleLowerCase()
}

function isPrintableKey(event: KeyboardEvent): boolean {
  return (
    event.key !== ' ' &&
    event.key.length === 1 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  )
}

function setup(
  props: SelectProps,
  ctx: DefineElementContext<SelectElement, SelectEmits>,
) {
  const baseId = createSelectId()
  const triggerId = `${baseId}-trigger`
  const listboxId = `${baseId}-listbox`
  const resolveTriggerId = () => (props.id ? `${props.id}-trigger` : triggerId)
  const resolveListboxLabelledby = () =>
    props.ariaLabelledby || (props.ariaLabel ? undefined : resolveTriggerId())

  let control!: HTMLSelectElement
  let trigger!: HTMLButtonElement
  let valueElement!: HTMLSpanElement
  let listbox!: HTMLDivElement
  let observer: MutationObserver | undefined
  let options: SelectOptionRecord[] = []
  let activeIndex = -1
  let open = false
  let syncQueued = false
  let typeahead = ''
  let typeaheadTime = 0
  let formDisabled = selectFormDisabledStates.get(ctx.host) || false

  const isDisabled = () => Boolean(props.disabled || formDisabled)

  const getEnabledIndexes = () => {
    const indexes: number[] = []
    for (let index = 0; index < options.length; index += 1) {
      if (!options[index].disabled) indexes.push(index)
    }
    return indexes
  }

  const findSelectedIndex = () => {
    const selectedIndex = options.findIndex(option => option.selected)
    if (selectedIndex >= 0 && !options[selectedIndex].disabled) {
      return selectedIndex
    }

    const enabled = getEnabledIndexes()
    return enabled.length > 0 ? enabled[0] : -1
  }

  const syncFormState = () => {
    const internals = ctx.internals
    if (!internals || typeof internals.setFormValue !== 'function') return

    const successfulValues = options
      .filter(option => option.selected && !option.disabled)
      .map(option => option.value)

    if (isDisabled() || successfulValues.length === 0) {
      internals.setFormValue(null)
    } else if (props.multiple && props.name) {
      const formData = new FormData()
      for (const value of successfulValues) {
        formData.append(props.name, value)
      }
      internals.setFormValue(formData)
    } else {
      internals.setFormValue(successfulValues[0])
    }

    if (typeof internals.setValidity !== 'function') return

    const hasRequiredValue = successfulValues.some(value => value !== '')

    if (props.required && !hasRequiredValue) {
      internals.setValidity(
        { valueMissing: true },
        'Please select an option.',
        trigger,
      )
    } else if (props.invalid) {
      internals.setValidity(
        { customError: true },
        'The selected value is invalid.',
        trigger,
      )
    } else {
      internals.setValidity({})
    }
  }

  const updateActiveDescendant = () => {
    if (!trigger) return

    const active = open ? options[activeIndex] : undefined
    if (active) {
      trigger.setAttribute('aria-activedescendant', active.id)
    } else {
      trigger.removeAttribute('aria-activedescendant')
    }

    for (let index = 0; index < options.length; index += 1) {
      const option = options[index]
      if (index === activeIndex && open) {
        option.element.setAttribute('data-active', '')
      } else {
        option.element.removeAttribute('data-active')
      }
    }
  }

  const updatePopupPosition = () => {
    if (!trigger || !listbox) return

    const viewportHeight = globalThis.innerHeight
    const triggerRect = trigger.getBoundingClientRect()
    const viewportGutter = 8
    const spaceBelow = Math.max(
      0,
      viewportHeight - triggerRect.bottom - viewportGutter,
    )
    const spaceAbove = Math.max(0, triggerRect.top - viewportGutter)
    const preferredHeight = Math.min(256, listbox.scrollHeight)
    const side =
      spaceBelow < preferredHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'
    const availableHeight = side === 'top' ? spaceAbove : spaceBelow

    ctx.host.setAttribute('data-side', side)
    listbox.style.setProperty(
      '--zw-select-available-height',
      `${Math.max(80, availableHeight)}px`,
    )
  }

  const setActiveIndex = (index: number, scroll = true) => {
    if (index < 0 || index >= options.length || options[index].disabled) {
      activeIndex = -1
      updateActiveDescendant()
      return
    }

    activeIndex = index
    updateActiveDescendant()

    const active = options[activeIndex]
    if (scroll && typeof active.element.scrollIntoView === 'function') {
      active.element.scrollIntoView({ block: 'nearest' })
    }
  }

  const syncOpenState = () => {
    ctx.host.setAttribute('data-state', open ? 'open' : 'closed')
    trigger.setAttribute('aria-expanded', String(open))
    listbox.hidden = !open
    updateActiveDescendant()
    if (open) updatePopupPosition()
  }

  const setOpen = (nextOpen: boolean) => {
    if (isDisabled()) return
    if (open === nextOpen) return

    open = nextOpen
    if (open) activeIndex = findSelectedIndex()
    syncOpenState()
  }

  const updateSelectedPresentation = () => {
    const selected = options.filter(option => option.selected)
    const labels = selected.map(option => option.label)
    const values = selected.map(option => option.value)
    const placeholder = props.placeholder || 'Select an option'

    valueElement.textContent =
      labels.length > 0 ? labels.join(', ') : placeholder
    valueElement.toggleAttribute('data-placeholder', labels.length === 0)
    ctx.host.toggleAttribute('data-placeholder', labels.length === 0)
    ctx.host.setAttribute('data-value', values[0] || '')

    for (const option of options) {
      option.element.setAttribute('aria-selected', String(option.selected))
      option.element.setAttribute(
        'data-state',
        option.selected ? 'checked' : 'unchecked',
      )
    }

    syncFormState()
  }

  const createOptionElement = (
    source: HTMLOptionElement,
    index: number,
  ): SelectOptionRecord => {
    const element = globalThis.document.createElement('div')
    const indicator = globalThis.document.createElement('span')
    const label = globalThis.document.createElement('span')
    const id = `${baseId}-option-${index}`
    const optionLabel = source.label || source.textContent || source.value

    element.id = id
    element.setAttribute('part', 'option')
    element.setAttribute('role', 'option')
    element.setAttribute('data-slot', 'select-option')
    element.setAttribute('data-value', source.value)
    element.setAttribute('aria-disabled', String(source.disabled))
    element.toggleAttribute('data-disabled', source.disabled)

    indicator.setAttribute('part', 'option-indicator')
    indicator.setAttribute('data-slot', 'select-option-indicator')
    indicator.setAttribute('aria-hidden', 'true')

    label.setAttribute('part', 'option-label')
    label.setAttribute('data-slot', 'select-option-label')
    label.textContent = optionLabel

    element.append(indicator, label)
    element.addEventListener('pointerdown', nativeEvent => {
      nativeEvent.preventDefault()
    })
    element.addEventListener('mousemove', () => {
      if (!source.disabled) setActiveIndex(index, false)
    })
    element.addEventListener('click', nativeEvent => {
      if (source.disabled) return
      commitIndex(index, nativeEvent)
    })

    return {
      id,
      value: source.value,
      label: optionLabel,
      disabled: source.disabled,
      selected: source.selected,
      source,
      element,
    }
  }

  const syncOptions = () => {
    if (!control || !trigger || !valueElement || !listbox) return

    if (props.multiple) {
      const declaredValues = resolveMultipleValues(props)

      if (declaredValues !== undefined) {
        const selectedValues = new Set(declaredValues)
        for (const option of Array.from(control.options)) {
          const selected = selectedValues.has(option.value)
          if (option.selected !== selected) option.selected = selected
        }
      }
    } else {
      if (props.values !== undefined) ctx.host.values = undefined

      const declaredValue = resolveValue(props)
      const hasDeclaredValue =
        props.value !== undefined || props.defaultValue !== undefined

      if (hasDeclaredValue && declaredValue !== control.value) {
        control.value = declaredValue
      }
    }

    const sourceOptions = Array.from(control.options)
    options = sourceOptions.map(createOptionElement)
    listbox.replaceChildren(...options.map(option => option.element))

    const selectedValues = getSelectedValues(control)

    if (props.multiple) {
      if (props.values === undefined) ctx.host.values = selectedValues.slice()
      if (props.value === undefined) ctx.host.value = selectedValues[0] || ''
    } else if (props.value === undefined) {
      ctx.host.value = control.value
    }

    activeIndex = findSelectedIndex()
    const disabled = isDisabled()
    ctx.host.toggleAttribute('data-disabled', disabled)
    trigger.disabled = disabled
    updateSelectedPresentation()
    syncOpenState()

    if (disabled && open) {
      open = false
      syncOpenState()
    }
  }

  const queueSync = () => {
    if (syncQueued) return
    syncQueued = true

    Promise.resolve().then(() => {
      syncQueued = false
      syncOptions()
    })
  }

  const syncBooleanAttributeProps = () => {
    for (const name of SELECT_BOOLEAN_ATTRIBUTES) {
      ctx.host[name] = ctx.host.hasAttribute(name)
    }
  }

  const emitValueChange = (nativeEvent: Event) => {
    const values = getSelectedValues(control)
    const value = values[0] || ''

    ctx.host.value = value
    if (props.multiple) ctx.host.values = values.slice()
    ctx.emit.valueChange({ value, values, nativeEvent })
  }

  function commitIndex(index: number, nativeEvent: Event): void {
    const option = options[index]
    if (!option || option.disabled) return

    const previousValues = getSelectedValues(control)

    if (props.multiple) {
      option.source.selected = !option.source.selected
    } else {
      control.value = option.value
    }

    options = options.map(record => {
      record.selected = record.source.selected
      return record
    })

    const nextValues = getSelectedValues(control)
    const changed = previousValues.join('\u0000') !== nextValues.join('\u0000')

    activeIndex = index
    updateSelectedPresentation()

    if (!props.multiple) setOpen(false)
    if (changed) emitValueChange(nativeEvent)
  }

  const moveActive = (direction: -1 | 1) => {
    const enabled = getEnabledIndexes()
    if (enabled.length === 0) return

    const position = enabled.indexOf(activeIndex)
    const nextPosition = Math.min(
      enabled.length - 1,
      Math.max(0, position < 0 ? 0 : position + direction),
    )

    setActiveIndex(enabled[nextPosition])
  }

  const moveToEdge = (edge: 'first' | 'last') => {
    const enabled = getEnabledIndexes()
    if (enabled.length === 0) return

    setActiveIndex(edge === 'first' ? enabled[0] : enabled[enabled.length - 1])
  }

  const handleTypeahead = (nativeEvent: KeyboardEvent) => {
    const now = Date.now()
    const key = normalizeTypeaheadText(nativeEvent.key)

    typeahead = now - typeaheadTime > TYPEAHEAD_RESET_MS ? key : typeahead + key
    typeaheadTime = now

    const repeated = typeahead
      .split('')
      .every(character => character === typeahead[0])
    const query = repeated ? key : typeahead
    const start = Math.max(0, activeIndex + 1)

    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (start + offset) % options.length
      const option = options[index]
      if (option.disabled) continue

      if (normalizeTypeaheadText(option.label).startsWith(query)) {
        if (!open) setOpen(true)
        setActiveIndex(index)
        return
      }
    }
  }

  const handleKeyDown = (nativeEvent: KeyboardEvent) => {
    if (isDisabled()) return

    if (isPrintableKey(nativeEvent)) {
      nativeEvent.preventDefault()
      handleTypeahead(nativeEvent)
      return
    }

    if (nativeEvent.key === 'Escape' && open) {
      nativeEvent.preventDefault()
      setOpen(false)
      return
    }

    if (nativeEvent.key === 'Tab' && open) {
      if (!props.multiple && activeIndex >= 0) {
        commitIndex(activeIndex, nativeEvent)
      }
      setOpen(false)
      return
    }

    if (nativeEvent.key === 'Enter' || nativeEvent.key === ' ') {
      nativeEvent.preventDefault()
      if (open && activeIndex >= 0) {
        commitIndex(activeIndex, nativeEvent)
      } else {
        setOpen(true)
      }
      return
    }

    if (nativeEvent.key === 'Home' || nativeEvent.key === 'End') {
      nativeEvent.preventDefault()
      if (!open) setOpen(true)
      moveToEdge(nativeEvent.key === 'Home' ? 'first' : 'last')
      return
    }

    if (nativeEvent.key === 'ArrowDown' || nativeEvent.key === 'ArrowUp') {
      nativeEvent.preventDefault()

      if (!open) {
        const hasSelectedOption = options.some(
          option => option.selected && !option.disabled,
        )
        setOpen(true)
        if (!hasSelectedOption) {
          moveToEdge(nativeEvent.key === 'ArrowDown' ? 'first' : 'last')
        }
        return
      }

      moveActive(nativeEvent.key === 'ArrowDown' ? 1 : -1)
    }
  }

  const handleNativeChange = (nativeEvent: Event) => {
    options = options.map(record => {
      record.selected = record.source.selected
      return record
    })
    activeIndex = findSelectedIndex()
    updateSelectedPresentation()
    emitValueChange(nativeEvent)
  }

  const readReactiveProps = () => [
    props.value,
    props.defaultValue,
    props.values,
    props.defaultValues,
    props.disabled,
    props.required,
    props.invalid,
    props.multiple,
    props.name,
  ]

  selectFormControllers.set(ctx.host, {
    setFormDisabled(disabled): void {
      formDisabled = disabled
      queueSync()
    },
    setValues(values): void {
      setHostValues(ctx.host, values, Boolean(props.multiple))
      syncOptions()
    },
  })

  createEffect(() => {
    readReactiveProps()
    queueSync()
  })

  ctx.expose({
    focus(): void {
      trigger.focus()
    },
    blur(): void {
      trigger.blur()
    },
  })

  return (
    <Host
      data-slot="select-root"
      data-size={() => props.size}
      data-disabled={() => (isDisabled() ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
      data-value={() => {
        queueSync()
        return resolveValue(props)
      }}
    >
      <div part="root" data-slot="select-control">
        <select
          ref={(element: HTMLSelectElement | null) => {
            if (!element) {
              if (observer) observer.disconnect()
              observer = undefined
              return
            }
            control = element

            if (observer) observer.disconnect()
            observer = new globalThis.MutationObserver(records => {
              let selectionChanged = false

              for (const record of records) {
                if (
                  record.type !== 'attributes' ||
                  record.attributeName !== 'selected'
                ) {
                  continue
                }

                const option = record.target as HTMLOptionElement
                if (option.tagName !== 'OPTION') continue

                option.selected = option.hasAttribute('selected')
                selectionChanged = true
              }

              if (selectionChanged) {
                const selectedValues = getSelectedValues(control)
                setHostValues(ctx.host, selectedValues, Boolean(props.multiple))
              }

              if (records.some(record => record.target === ctx.host)) {
                syncBooleanAttributeProps()
              }
              queueSync()
            })
            observer.observe(control, {
              attributes: true,
              childList: true,
              characterData: true,
              subtree: true,
            })
            observer.observe(ctx.host, {
              attributes: true,
              attributeFilter: SELECT_BOOLEAN_ATTRIBUTES.slice(),
            })
            syncBooleanAttributeProps()
            queueSync()
          }}
          part="native"
          data-slot="select-native"
          tabIndex={() => -1}
          aria-hidden={() => 'true'}
          multiple={() => Boolean(props.multiple)}
          onChange={handleNativeChange}
        >
          <Slot />
        </select>

        <button
          ref={(element: HTMLButtonElement | null) => {
            if (element) {
              trigger = element
              queueSync()
            }
          }}
          id={resolveTriggerId}
          part="trigger"
          data-slot="select-trigger"
          prop:type={() => 'button'}
          role="combobox"
          disabled={isDisabled}
          aria-haspopup={() => 'listbox'}
          aria-expanded={() => String(open)}
          aria-controls={() => listboxId}
          aria-label={() => props.ariaLabel}
          aria-labelledby={() => props.ariaLabelledby}
          aria-describedby={() => props.ariaDescribedby}
          aria-errormessage={() => props.ariaErrormessage}
          aria-invalid={() => (props.invalid ? 'true' : undefined)}
          aria-required={() => (props.required ? 'true' : undefined)}
          onClick={() => {
            setOpen(!open)
          }}
          onKeyDown={handleKeyDown}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            setOpen(false)
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        >
          <span
            ref={(element: HTMLSpanElement | null) => {
              if (element) {
                valueElement = element
                queueSync()
              }
            }}
            part="value"
            data-slot="select-value"
          />
          <span
            part="indicator"
            data-slot="select-indicator"
            aria-hidden="true"
          />
        </button>

        <div
          ref={(element: HTMLDivElement | null) => {
            if (element) {
              listbox = element
              queueSync()
            }
          }}
          id={listboxId}
          part="content"
          data-slot="select-content"
          role="listbox"
          aria-label={() => props.ariaLabel}
          aria-labelledby={resolveListboxLabelledby}
          aria-multiselectable={() => (props.multiple ? 'true' : undefined)}
          hidden
        />
      </div>

      <div part="message" data-slot="select-message">
        <Slot name="message" />
      </div>
    </Host>
  )
}

export const Select = defineElement<SelectProps, SelectElement, SelectEmits>(
  'zw-select',
  {
    shadow: false,
    formAssociated: true,
    form: {
      reset(props, context): void {
        const values = getResetValues(props, context.host)
        const controller = selectFormControllers.get(context.host)

        if (controller) {
          controller.setValues(values)
        } else {
          setHostValues(context.host, values, Boolean(props.multiple))
        }
      },
      disabled(disabled, _props, context): void {
        selectFormDisabledStates.set(context.host, disabled)
        const controller = selectFormControllers.get(context.host)
        if (controller) controller.setFormDisabled(disabled)
      },
      stateRestore(state, _mode, _props, context): void {
        const values = getRestoredValues(state, _props.name)
        const controller = selectFormControllers.get(context.host)

        if (controller) {
          controller.setValues(values)
        } else {
          setHostValues(context.host, values, Boolean(_props.multiple))
        }
      },
    },
    props: {
      id: String,
      value: {
        type: String,
        reflect: true,
      },
      defaultValue: {
        type: String,
        attr: 'default-value',
      },
      values: prop<string[]>(Array, {
        attr: false,
      }),
      defaultValues: prop<string[]>(Array, {
        attr: false,
      }),
      placeholder: String,
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      disabled: prop(Boolean, {
        deserialize: deserializeBooleanAttribute,
        reflect: true,
      }),
      required: prop(Boolean, {
        deserialize: deserializeBooleanAttribute,
      }),
      invalid: prop(Boolean, {
        deserialize: deserializeBooleanAttribute,
      }),
      multiple: prop(Boolean, {
        deserialize: deserializeBooleanAttribute,
      }),
      name: String,
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
      ariaLabelledby: prop(String, {
        attr: 'aria-labelledby',
      }),
      ariaDescribedby: prop(String, {
        attr: 'aria-describedby',
      }),
      ariaErrormessage: prop(String, {
        attr: 'aria-errormessage',
      }),
    },
    emits: {
      valueChange: event<{
        value: string
        values: string[]
        nativeEvent: Event
      }>(),
      focusChange: event<{
        focused: boolean
        nativeEvent: FocusEvent
      }>(),
    },
    meta: {
      description: 'Accessible custom select primitive.',
      cssParts: [
        'root',
        'native',
        'trigger',
        'value',
        'indicator',
        'content',
        'option',
        'option-indicator',
        'option-label',
        'message',
      ],
    },
  },
  setup,
)
