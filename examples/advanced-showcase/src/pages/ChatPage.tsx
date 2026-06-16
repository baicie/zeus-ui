import type { FormEvent } from 'react'
import type { ChatElement } from '../types'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DemoCard } from '../components/DemoCard'
import { StatusNote } from '../components/StatusNote'
import { chatMessages } from '../data/advanced-data'

const ROLE_LABEL: Record<string, string> = {
  system: 'System',
  user: 'You',
  assistant: 'Assistant',
  tool: 'Tool',
}

export function ChatPage() {
  const chatRef = useRef<ChatElement | null>(null)
  const [sendNote, setSendNote] = useState('Send a message to see the event.')

  useEffect(() => {
    const chat = chatRef.current
    if (!chat) return

    chat.setMessages(chatMessages)

    const handleSend = (event: Event) => {
      const customEvent = event as CustomEvent<{ value: string }>
      setSendNote(`Send: "${customEvent.detail.value}"`)
    }

    chat.addEventListener('send', handleSend)

    return () => {
      chat.removeEventListener('send', handleSend)
    }
  }, [])

  const handleCopyMarkdown = useCallback(
    (messageId: string, content: string) => {
      const md = content
        .replace(/^```\w*\n?/, '')
        .replace(/```$/, '')
        .trim()

      navigator.clipboard.writeText(md).then(() => {
        setSendNote(`Copied message "${messageId}" as markdown to clipboard.`)
      })
    },
    [],
  )

  const handleCopyBlock = useCallback((code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setSendNote('Code block copied to clipboard.')
    })
  }, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const input = form.elements.namedItem('chat-input') as HTMLInputElement
    if (input) {
      chatRef.current?.emitSend(input.value, event.nativeEvent)
      input.value = ''
    }
  }

  const renderContent = (message: (typeof chatMessages)[number]) => {
    const lines = message.content?.split('\n') ?? []

    return lines.map((line, lineIdx) => {
      if (line.startsWith('```')) {
        const lang = line.replace(/^```/, '') || 'code'
        const codeLines: string[] = []
        for (let i = lineIdx + 1; i < lines.length; i++) {
          if (lines[i] === '```') break
          codeLines.push(lines[i])
        }

        if (codeLines.length > 0) {
          return (
            <div key={lineIdx} className="chat-code-block-wrapper">
              <div className="chat-code-block-header">
                <span className="chat-code-lang">{lang}</span>
                <button
                  type="button"
                  className="chat-copy-btn"
                  onClick={() => handleCopyBlock(codeLines.join('\n'))}
                >
                  Copy
                </button>
              </div>
              <pre className="chat-code-block">
                <code>{codeLines.join('\n')}</code>
              </pre>
            </div>
          )
        }
      }

      if (line.includes('|') && line.includes('---')) {
        return null
      }

      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line
          .split('|')
          .filter((_, i, arr) => i > 0 && i < arr.length - 1)
        return (
          <div key={lineIdx} className="chat-table-row">
            {cells.map((cell, ci) => (
              <span
                key={ci}
                className={`chat-table-cell${line.includes('---') ? ' chat-table-header' : ''}`}
              >
                {cell.trim()}
              </span>
            ))}
          </div>
        )
      }

      if (line.trim()) {
        return (
          <p key={lineIdx} className="chat-text-line">
            {line}
          </p>
        )
      }

      return <br key={lineIdx} />
    })
  }

  return (
    <DemoCard
      title="Chat"
      description="ChatGPT-style chat with messages, code blocks, tables and copy-as-markdown."
    >
      <zw-chat ref={chatRef}>
        <div slot="thread" className="chat-thread">
          {chatMessages.map(message => (
            <div
              key={message.id}
              className={`chat-message chat-message-${message.role}`}
            >
              <div className="chat-message-header">
                <span className="chat-role-badge">
                  {ROLE_LABEL[message.role]}
                </span>
                {message.status === 'streaming' && (
                  <span className="chat-status-dot" />
                )}
              </div>

              <div className="chat-message-body">{renderContent(message)}</div>

              <div className="chat-message-actions">
                <button
                  type="button"
                  className="chat-action-btn"
                  onClick={() =>
                    handleCopyMarkdown(message.id, message.content ?? '')
                  }
                >
                  Copy as MD
                </button>
              </div>
            </div>
          ))}
        </div>

        <form slot="composer" className="chat-composer" onSubmit={handleSubmit}>
          <input
            name="chat-input"
            className="chat-composer-input"
            placeholder="Ask anything..."
            autoComplete="off"
          />
          <button type="submit" className="chat-composer-btn">
            Send
          </button>
        </form>
      </zw-chat>

      <StatusNote>{sendNote}</StatusNote>
    </DemoCard>
  )
}
