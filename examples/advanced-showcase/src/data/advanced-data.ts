import type {
  AgentConsoleArtifact,
  AgentConsoleDiagnostic,
  AgentConsoleMessage,
  AgentConsoleToolCall,
  ChatMessageData,
  DataGridColumn,
  DataGridRowData,
} from '../types'

export const gridRows: DataGridRowData[] = [
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

export const gridColumns: DataGridColumn[] = [
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

export const chatMessages: ChatMessageData[] = [
  {
    id: 'msg-welcome',
    role: 'assistant',
    content:
      'Advanced components are wired for dense product surfaces. Here is a sample response that includes a code block:',
  },
  {
    id: 'msg-code',
    role: 'assistant',
    status: 'complete',
    content:
      '```typescript\nconst grid = document.querySelector("zw-data-grid")\ngrid.setMessages(rows)\n```',
  },
  {
    id: 'msg-user',
    role: 'user',
    content: 'Show me the operational view.',
  },
  {
    id: 'msg-ai',
    role: 'assistant',
    status: 'complete',
    content:
      'Here is the grid state:\n\n| Metric | Value | Status |\n|--------|-------|--------|\n| MRR | $128k | Healthy |\n| Latency | 182ms | Watch |',
  },
]

export const agentMessages: AgentConsoleMessage[] = [
  {
    id: 'agent-system',
    role: 'system',
    content: 'Agent Console is running in local showcase mode.',
    status: 'complete',
    createdAt: Date.now() - 60000,
    updatedAt: Date.now() - 60000,
  },
  {
    id: 'agent-assistant',
    role: 'assistant',
    content:
      'Use appendMessage, startToolCall, addArtifact and addDiagnostic to validate local state transitions.',
    status: 'complete',
    createdAt: Date.now() - 30000,
    updatedAt: Date.now() - 30000,
  },
]

export const agentToolCalls: AgentConsoleToolCall[] = [
  {
    id: 'tool-inspect',
    name: 'local.inspect',
    status: 'complete',
    input: { page: 'agent-console' },
    output: { ok: true, elements: 4 },
    createdAt: Date.now() - 20000,
    updatedAt: Date.now() - 15000,
  },
  {
    id: 'tool-query',
    name: 'db.query',
    status: 'complete',
    input: { sql: 'SELECT * FROM metrics LIMIT 10' },
    output: { rows: 3, duration_ms: 12 },
    createdAt: Date.now() - 10000,
    updatedAt: Date.now() - 5000,
  },
]

export const agentArtifacts: AgentConsoleArtifact[] = [
  {
    id: 'artifact-metrics',
    kind: 'json',
    title: 'Metrics snapshot',
    content: {
      mrr: 128000,
      latency_p95_ms: 182,
      open_tickets: 7,
    },
    createdAt: Date.now() - 25000,
    updatedAt: Date.now() - 25000,
  },
  {
    id: 'artifact-chart',
    kind: 'text',
    title: 'Trend analysis',
    content:
      'MRR growth: +12% MoM\nLatency trend: stable\nEscalations: trending down',
    createdAt: Date.now() - 8000,
    updatedAt: Date.now() - 8000,
  },
]

export const agentDiagnostics: AgentConsoleDiagnostic[] = [
  {
    id: 'diag-info',
    level: 'info',
    message: 'Agent console initialized in showcase mode.',
    source: 'agent-console',
    createdAt: Date.now() - 60000,
  },
  {
    id: 'diag-warn',
    level: 'warning',
    message: 'No LLM provider configured — running in local demo.',
    source: 'agent-console',
    createdAt: Date.now() - 50000,
  },
]
