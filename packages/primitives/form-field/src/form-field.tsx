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

function setupControl(
  _props: object,
  ctx: DefineElementContext<FormFieldControlElement>,
) {
  const field = useFormFieldContext(ctx.host)
  const controls = () =>
    Array.from(
      ctx.host.querySelectorAll<HTMLElement>(
        'input, textarea, select, [role="combobox"]',
      ),
    )

  const syncControls = () => {
    const value = field()
    for (const [index, control] of controls().entries()) {
      if (value) {
        if (control.id) {
          if (index === 0) value.setControlId(control.id)
        } else {
          const controlId =
            index === 0
              ? value.getControlId()
              : `${value.getControlId()}-${index + 1}`
          control.id = controlId
          if (index === 0) value.setControlId(controlId)
        }
        control.setAttribute('aria-invalid', String(value.isInvalid()))
        control.setAttribute('aria-required', String(value.isRequired()))
        if (value.isDisabled()) control.setAttribute('disabled', '')
        else control.removeAttribute('disabled')
        const managedIds = [value.getDescriptionId(), value.getMessageId()]
        const current = (control.getAttribute('aria-describedby') || '')
          .split(/\s+/)
          .filter(id => Boolean(id) && !managedIds.includes(id))
        const describedBy = [
          ...current,
          value.getDescriptionId(),
          ...(value.isInvalid() ? [value.getMessageId()] : []),
        ]
        const describedByValue = Array.from(new Set(describedBy)).join(' ')
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
          observer?.disconnect()
          observer = undefined
          return
        }
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
