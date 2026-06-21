import type { ComponentType } from 'react'

import { AgentConsolePage } from './pages/AgentConsolePage'
import { ChatPage } from './pages/ChatPage'
import { DataGridPage } from './pages/DataGridPage'
import { OverviewPage } from './pages/OverviewPage'
import { RevoGridAdapterPage } from './pages/RevoGridAdapterPage'
import { VirtualListPage } from './pages/VirtualListPage'

export interface AdvancedShowcaseRoute {
  path: string
  label: string
  description: string
  Component: ComponentType
}

export const advancedShowcaseRoutes: AdvancedShowcaseRoute[] = [
  {
    path: '/',
    label: 'Overview',
    description: 'Advanced component navigation.',
    Component: OverviewPage,
  },
  {
    path: '/data-grid',
    label: 'Data Grid',
    description:
      'Virtualized table with selection, sorting and keyboard state.',
    Component: DataGridPage,
  },
  {
    path: '/revogrid-adapter',
    label: 'RevoGrid Adapter',
    description: 'Interop bridge for RevoGrid-compatible custom elements.',
    Component: RevoGridAdapterPage,
  },
  {
    path: '/chat',
    label: 'Chat',
    description: 'Headless chat layout with runtime send event.',
    Component: ChatPage,
  },
  {
    path: '/virtual-list',
    label: 'Virtual List',
    description: 'Low-level virtual viewport primitive.',
    Component: VirtualListPage,
  },
  {
    path: '/agent-console',
    label: 'Agent Console',
    description: 'Local agent state for messages, tools and artifacts.',
    Component: AgentConsolePage,
  },
]
