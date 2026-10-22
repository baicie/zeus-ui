import type { DefineElementContext } from '@zeus-js/zeus'
import type { FormFieldContextValue } from './form-field-context'
import {
  createEffect,
  createSignal,
  defineElement,
  Host,
  prop,
  Slot,
} from '@zeus-js/zeus'
import { provideDOMContext, resolveDOMContext } from '@zeus-web/zeus-compat'
import { FormFieldContext } from './form-field-context'

export interface FormFieldProps {
  id?: string
  invalid?: boolean
  disabled?: boolean
  required?: boolean
}

export interface FormFieldElement extends HTMLElement {
  invalid?: boolean
}

function useFormFieldContext(host: HTMLElement) {
  const [field, setField] = createSignal<FormFieldContextValue | undefined>(
    undefined,
  )
  const root = host.closest('zw-form-field') as
    | (HTMLElement & { componentOnReady?: () => Promise<unknown> })
    | null

  const resolve = () => {
    const result = resolveDOMContext(host, FormFieldContext)
    if (result.found) setField(result.value)
  }

  if (root?.componentOnReady) void root.componentOnReady().then(resolve)
  else resolve()

  return field
}

let formFieldId = 0

function createId(): string {
  formFieldId += 1
  return `zw-form-field-${formFieldId}`
}

function setupFormField(
  props: FormFieldProps,
  ctx: DefineElementContext<FormFieldElement>,
) {
  const baseId = props.id || createId()
  const [controlId, setControlId] = createSignal(`${baseId}-control`)
  const value: FormFieldContextValue = {
    getControlId: controlId,
    setControlId,
    getDescriptionId: () => `${baseId}-description`,
    getMessageId: () => `${baseId}-message`,
    isInvalid: () => Boolean(props.invalid),
    isDisabled: () => Boolean(props.disabled),
    isRequired: () => Boolean(props.required),
  }
  provideDOMContext(ctx.host, FormFieldContext, value)
  return (
    <Host
      data-slot="form-field-root"
      data-state={value.isInvalid() ? 'invalid' : 'valid'}
      data-disabled={value.isDisabled() ? '' : undefined}
    >
      <Slot />
    </Host>
  )
}

export const FormField = defineElement<FormFieldProps, FormFieldElement>(
  'zw-form-field',
  {
    shadow: false,
    props: {
      id: String,
      invalid: prop(Boolean, { reflect: true }),
      disabled: prop(Boolean),
      required: prop(Boolean),
    },
    meta: { description: 'Accessible form field relationship primitive.' },
  },
  setupFormField,
)

export interface FormFieldControlElement extends HTMLElement {}

type ReleaseControl = () => void
const controlOwners = new WeakMap<HTMLElement, ReleaseControl>()

function setupControl(
  _props: object,
  ctx: DefineElementContext<FormFieldControlElement>,
) {
  const field = useFormFieldContext(ctx.host)
  interface ManagedControlState {
    originalAriaInvalid: string | null
    originalAriaRequired: string | null
    originalDisabled: boolean
    originalRequired: boolean
    lastAriaInvalid: string | null | undefined
    lastAriaRequired: string | null | undefined
    lastDisabled: boolean | undefined
    lastRequired: boolean | undefined
    generatedId?: string
    describedByIds: string[]
  }
  const managedControls = new Map<HTMLElement, ManagedControlState>()
  let disposed = false
  const controls = () =>
    Array.from(
      ctx.host.querySelectorAll<HTMLElement>(
        'input, textarea, select, [role="combobox"]',
      ),
    ).filter(control => control.closest('zw-form-field-control') === ctx.host)

  const syncManagedAttribute = (
    control: HTMLElement,
    state: ManagedControlState,
    name: 'aria-invalid' | 'aria-required',
    enabled: boolean,
    value: 'true',
  ) => {
    const original =
      name === 'aria-invalid'
        ? state.originalAriaInvalid
        : state.originalAriaRequired
    const last =
      name === 'aria-invalid' ? state.lastAriaInvalid : state.lastAriaRequired
    const current = control.getAttribute(name)

    if (enabled) {
      if (last === undefined) {
        if (name === 'aria-invalid') state.originalAriaInvalid = current
        else state.originalAriaRequired = current
      }
      control.setAttribute(name, value)
      if (name === 'aria-invalid') state.lastAriaInvalid = value
      else state.lastAriaRequired = value
      return
    }

    if (last !== undefined && current === last) {
      if (original === null) control.removeAttribute(name)
      else control.setAttribute(name, original)
    }
    if (name === 'aria-invalid') state.lastAriaInvalid = undefined
    else state.lastAriaRequired = undefined
  }

  const syncDisabled = (
    control: HTMLElement,
    state: ManagedControlState,
    disabled: boolean,
  ) => {
    if (disabled) {
      if (state.lastDisabled === undefined)
        state.originalDisabled = control.hasAttribute('disabled')
      control.setAttribute('disabled', '')
      state.lastDisabled = true
      return
    }
    if (
      state.lastDisabled !== undefined &&
      control.hasAttribute('disabled') === state.lastDisabled
    ) {
      if (state.originalDisabled) control.setAttribute('disabled', '')
      else control.removeAttribute('disabled')
    }
    state.lastDisabled = undefined
  }

  const syncRequired = (
    control: HTMLElement,
    state: ManagedControlState,
    required: boolean,
  ) => {
    if (required) {
      if (state.lastRequired === undefined)
        state.originalRequired = control.hasAttribute('required')
      control.setAttribute('required', '')
      state.lastRequired = true
      return
    }
    if (
      state.lastRequired !== undefined &&
      control.hasAttribute('required') === state.lastRequired
    ) {
      if (state.originalRequired) control.setAttribute('required', '')
      else control.removeAttribute('required')
    }
    state.lastRequired = undefined
  }

  const restoreControl = (control: HTMLElement, state: ManagedControlState) => {
    syncManagedAttribute(control, state, 'aria-invalid', false, 'true')
    syncManagedAttribute(control, state, 'aria-required', false, 'true')
    syncDisabled(control, state, false)
    syncRequired(control, state, false)
    if (state.generatedId && control.id === state.generatedId)
      control.removeAttribute('id')
    const describedBy = (control.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(id => Boolean(id) && !state.describedByIds.includes(id))
      .join(' ')
    if (describedBy) control.setAttribute('aria-describedby', describedBy)
    else control.removeAttribute('aria-describedby')
  }

  const releaseControl = (control: HTMLElement, state: ManagedControlState) => {
    if (managedControls.get(control) !== state) return
    restoreControl(control, state)
    managedControls.delete(control)
    controlOwners.delete(control)
  }

  const getManagedState = (control: HTMLElement): ManagedControlState => {
    const existing = managedControls.get(control)
    if (existing) return existing
    controlOwners.get(control)?.()
    const state: ManagedControlState = {
      originalAriaInvalid: control.getAttribute('aria-invalid'),
      originalAriaRequired: control.getAttribute('aria-required'),
      originalDisabled: control.hasAttribute('disabled'),
      originalRequired: control.hasAttribute('required'),
      lastAriaInvalid: undefined,
      lastAriaRequired: undefined,
      lastDisabled: undefined,
      lastRequired: undefined,
      describedByIds: [],
    }
    managedControls.set(control, state)
    controlOwners.set(control, () => releaseControl(control, state))
    return state
  }

  const syncControls = () => {
    if (disposed) return
    const value = field()
    const currentControls = controls()
    const currentSet = new Set(currentControls)
    for (const [control, state] of managedControls) {
      if (!currentSet.has(control)) releaseControl(control, state)
    }
    for (const [index, control] of currentControls.entries()) {
      if (value) {
        const state = getManagedState(control)
        if (control.id) {
          if (index === 0) value.setControlId(control.id)
        } else {
          const controlId =
            index === 0
              ? value.getControlId()
              : `${value.getControlId()}-${index + 1}`
          control.id = controlId
          state.generatedId = controlId
          if (index === 0) value.setControlId(controlId)
        }
        syncManagedAttribute(
          control,
          state,
          'aria-invalid',
          value.isInvalid(),
          'true',
        )
        syncManagedAttribute(
          control,
          state,
          'aria-required',
          value.isRequired(),
          'true',
        )
        syncDisabled(control, state, value.isDisabled())
        syncRequired(control, state, value.isRequired())
        const current = (control.getAttribute('aria-describedby') || '')
          .split(/\s+/)
          .filter(id => Boolean(id) && !state.describedByIds.includes(id))
        const fieldIds = [
          value.getDescriptionId(),
          ...(value.isInvalid() ? [value.getMessageId()] : []),
        ]
        state.describedByIds = fieldIds.filter(id => !current.includes(id))
        const describedByValue = Array.from(
          new Set([...current, ...fieldIds]),
        ).join(' ')
        if (describedByValue)
          control.setAttribute('aria-describedby', describedByValue)
        else control.removeAttribute('aria-describedby')
      }
    }
  }
  createEffect(() => {
    const value = field()
    value?.isInvalid()
    value?.isDisabled()
    value?.isRequired()
    syncControls()
  })
  let observer: MutationObserver | undefined
  return (
    <Host
      ref={(element: HTMLElement | null) => {
        if (!element) {
          disposed = true
          observer?.disconnect()
          observer = undefined
          for (const [control, state] of managedControls)
            releaseControl(control, state)
          return
        }
        disposed = false
        syncControls()
        observer = new MutationObserver(syncControls)
        observer.observe(element, { childList: true, subtree: true })
        queueMicrotask(syncControls)
      }}
      data-slot="form-field-control"
      data-invalid={field()?.isInvalid() ? '' : undefined}
      aria-invalid={field()?.isInvalid() ? 'true' : undefined}
      aria-describedby={
        field()
          ? `${field()!.getDescriptionId()}${field()!.isInvalid() ? ` ${field()!.getMessageId()}` : ''}`
          : undefined
      }
    >
      <Slot />
    </Host>
  )
}

export const FormFieldControl = defineElement<object, FormFieldControlElement>(
  'zw-form-field-control',
  {
    shadow: false,
    meta: {
      description: 'Connects controls to form field labels and descriptions.',
    },
  },
  setupControl,
)

function setupLabel(_props: object, ctx: DefineElementContext<HTMLElement>) {
  const field = useFormFieldContext(ctx.host)
  return (
    <Host data-slot="form-field-label">
      <label part="label" for={field()?.getControlId()}>
        <Slot />
      </label>
    </Host>
  )
}

export const FormFieldLabel = defineElement<object, HTMLElement>(
  'zw-form-field-label',
  {
    shadow: false,
    meta: { description: 'Accessible label for a form field.' },
  },
  setupLabel,
)

function setupDescription(
  _props: object,
  ctx: DefineElementContext<HTMLElement>,
) {
  const field = useFormFieldContext(ctx.host)
  return (
    <Host id={field()?.getDescriptionId()} data-slot="form-field-description">
      <Slot />
    </Host>
  )
}

export const FormFieldDescription = defineElement<object, HTMLElement>(
  'zw-form-field-description',
  {
    shadow: false,
    meta: { description: 'Supplemental description for a form field.' },
  },
  setupDescription,
)

function setupMessage(_props: object, ctx: DefineElementContext<HTMLElement>) {
  const field = useFormFieldContext(ctx.host)
  return (
    <Host
      id={field()?.getMessageId()}
      role="alert"
      data-slot="form-field-message"
      hidden={!field()?.isInvalid()}
    >
      <Slot />
    </Host>
  )
}

export const FormFieldMessage = defineElement<object, HTMLElement>(
  'zw-form-field-message',
  {
    shadow: false,
    meta: {
      description: 'Validation message announced for invalid form fields.',
    },
  },
  setupMessage,
)
