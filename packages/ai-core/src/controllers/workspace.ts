/**
 * Workspace selection (AI2-401).
 *
 * Choosing a workspace (project, repository, worktree) changes what the user
 * looks at and what new commands target. It is never bound to a running
 * executor: executions keep the workspace they were started in, and
 * switching does not send a command or stop anything.
 */

import type { EntityId, Execution, Workspace } from '../domain/types'
import type { AiState } from '../store/state'
import type { Controller } from './view-store'

import { createViewStore } from './view-store'

export interface WorkspaceViewState {
  workspaces: readonly Workspace[]
  selectedWorkspaceId?: EntityId
  selected?: Workspace
}

export interface WorkspaceControllerOptions {
  workspaces: readonly Workspace[]
  initialWorkspaceId?: EntityId
}

export interface WorkspaceController extends Controller<WorkspaceViewState> {
  select: (workspaceId: EntityId) => void
  /** Replace the host-provided list; keeps the selection when still valid. */
  setWorkspaces: (workspaces: readonly Workspace[]) => void
  /** Whether the selected workspace grants a host capability. */
  can: (capability: string) => boolean
}

export function createWorkspaceController(
  options: WorkspaceControllerOptions,
): WorkspaceController {
  function resolve(
    workspaces: readonly Workspace[],
    id: EntityId | undefined,
  ): Pick<WorkspaceViewState, 'selectedWorkspaceId' | 'selected'> {
    const selected =
      workspaces.find(workspace => workspace.id === id) ?? workspaces[0]
    return { selectedWorkspaceId: selected?.id, selected }
  }

  const view = createViewStore<WorkspaceViewState>({
    workspaces: options.workspaces,
    ...resolve(options.workspaces, options.initialWorkspaceId),
  })

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    select(workspaceId): void {
      const { workspaces } = view.getSnapshot()
      if (!workspaces.some(workspace => workspace.id === workspaceId)) return
      view.update(resolve(workspaces, workspaceId))
    },
    setWorkspaces(workspaces): void {
      view.update({
        workspaces,
        ...resolve(workspaces, view.getSnapshot().selectedWorkspaceId),
      })
    },
    can(capability): boolean {
      return (
        view.getSnapshot().selected?.capabilities.includes(capability) ?? false
      )
    },
    dispose(): void {
      view.dispose()
    },
  }
}

/** Executions that were started in a workspace, whatever is selected now. */
export function selectExecutionsForWorkspace(
  state: AiState,
  workspaceId: EntityId,
): Execution[] {
  return Object.values(state.executions).filter(
    execution => execution.workspaceId === workspaceId,
  )
}
