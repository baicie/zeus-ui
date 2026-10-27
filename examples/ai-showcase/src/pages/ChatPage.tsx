/**
 * S1 · Chat: compose with @ context, stream an answer, stop it, branch by
 * editing or regenerating, and survive a dropped connection.
 */

import type { AiState, Message } from '@zeus-web/ai-core'

import {
  createComposerController,
  createConversationController,
  createExecutionController,
} from '@zeus-web/ai-core'
import { createContextPicker } from '@zeus-web/ai-primitives'
import {
  AiComposer,
  AiExecutionStatus,
  AiMessageTimeline,
  useAiState,
  useController,
  useOwnedController,
} from '@zeus-web/ai-react'
import { CHAT_ID } from '../demo-host'
import { host, session } from '../session'

const conversation = createConversationController({
  session,
  conversationId: CHAT_ID,
})
const composer = createComposerController({
  session,
  conversationId: CHAT_ID,
  parentMessageId: () => conversation.getSnapshot().leafMessageId,
})
let caret = 0
const picker = createContextPicker({
  composer,
  caret: () => caret,
  items: () => [
    { id: 'src/math.ts', label: 'math.ts', kind: 'file', trigger: '@' },
    { id: 'README.md', label: 'README.md', kind: 'file', trigger: '@' },
    { id: 'explain', label: 'Explain', kind: 'custom', trigger: '/' },
  ],
})

/** Track the caret for the @ picker without owning the textarea. */
document.addEventListener('selectionchange', () => {
  const active = document.activeElement
  if (active instanceof HTMLTextAreaElement) caret = active.selectionStart
})
document.addEventListener(
  'input',
  event => {
    if (event.target instanceof HTMLTextAreaElement)
      caret = event.target.selectionStart
  },
  true,
)

function editInComposer(message: Message): void {
  const part = message.parts[0]
  if (part?.kind === 'text') composer.setText(part.text)
}

function ExecutionBar({ executionId }: { executionId: string }) {
  const controller = useOwnedController(
    () => createExecutionController({ session, executionId }),
    [executionId],
  )
  return <AiExecutionStatus controller={controller} />
}

export function ChatPage() {
  const leaf = useController(conversation, view => view.leafMessageId)
  const selectExecution = (state: AiState): string | undefined =>
    leaf ? state.messages.get(leaf)?.executionId : undefined
  const executionId = useAiState(session.store, selectExecution)
  const connection = useController(session, view => view.connection)

  return (
    <section className="story" aria-labelledby="chat-title">
      <header className="story-header">
        <h1 id="chat-title">S1 · Chat</h1>
        <span className="connection" data-connection={connection}>
          {connection}
        </span>
        <button type="button" onClick={() => host.dropConnections()}>
          Drop connection
        </button>
      </header>
      <div className="chat">
        <AiMessageTimeline
          conversation={conversation}
          session={session}
          label="Conversation"
          messageProps={{ onEdit: editInComposer }}
        />
        {executionId && (
          <ExecutionBar key={executionId} executionId={executionId} />
        )}
        <AiComposer
          controller={composer}
          contextPicker={picker}
          label="Ask the assistant"
        />
      </div>
    </section>
  )
}
