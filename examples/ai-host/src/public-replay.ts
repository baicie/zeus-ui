/**
 * Public replay seed and reset.
 *
 * The public Workbench is exposed through a single viewer token, so there is
 * no per-visitor identity and no safe interactive session. It is therefore a
 * strictly read-only demo of preset data. Existing databases may still hold
 * messages written by earlier visitors; bumping the seed version clears those
 * events before the preset conversation is written, so historical visitor
 * input can never be replayed to a later visitor.
 */
import type { HostDatabase, PersistentHost } from './store'

import fs from 'node:fs'
import path from 'node:path'

export const PUBLIC_REPLAY_SEED_VERSION = 'public-replay-v1'
const PUBLIC_REPLAY_DIR = 'public-replay'

export interface PublicReplayRoot {
  readonly workspaceRoot: string
  readonly root: string
  readonly seedVersion: string
}

/**
 * Public replay never deletes the configured workspace root. Each seed version
 * gets its own generation directory under `<workspace>/public-replay/<seed>`,
 * so a version bump cannot recursively delete valuable files and a failed
 * start leaves the previous generation intact.
 */
export function resolvePublicReplayRoot(
  workspaceRoot: string,
  seedVersion = PUBLIC_REPLAY_SEED_VERSION,
): PublicReplayRoot {
  if (!path.isAbsolute(workspaceRoot)) {
    throw new Error('public replay workspace root must be absolute')
  }
  const absolute = path.resolve(workspaceRoot)
  if (absolute === '/' || absolute === '/data') {
    throw new Error('public replay workspace root is too broad')
  }
  fs.mkdirSync(absolute, { recursive: true, mode: 0o700 })
  const stat = fs.lstatSync(absolute)
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('public replay workspace root must be a real directory')
  }
  const realWorkspace = fs.realpathSync(absolute)
  if (realWorkspace === '/' || realWorkspace === '/data') {
    throw new Error('public replay workspace root is too broad')
  }
  const root = path.join(realWorkspace, PUBLIC_REPLAY_DIR, seedVersion)
  if (!root.startsWith(`${realWorkspace}${path.sep}`)) {
    throw new Error('public replay generation escapes the workspace root')
  }
  fs.mkdirSync(root, { recursive: true, mode: 0o700 })
  const statRoot = fs.lstatSync(root)
  if (statRoot.isSymbolicLink() || !statRoot.isDirectory()) {
    throw new Error('public replay generation must be a real directory')
  }
  const realRoot = fs.realpathSync(root)
  if (!realRoot.startsWith(`${realWorkspace}${path.sep}`)) {
    throw new Error('public replay generation escapes the workspace root')
  }
  return { workspaceRoot: realWorkspace, root: realRoot, seedVersion }
}

export function resetPublicReplayDatabase(
  database: HostDatabase,
  version = PUBLIC_REPLAY_SEED_VERSION,
): boolean {
  if (database.getMeta('public_replay_seed_version') === version) return false
  database.clearReplay()
  database.setMeta('public_replay_seed_version', version)
  return true
}

export function seedPublicReplayConversation(
  host: PersistentHost,
  createdAt = new Date().toISOString(),
): void {
  if (host.latestSeq('reference') > 0) return
  host.append(
    'conversation.upserted',
    { kind: 'conversation', id: 'workbench' },
    {
      conversation: {
        id: 'workbench',
        title: 'Public replay',
        revision: 1,
      },
    },
  )
  host.append(
    'message.created',
    { kind: 'message', id: 'message-public-1' },
    {
      message: {
        id: 'message-public-1',
        conversationId: 'workbench',
        author: 'user',
        parts: [
          {
            id: 'part-public-1',
            kind: 'text',
            revision: 1,
            text: 'What is available in this public demo?',
            format: 'plain',
          },
        ],
        status: 'complete',
        revision: 1,
        createdAt,
      },
    },
  )
  host.append(
    'message.created',
    { kind: 'message', id: 'message-public-2' },
    {
      message: {
        id: 'message-public-2',
        conversationId: 'workbench',
        author: 'assistant',
        parts: [
          {
            id: 'part-public-2',
            kind: 'text',
            revision: 1,
            text: 'This is a read-only replay of the reference workspace. Sending messages, proposing changes and approving them are disabled for public visitors.',
            format: 'plain',
          },
        ],
        status: 'complete',
        revision: 1,
        createdAt,
      },
    },
  )
}
