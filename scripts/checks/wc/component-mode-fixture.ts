import { mountFor } from '@zeus-js/runtime-dom'
import { createRoot, createSignal } from '@zeus-js/zeus'

interface ReadyElement extends HTMLElement {
  componentOnReady?: () => Promise<unknown>
}
interface ButtonHost extends ReadyElement {
  variant?: string
  pressed?: boolean
  disabled?: boolean
  loading?: boolean
}
interface InputHost extends ReadyElement {
  value?: string
  defaultValue?: string
  formatter?: (value: string) => string
}
interface DialogHost extends ReadyElement {
  open?: boolean
  defaultOpen?: boolean
  show: () => void | Promise<void>
  close: () => void | Promise<void>
}
interface GridHost extends ReadyElement {
  rows: unknown[]
  columns: unknown[]
  selectedKeys?: unknown[]
  rowHeight?: number
  selectionMode?: string
  setRows: (rows: unknown[]) => void | Promise<void>
  getRows: () => unknown[] | Promise<unknown[]>
}
export interface ModeFixtureResult {
  stages: Array<{ name: string; values: Record<string, unknown> }>
  diagnostics?: Record<string, unknown>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
function tick(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}
function ready(element: ReadyElement): Promise<unknown> {
  return typeof element.componentOnReady === 'function'
    ? element.componentOnReady()
    : Promise.resolve(element)
}
function query<T extends Element>(host: ParentNode, selector: string): T {
  const element = host.querySelector<T>(selector)
  assert(element, `Missing ${selector}`)
  return element
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}
function recordEvent(event: Event): Record<string, unknown> {
  const detail = object((event as CustomEvent<unknown>).detail)
  const nativeEvent = detail.nativeEvent
  assert(
    nativeEvent === undefined || nativeEvent instanceof Event,
    `${event.type} fabricated a native event`,
  )
  if (nativeEvent !== undefined) {
    if (event.type === 'value-change') {
      assert(
        nativeEvent instanceof InputEvent && nativeEvent.type === 'input',
        'value-change lost its source InputEvent',
      )
    } else if (event.type === 'focus-change') {
      assert(
        nativeEvent instanceof FocusEvent &&
          (nativeEvent.type === 'focus' || nativeEvent.type === 'blur'),
        'focus-change lost its source FocusEvent',
      )
    } else {
      assert(
        nativeEvent instanceof MouseEvent && nativeEvent.type === 'click',
        `${event.type} lost its source mouse event`,
      )
    }
  }
  const selection = object(detail.selection)
  const row = object(detail.row)
  return {
    type: event.type,
    detailKeys: Object.keys(detail).sort(),
    open: detail.open,
    value: detail.value,
    focused: detail.focused,
    keys: selection.keys,
    rowKey: row.key,
    nativeEvent:
      nativeEvent instanceof Event
        ? { type: nativeEvent.type, className: nativeEvent.constructor.name }
        : undefined,
  }
}
function click(element: HTMLElement): MouseEvent {
  let source: MouseEvent | undefined
  element.addEventListener(
    'click',
    event => {
      source = event
    },
    { once: true, capture: true },
  )
  element.click()
  assert(
    source instanceof MouseEvent && source.type === 'click',
    'click did not dispatch a source MouseEvent',
  )
  return source
}

/** Identical behavioral program; only the generated registration entry differs. */
export function runComponentModeFixture(
  register: () => Promise<void>,
): Promise<ModeFixtureResult> {
  const stages: ModeFixtureResult['stages'] = []
  const diagnostics: Record<string, unknown> = {}
  const container = document.createElement('section')
  const runtimeFrame = document.createElement('section')
  const spacer = document.createElement('aside')
  const moved = document.createElement('section')
  const probe = document.createElement('section')
  document.body.append(runtimeFrame, moved, probe)
  const button = document.createElement('zw-button') as ButtonHost
  const prefix = document.createElement('span')
  prefix.slot = 'prefix'
  prefix.textContent = 'Prefix'
  button.append(prefix, document.createTextNode('Action'))
  button.setAttribute('variant', 'outline')
  button.variant = 'primary'
  button.pressed = true
  const input = document.createElement('zw-input') as InputHost
  const formatter = (value: string): string => value.trim()
  input.defaultValue = 'seed'
  input.value = 'controlled'
  input.formatter = formatter
  input.setAttribute('required', '')
  const dialog = document.createElement('zw-dialog') as DialogHost
  dialog.defaultOpen = true
  dialog.open = false
  dialog.innerHTML =
    '<zw-dialog-trigger>Open</zw-dialog-trigger><zw-dialog-content><zw-dialog-title>Title</zw-dialog-title><zw-dialog-description>Description</zw-dialog-description><button>Inside</button><zw-dialog-close>Close</zw-dialog-close></zw-dialog-content>'
  const grid = document.createElement('zw-data-grid') as GridHost
  const rows = [
    { id: 'row-1', name: 'One' },
    { id: 'row-2', name: 'Two' },
  ]
  const columns = [{ id: 'name', field: 'name', header: 'Name' }]
  grid.rows = rows
  grid.columns = columns
  grid.selectionMode = 'multiple'
  grid.setAttribute('row-height', '36')
  container.append(button, input, dialog, grid)
  const [order, setOrder] = createSignal([container, spacer])
  const disposeList = createRoot(dispose => {
    const marker = document.createComment('parity-list')
    runtimeFrame.append(marker)
    mountFor(
      runtimeFrame,
      marker,
      order,
      item => item,
      item => item(),
    )
    return dispose
  })
  const hosts = [button, input, dialog, grid]
  // Capture parts before projection or portals move them out of the root.
  // A ready root does not imply that its lazy child chunks have mounted.
  const readinessHosts: ReadyElement[] = hosts.slice()
  readinessHosts.push(
    ...Array.from(dialog.querySelectorAll<ReadyElement>('*')).filter(element =>
      element.localName.includes('-'),
    ),
  )
  const events: Record<string, unknown>[] = []
  const nativeEvents = new Map<Record<string, unknown>, Event | undefined>()
  for (const [host, names] of [
    [button, ['press']],
    [input, ['value-change', 'focus-change']],
    [dialog, ['open-change']],
    [grid, ['selection-change']],
  ] as Array<[HTMLElement, string[]]>) {
    for (const name of names) {
      host.addEventListener(name, event => {
        const record = recordEvent(event)
        nativeEvents.set(
          record,
          object((event as CustomEvent<unknown>).detail).nativeEvent as
            | Event
            | undefined,
        )
        events.push(record)
      })
    }
  }
  const expectSource = (type: string, source: Event): void => {
    const matches = events.filter(event => event.type === type)
    assert(
      matches.length === 1 && nativeEvents.get(matches[0]) === source,
      `${type} did not preserve source event identity`,
    )
  }
  let pressSource: MouseEvent
  let inputSource: InputEvent
  let openSource: MouseEvent
  let selectionSource: MouseEvent
  let control: HTMLButtonElement
  let field: HTMLInputElement
  let trigger: HTMLButtonElement
  let oldRow: HTMLElement
  let valueBeforeDetach = ''
  let triggerExpandedBeforeDetach: string | null
  let rowTextBeforeDetach: string | null
  const save = (name: string, values: Record<string, unknown>): void => {
    stages.push({ name, values })
  }
  return register()
    .then(() => Promise.all(readinessHosts.map(ready)))
    .then(tick)
    .then(() => {
      control = query<HTMLButtonElement>(button, 'button')
      field = query<HTMLInputElement>(input, 'input')
      trigger = query<HTMLButtonElement>(dialog, 'zw-dialog-trigger button')
      oldRow = query<HTMLElement>(
        grid,
        '[data-slot="data-grid-row"][data-row-key="row-1"]',
      )
      assert(
        button.variant === 'primary' &&
          button.getAttribute('variant') === 'primary',
        'pre-upgrade property did not beat the old attribute',
      )
      assert(
        button.hasAttribute('pressed') && !control.disabled,
        'Boolean reflection/default mismatch',
      )
      assert(
        query(button, '[data-slot="button-prefix"]').contains(prefix),
        'named slot node was not projected',
      )
      assert(
        (query(button, 'button').textContent || '').includes('Action'),
        'default slot text was not projected',
      )
      assert(
        field.value === 'controlled' &&
          field.required &&
          input.formatter === formatter,
        'input properties were not preserved through upgrade',
      )
      assert(
        dialog.getAttribute('data-state') === 'closed',
        'explicit false did not beat defaultOpen',
      )
      assert(
        grid.rows === rows && grid.columns === columns && grid.rowHeight === 36,
        'grid object/number props did not survive upgrade',
      )
      assert(
        oldRow.textContent !== null && oldRow.textContent.includes('One'),
        'grid source row did not render',
      )
      save('upgrade', {
        readyComponents: readinessHosts.map(element => element.localName),
        variant: button.variant,
        pressed: button.pressed,
        required: field.required,
        value: field.value,
        dialog: dialog.getAttribute('data-state'),
        rowHeight: grid.rowHeight,
        rowCount: grid.querySelectorAll('[data-slot="data-grid-row"]').length,
        slotIdentity:
          prefix.parentElement === query(button, '[data-slot="button-prefix"]'),
      })
      events.length = 0
      pressSource = click(control)
      button.setAttribute('loading', '')
      return tick()
    })
    .then(() => {
      control.click()
      assert(
        events.filter(event => event.type === 'press').length === 1,
        'disabled/loading press did not match the contract',
      )
      button.removeAttribute('loading')
      button.setAttribute('variant', 'danger')
      button.pressed = false
      input.value = undefined
      input.removeAttribute('required')
      grid.setAttribute('row-height', '42')
      return tick()
    })
    .then(() => {
      assert(
        button.variant === 'danger' &&
          button.getAttribute('data-variant') === 'danger' &&
          !button.hasAttribute('pressed'),
        'attribute/property updates were not reflected',
      )
      assert(
        !field.required && grid.rowHeight === 42,
        'Boolean removal or numeric update failed',
      )
      field.value = '  Ada  '
      inputSource = new InputEvent('input', { bubbles: true })
      field.dispatchEvent(inputSource)
      openSource = click(trigger)
      selectionSource = click(oldRow)
      return tick()
    })
    .then(() => {
      assert(
        field.value === 'Ada',
        'formatter function property was not called',
      )
      assert(
        dialog.getAttribute('data-state') === 'open',
        'dialog trigger context did not open',
      )
      assert(
        oldRow.getAttribute('aria-selected') === 'true',
        'grid row did not select',
      )
      const press = events.filter(event => event.type === 'press')
      const value = events.filter(event => event.type === 'value-change')
      const selection = events.filter(
        event => event.type === 'selection-change',
      )
      assert(
        press.length === 1 &&
          value.length === 1 &&
          value[0].value === 'Ada' &&
          selection.length === 1 &&
          selection[0].rowKey === 'row-1',
        'component event count/detail mismatch',
      )
      expectSource('press', pressSource)
      expectSource('value-change', inputSource)
      expectSource('open-change', openSource)
      expectSource('selection-change', selectionSource)
      save('updates', {
        variant: button.variant,
        pressed: button.hasAttribute('pressed'),
        required: field.required,
        value: field.value,
        rowHeight: grid.rowHeight,
        selected: oldRow.getAttribute('aria-selected'),
        events: events.slice(),
      })
      events.length = 0
      setOrder([spacer, container])
      return tick()
    })
    .then(() => {
      assert(
        query(button, 'button') === control &&
          query(input, 'input') === field &&
          query(dialog, 'zw-dialog-trigger button') === trigger &&
          query(grid, '[data-row-key="row-1"]') === oldRow,
        'keyed runtime move replaced live component controls',
      )
      assert(
        field.value === 'Ada' &&
          oldRow.getAttribute('aria-selected') === 'true' &&
          dialog.getAttribute('data-state') === 'open' &&
          trigger.getAttribute('aria-expanded') === 'true' &&
          button.contains(prefix) &&
          input.formatter === formatter &&
          grid.rows === rows,
        'keyed runtime move lost component state, identity, or projection',
      )
      assert(events.length === 0, 'keyed runtime move emitted user events')
      save('runtime-move', {
        controlsPreserved: true,
        inputValue: field.value,
        selected: oldRow.getAttribute('aria-selected'),
        dialog: dialog.getAttribute('data-state'),
        triggerExpanded: trigger.getAttribute('aria-expanded'),
        variant: button.variant,
        projectedCount: button.querySelectorAll(
          '[data-slot="button-prefix"] span',
        ).length,
      })
      events.length = 0
      return Promise.resolve(dialog.close())
        .then(() => dialog.show())
        .then(tick)
    })
    .then(() => {
      const changes = events.filter(event => event.type === 'open-change')
      assert(
        changes.length === 2 &&
          changes[0].open === false &&
          changes[1].open === true &&
          changes.every(
            event =>
              nativeEvents.get(event) === undefined &&
              event.nativeEvent === undefined,
          ),
        'imperative dialog detail fabricated a native event',
      )
      save('imperative', { events: changes })
      return Promise.resolve(dialog.close()).then(tick)
    })
    .then(() => {
      events.length = 0
      moved.append(container)
      return Promise.all(readinessHosts.map(ready)).then(tick)
    })
    .then(() => {
      control = query<HTMLButtonElement>(button, 'button')
      field = query<HTMLInputElement>(input, 'input')
      trigger = query<HTMLButtonElement>(dialog, 'zw-dialog-trigger button')
      oldRow = query<HTMLElement>(
        grid,
        '[data-slot="data-grid-row"][data-row-key="row-1"]',
      )
      pressSource = click(control)
      openSource = click(trigger)
      return tick()
    })
    .then(() => {
      assert(
        events.filter(event => event.type === 'press').length === 1 &&
          events.filter(event => event.type === 'open-change').length === 1,
        'move duplicated or lost event handlers/context',
      )
      assert(
        button.querySelectorAll('[data-slot="button-prefix"] span').length ===
          1 && button.contains(prefix),
        'move duplicated or lost slot projection',
      )
      expectSource('press', pressSource)
      expectSource('open-change', openSource)
      assert(
        input.formatter === formatter &&
          grid.rows === rows &&
          grid.columns === columns &&
          button.variant === 'danger' &&
          grid.rowHeight === 42 &&
          grid.querySelectorAll('[data-slot="data-grid-row"]').length === 2 &&
          (query(button, 'button').textContent || '').includes('Action'),
        'move lost properties or default slot content',
      )
      assert(
        field.value === 'seed' &&
          !field.required &&
          !control.disabled &&
          !button.hasAttribute('pressed') &&
          oldRow.getAttribute('aria-selected') === 'false' &&
          dialog.getAttribute('data-state') === 'open' &&
          trigger.getAttribute('aria-expanded') === 'true',
        'native move did not restore live component state and accessibility',
      )
      save('move', {
        pressCount: events.filter(event => event.type === 'press').length,
        openCount: events.filter(event => event.type === 'open-change').length,
        projectedCount: button.querySelectorAll(
          '[data-slot="button-prefix"] span',
        ).length,
        inputValue: field.value,
        selected: oldRow.getAttribute('aria-selected'),
        rowKeys: Array.from(
          grid.querySelectorAll('[data-slot="data-grid-row"]'),
          row => row.getAttribute('data-row-key'),
        ),
        rowHeight: grid.rowHeight,
        dialog: dialog.getAttribute('data-state'),
        triggerExpanded: trigger.getAttribute('aria-expanded'),
        variant: button.variant,
      })
      container.remove()
      return tick()
    })
    .then(() => {
      // Disposal itself may remove rendered children. Capture the settled
      // disposed controls before changing host props to detect live bindings.
      valueBeforeDetach = field.value
      triggerExpandedBeforeDetach = trigger.getAttribute('aria-expanded')
      rowTextBeforeDetach = oldRow.textContent
      events.length = 0
      probe.append(control, field, trigger, oldRow)
      control.click()
      field.dispatchEvent(new InputEvent('input', { bubbles: true }))
      trigger.click()
      oldRow.click()
      input.value = 'after-disconnect'
      button.disabled = true
      dialog.open = false
      grid.rows = [{ id: 'row-3', name: 'Three' }]
      return tick()
    })
    .then(() => {
      assert(
        events.length === 0,
        'disposed component controls still dispatched host events',
      )
      assert(
        !control.disabled &&
          field.value === valueBeforeDetach &&
          trigger.getAttribute('aria-expanded') ===
            triggerExpandedBeforeDetach &&
          oldRow.textContent === rowTextBeforeDetach,
        `disconnected bindings updated disposed controls: ${JSON.stringify({ button: control.disabled, valueBeforeDetach, valueAfter: field.value, triggerBefore: triggerExpandedBeforeDetach, triggerAfter: trigger.getAttribute('aria-expanded'), rowBefore: rowTextBeforeDetach, rowAfter: oldRow.textContent })}`,
      )
      save('dispose', {
        eventCount: events.length,
        bindingsStopped: true,
      })
      // Cleanup may change discarded internal DOM. The public requirement is
      // that its bindings and handlers stay stopped afterwards, proven above.
      diagnostics.disposedControls = {
        buttonDisabled: control.disabled,
        inputValue: field.value,
        triggerExpanded: trigger.getAttribute('aria-expanded'),
        rowText: oldRow.textContent,
      }
      moved.append(container)
      return Promise.all(readinessHosts.map(ready)).then(tick)
    })
    .then(() => {
      const nextControl = query<HTMLButtonElement>(button, 'button')
      const nextField = query<HTMLInputElement>(input, 'input')
      const nextTrigger = query<HTMLButtonElement>(
        dialog,
        'zw-dialog-trigger button',
      )
      const nextRow = query<HTMLElement>(
        grid,
        '[data-slot="data-grid-row"][data-row-key="row-3"]',
      )
      assert(
        nextControl !== control &&
          nextField !== field &&
          nextTrigger !== trigger &&
          nextRow !== oldRow,
        'reconnect reused a disposed control',
      )
      assert(
        nextControl.disabled &&
          nextField.value === 'after-disconnect' &&
          dialog.getAttribute('data-state') === 'closed' &&
          nextRow.textContent !== null &&
          nextRow.textContent.includes('Three'),
        'reconnect lost disconnected property updates',
      )
      assert(
        button.contains(prefix) &&
          button.querySelectorAll('[data-slot="button-prefix"] span').length ===
            1 &&
          (nextControl.textContent || '').includes('Action'),
        'reconnect lost/duplicated projected children',
      )
      events.length = 0
      button.disabled = false
      return tick()
        .then(() => {
          pressSource = click(nextControl)
          openSource = click(nextTrigger)
          selectionSource = click(nextRow)
        })
        .then(tick)
    })
    .then(() => {
      assert(
        events.filter(event => event.type === 'press').length === 1 &&
          events.filter(event => event.type === 'open-change').length === 1 &&
          events.filter(event => event.type === 'selection-change').length ===
            1,
        `reconnect duplicated/lost component handlers: ${JSON.stringify(events)}`,
      )
      expectSource('press', pressSource)
      expectSource('open-change', openSource)
      expectSource('selection-change', selectionSource)
      const reconnectedTrigger = query<HTMLButtonElement>(
        dialog,
        'zw-dialog-trigger button',
      )
      const reconnectedRow = query<HTMLElement>(
        grid,
        '[data-slot="data-grid-row"][data-row-key="row-3"]',
      )
      assert(
        dialog.getAttribute('data-state') === 'open' &&
          reconnectedTrigger.getAttribute('aria-expanded') === 'true',
        'reconnect did not restore live dialog context and accessibility',
      )
      assert(
        !query<HTMLButtonElement>(button, 'button').disabled &&
          reconnectedRow.getAttribute('aria-selected') === 'true',
        'reconnect did not restore live button and grid bindings',
      )
      save('reconnect', {
        value: query<HTMLInputElement>(input, 'input').value,
        dialog: dialog.getAttribute('data-state'),
        triggerExpanded: reconnectedTrigger.getAttribute('aria-expanded'),
        selected: reconnectedRow.getAttribute('aria-selected'),
        rowKeys: Array.from(
          grid.querySelectorAll('[data-slot="data-grid-row"]'),
          row => row.getAttribute('data-row-key'),
        ),
        events: events.slice(),
      })
      return { stages, diagnostics }
    })
    .finally(() => {
      disposeList()
      container.remove()
      runtimeFrame.remove()
      moved.remove()
      probe.remove()
    })
}
