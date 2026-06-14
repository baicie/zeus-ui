/* eslint-disable no-restricted-globals */
import '@zeus-web/chat/wc/auto'
import '@zeus-web/data-grid/wc/auto'
import '@zeus-web/virtual/wc/auto'
import './styles.css'

interface DataGridRowData {
  id: string
  metric: string
  owner: string
  status: string
  value: string
}

interface DataGridColumn {
  id: string
  header: string
  field: keyof DataGridRowData
  width: number
  sortable?: boolean
}

interface DataGridElement extends HTMLElement {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  selectionMode?: 'none' | 'single' | 'multiple'
  selectedKeys?: string[]
  resizable?: boolean
  keyboardNavigation?: boolean
  activeRowKey?: string
  activeColumnId?: string
}

interface ChatMessageData {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatElement extends HTMLElement {
  messages?: ChatMessageData[]
  emitSend: (value: string, nativeEvent?: Event) => void
}

const gridRows: DataGridRowData[] = [
  {
    id: 'mrr',
    metric: 'MRR',
    owner: 'Revenue',
    status: 'Healthy',
    value: '$128k',
  },
  {
    id: 'latency',
    metric: 'P95 latency',
    owner: 'Runtime',
    status: 'Watch',
    value: '182ms',
  },
  {
    id: 'tickets',
    metric: 'Open escalations',
    owner: 'Support',
    status: 'Action',
    value: '7',
  },
]

const gridColumns: DataGridColumn[] = [
  {
    id: 'metric',
    header: 'Metric',
    field: 'metric',
    width: 180,
    sortable: true,
  },
  {
    id: 'owner',
    header: 'Owner',
    field: 'owner',
    width: 140,
    sortable: true,
  },
  {
    id: 'status',
    header: 'Status',
    field: 'status',
    width: 130,
    sortable: true,
  },
  {
    id: 'value',
    header: 'Value',
    field: 'value',
    width: 120,
  },
]

const messages: ChatMessageData[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Advanced components are wired for dense product surfaces.',
  },
  {
    id: 'user-follow-up',
    role: 'user',
    content: 'Show me the operational view.',
  },
]

function createSection(
  titleText: string,
  descriptionText: string,
): HTMLElement {
  const section = document.createElement('section')
  section.className = 'advanced-section'

  const header = document.createElement('header')
  header.className = 'advanced-section-header'

  const title = document.createElement('h2')
  title.textContent = titleText

  const description = document.createElement('p')
  description.textContent = descriptionText

  header.append(title, description)
  section.append(header)

  return section
}

function renderDataGrid(root: HTMLElement): void {
  const section = createSection(
    'Data grid',
    'Controlled rows, sortable columns, selection, resizing and keyboard state.',
  )
  const grid = document.createElement('zw-data-grid') as DataGridElement

  grid.rows = gridRows
  grid.columns = gridColumns
  grid.selectionMode = 'multiple'
  grid.selectedKeys = ['latency']
  grid.resizable = true
  grid.keyboardNavigation = true
  grid.activeRowKey = 'mrr'
  grid.activeColumnId = 'metric'
  grid.setAttribute('aria-label', 'Advanced metrics')

  section.append(grid)
  root.append(section)

  customElements.whenDefined('zw-data-grid').then(() => {
    grid.rows = gridRows
    grid.columns = gridColumns
    grid.selectedKeys = ['latency']
    grid.activeRowKey = 'mrr'
    grid.activeColumnId = 'metric'
  })
}

function renderChat(root: HTMLElement): void {
  const section = createSection(
    'Chat',
    'Headless chat layout with message state and explicit runtime methods.',
  )
  const chat = document.createElement('zw-chat') as ChatElement
  const thread = document.createElement('div')
  const composer = document.createElement('form')
  const input = document.createElement('input')
  const button = document.createElement('button')

  chat.messages = messages
  chat.setAttribute('empty-text', 'No conversation yet')

  thread.slot = 'thread'
  thread.className = 'chat-thread'

  for (const message of messages) {
    const bubble = document.createElement('article')
    bubble.className = `chat-bubble chat-bubble-${message.role}`
    bubble.textContent = String(message.content)
    thread.append(bubble)
  }

  composer.slot = 'composer'
  composer.className = 'chat-composer'

  input.placeholder = 'Ask the agent'
  input.value = 'Summarize the grid'

  button.type = 'submit'
  button.textContent = 'Send'

  composer.addEventListener('submit', event => {
    event.preventDefault()
    chat.emitSend(input.value, event)
  })

  chat.addEventListener('send', event => {
    const output = document.querySelector('[data-send-output]')
    const customEvent = event as CustomEvent<{ value: string }>

    if (output) {
      output.textContent = customEvent.detail.value
    }
  })

  composer.append(input, button)
  chat.append(thread, composer)

  const output = document.createElement('p')
  output.className = 'event-output'
  output.dataset.sendOutput = ''
  output.textContent = 'Waiting for send event'

  section.append(chat, output)
  root.append(section)
}

function renderVirtualList(root: HTMLElement): void {
  const section = createSection(
    'Virtual list',
    'A low-level viewport primitive for high-volume advanced interfaces.',
  )
  const list = document.createElement('zw-virtual-list')
  const items = document.createElement('div')

  list.setAttribute('count', '120')
  list.setAttribute('estimate-size', '36')
  list.setAttribute('overscan', '3')
  list.setAttribute('aria-label', 'Advanced activity')

  items.className = 'virtual-items'

  for (let index = 0; index < 12; index += 1) {
    const item = document.createElement('div')
    item.className = 'virtual-row'
    item.textContent = `Activity ${index + 1}: queued advanced workload`
    items.append(item)
  }

  list.append(items)
  section.append(list)
  root.append(section)
}

function renderAdvancedShowcase(root: HTMLElement): void {
  root.innerHTML = ''

  const shell = document.createElement('main')
  shell.className = 'advanced-shell'

  const hero = document.createElement('header')
  hero.className = 'advanced-hero'

  const eyebrow = document.createElement('p')
  eyebrow.className = 'advanced-eyebrow'
  eyebrow.textContent = '@zeus-web advanced'

  const title = document.createElement('h1')
  title.textContent = 'Advanced Component Showcase'

  const description = document.createElement('p')
  description.textContent =
    'Operational demos for data-heavy and AI-assisted Zeus Web interfaces.'

  hero.append(eyebrow, title, description)
  shell.append(hero)

  renderDataGrid(shell)
  renderChat(shell)
  renderVirtualList(shell)

  root.append(shell)
}

const app = document.querySelector<HTMLElement>('#app')

if (app) {
  renderAdvancedShowcase(app)
}
