import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')
const distPath = resolve(
  workspaceRoot,
  'packages',
  'primitives',
  'form-field',
  'dist',
  'wc',
  'auto.js',
)

interface RuntimeFormField extends HTMLElement {
  invalid?: boolean
  disabled?: boolean
  required?: boolean
  componentOnReady?: () => Promise<RuntimeFormField>
}

function nextRender(): Promise<void> {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => new Promise(resolve => setTimeout(resolve, 0)))
}

async function createField(
  nativeId?: string,
  nativeAttributes = '',
): Promise<RuntimeFormField> {
  await Promise.all(
    [
      'zw-form-field',
      'zw-form-field-label',
      'zw-form-field-control',
      'zw-form-field-description',
      'zw-form-field-message',
    ].map(tagName => customElements.whenDefined(tagName)),
  )
  const field = document.createElement('zw-form-field') as RuntimeFormField
  field.id = 'profile'
  field.innerHTML = [
    '<zw-form-field-label>Name</zw-form-field-label>',
    `<zw-form-field-control><input${nativeId ? ` id="${nativeId}"` : ''} aria-describedby="external"${nativeAttributes} /></zw-form-field-control>`,
    '<zw-form-field-description>Enter your name.</zw-form-field-description>',
    '<zw-form-field-message>Required.</zw-form-field-message>',
  ].join('')
  document.body.append(field)
  await field.componentOnReady?.()
  await Promise.all(
    [...field.querySelectorAll<RuntimeFormField>('*')].map(element =>
      element.componentOnReady?.(),
    ),
  )
  await nextRender()
  return field
}

beforeAll(() => import(distPath))

afterEach(() => {
  document.body.replaceChildren()
})

describe('form field runtime accessibility', () => {
  it('assigns the generated control id to the native control only', async () => {
    const field = await createField()
    const control = field.querySelector('zw-form-field-control')
    const native = field.querySelector('input')

    expect(control).not.toBeNull()
    expect(control).not.toHaveAttribute('id')
    expect(native).toHaveAttribute('id', 'profile-control')
    expect(field.querySelector('label')).toHaveAttribute(
      'for',
      'profile-control',
    )
  })

  it('keeps a preset native id connected to the field label', async () => {
    const field = await createField('email-control')
    const native = field.querySelector('input')

    expect(native).toHaveAttribute('id', 'email-control')
    expect(field.querySelector('label')).toHaveAttribute('for', 'email-control')
  })

  it('syncs invalid, required and disabled state changes', async () => {
    const field = await createField()
    const native = field.querySelector('input')
    if (!native) throw new Error('Expected native input control.')

    field.invalid = true
    field.required = true
    field.disabled = true
    await nextRender()

    expect(native).toHaveAttribute('aria-invalid', 'true')
    expect(native).toHaveAttribute('aria-required', 'true')
    expect(native).toHaveAttribute('disabled')

    field.invalid = false
    field.required = false
    field.disabled = false
    await nextRender()

    expect(native).not.toHaveAttribute('aria-invalid')
    expect(native).not.toHaveAttribute('aria-required')
    expect(native).not.toHaveAttribute('disabled')
  })

  it('removes the managed message id when invalid state is restored', async () => {
    const field = await createField()
    const native = field.querySelector('input')
    if (!native) throw new Error('Expected native input control.')

    field.invalid = true
    await nextRender()
    expect(native.getAttribute('aria-describedby')).toBe(
      'external profile-description profile-message',
    )

    field.invalid = false
    await nextRender()
    expect(native.getAttribute('aria-describedby')).toBe(
      'external profile-description',
    )
  })

  it('preserves caller-owned control state while syncing field state', async () => {
    const field = await createField(
      undefined,
      ' disabled aria-invalid="true" aria-required="true"',
    )
    const native = field.querySelector('input')
    if (!native) throw new Error('Expected native input control.')

    expect(native).toHaveAttribute('disabled')
    expect(native).toHaveAttribute('aria-invalid', 'true')
    expect(native).toHaveAttribute('aria-required', 'true')

    field.invalid = true
    field.required = true
    field.disabled = true
    await nextRender()
    field.invalid = false
    field.required = false
    field.disabled = false
    await nextRender()

    expect(native).toHaveAttribute('disabled')
    expect(native).toHaveAttribute('aria-invalid', 'true')
    expect(native).toHaveAttribute('aria-required', 'true')
  })
})
