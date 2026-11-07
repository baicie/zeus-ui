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

export const PUBLIC_REPLAY_SEED_VERSION = 'public-replay-v1'

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
