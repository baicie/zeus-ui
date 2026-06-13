/* eslint-disable no-restricted-globals */
import '@zeus-web/ui'
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'

const buttonVariants = [
  'default',
  'primary',
  'secondary',
  'outline',
  'ghost',
  'danger',
]

const buttonSizes = ['sm', 'md', 'lg', 'icon']

function createSection(params: {
  title: string
  description: string
}): HTMLElement {
  const section = document.createElement('section')
  section.className = 'showcase-section'

  const heading = document.createElement('div')
  heading.className = 'showcase-section-header'

  const title = document.createElement('h2')
  title.textContent = params.title

  const description = document.createElement('p')
  description.textContent = params.description

  heading.append(title, description)
  section.append(heading)

  return section
}

function createCodeBlock(code: string): HTMLElement {
  const pre = document.createElement('pre')
  pre.className = 'showcase-code'

  const element = document.createElement('code')
  element.textContent = code

  pre.append(element)

  return pre
}

function createNativeButton(params: {
  variant?: string
  size?: string
  disabled?: boolean
  text: string
}): HTMLElement {
  const button = document.createElement('zw-button')

  if (params.variant) button.setAttribute('variant', params.variant)
  if (params.size) button.setAttribute('size', params.size)
  if (params.disabled) button.setAttribute('disabled', '')

  button.textContent = params.text

  return button
}

function createNativeInput(params: {
  placeholder?: string
  value?: string
  disabled?: boolean
  invalid?: boolean
}): HTMLElement {
  const input = document.createElement('zw-input')

  if (params.placeholder) input.setAttribute('placeholder', params.placeholder)
  if (params.value) input.setAttribute('value', params.value)
  if (params.disabled) input.setAttribute('disabled', '')
  if (params.invalid) input.setAttribute('invalid', '')

  return input
}

function renderButtonSection(root: HTMLElement): void {
  const section = createSection({
    title: 'Button',
    description:
      'Styled native Web Component buttons from @zeus-web/ui/button.',
  })

  const grid = document.createElement('div')
  grid.className = 'showcase-grid'

  for (const variant of buttonVariants) {
    grid.append(
      createNativeButton({
        variant,
        text: variant,
      }),
    )
  }

  const sizes = document.createElement('div')
  sizes.className = 'showcase-row'

  for (const size of buttonSizes) {
    sizes.append(
      createNativeButton({
        variant: 'primary',
        size,
        text: size === 'icon' ? '+' : size,
      }),
    )
  }

  section.append(
    createCodeBlock(
      'import \'@zeus-web/ui/button\'\n\n<zw-button variant="primary">Save</zw-button>',
    ),
    grid,
    sizes,
    createNativeButton({
      variant: 'primary',
      disabled: true,
      text: 'Disabled',
    }),
  )

  root.append(section)
}

function renderInputSection(root: HTMLElement): void {
  const section = createSection({
    title: 'Input',
    description: 'Styled native Web Component inputs from @zeus-web/ui/input.',
  })

  const stack = document.createElement('div')
  stack.className = 'showcase-stack'

  stack.append(
    createNativeInput({
      placeholder: 'Email address',
    }),
    createNativeInput({
      placeholder: 'Readonly value',
      value: 'Readonly',
    }),
    createNativeInput({
      placeholder: 'Invalid email',
      invalid: true,
    }),
    createNativeInput({
      placeholder: 'Disabled input',
      disabled: true,
    }),
  )

  section.append(
    createCodeBlock(
      'import \'@zeus-web/ui/input\'\n\n<zw-input placeholder="Email address"></zw-input>',
    ),
    stack,
  )

  root.append(section)
}

function renderUsageSection(root: HTMLElement): void {
  const section = createSection({
    title: 'Native usage',
    description:
      'Use @zeus-web/ui when you want styled Web Components without React or Vue wrappers.',
  })

  const list = document.createElement('ul')
  list.className = 'showcase-list'

  for (const text of [
    'No React runtime.',
    'No Vue runtime.',
    'Uses native custom elements.',
    'Consumes @zeus-web/ui aggregate entry.',
    'Useful for static pages, micro-frontends and framework-neutral demos.',
  ]) {
    const item = document.createElement('li')
    item.textContent = text
    list.append(item)
  }

  section.append(
    createCodeBlock(
      'import \'@zeus-web/ui\'\n\n<zw-button variant="primary">Save</zw-button>\n<zw-input placeholder="Email" />',
    ),
    list,
  )

  root.append(section)
}

export function renderNativeShowcase(root: HTMLElement): void {
  root.innerHTML = ''

  const app = document.createElement('main')
  app.className = 'showcase-shell'

  const header = document.createElement('header')
  header.className = 'showcase-hero'

  const eyebrow = document.createElement('p')
  eyebrow.className = 'showcase-eyebrow'
  eyebrow.textContent = '@zeus-web/ui'

  const title = document.createElement('h1')
  title.textContent = 'Native Web Component Showcase'

  const description = document.createElement('p')
  description.textContent =
    'A framework-free showcase for styled Zeus Web Components.'

  header.append(eyebrow, title, description)
  app.append(header)

  renderUsageSection(app)
  renderButtonSection(app)
  renderInputSection(app)

  root.append(app)
}
