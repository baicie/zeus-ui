import type { FormEvent, ReactNode } from 'react'
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
    const input = form.elements.namedItem('chat-input') as HTMLTextAreaElement
    if (input) {
      chatRef.current?.emitSend(input.value, event.nativeEvent)
      input.value = ''
    }
  }

  const renderContent = (message: (typeof chatMessages)[number]) => {
    const lines = message.content ? message.content.split('\n') : []
    const blocks: ReactNode[] = []
    let lineIdx = 0

    while (lineIdx < lines.length) {
      const line = lines[lineIdx]

      if (line.startsWith('```')) {
        const lang = line.replace(/^```/, '') || 'code'
        const codeLines: string[] = []
        let codeEnd = lineIdx + 1

        while (codeEnd < lines.length && lines[codeEnd] !== '```') {
          codeLines.push(lines[codeEnd])
          codeEnd += 1
        }

        blocks.push(
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
          </div>,
        )
        lineIdx = codeEnd + 1
        continue
      }

      if (line.startsWith('|') && line.endsWith('|')) {
        const tableRows: string[][] = []
        const tableStart = lineIdx

        while (
          lineIdx < lines.length &&
          lines[lineIdx].startsWith('|') &&
          lines[lineIdx].endsWith('|')
        ) {
          if (!lines[lineIdx].includes('---')) {
            tableRows.push(
              lines[lineIdx]
                .split('|')
                .filter(
                  (_, index, cells) => index > 0 && index < cells.length - 1,
                )
                .map(cell => cell.trim()),
            )
          }
          lineIdx += 1
        }

        blocks.push(
          <div key={tableStart} className="chat-table">
            {tableRows.map((cells, rowIndex) => (
              <div key={rowIndex} className="chat-table-row">
                {cells.map((cell, cellIndex) => (
                  <span
                    key={cellIndex}
                    className={`chat-table-cell${rowIndex === 0 ? ' chat-table-header' : ''}`}
                  >
                    {cell}
                  </span>
                ))}
              </div>
            ))}
          </div>,
        )
        continue
      }

      if (line.trim()) {
        blocks.push(
          <p key={lineIdx} className="chat-text-line">
            {line}
          </p>,
        )
      } else {
        blocks.push(<br key={lineIdx} />)
      }

      lineIdx += 1
    }

    return blocks
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
              <div className="chat-message-inner">
                <div className="chat-avatar" aria-hidden="true">
                  {message.role === 'assistant'
                    ? '✦'
                    : ROLE_LABEL[message.role].slice(0, 1)}
                </div>

                <div className="chat-message-content">
                  <div className="chat-message-header">
                    <strong>{ROLE_LABEL[message.role]}</strong>
                    {message.status === 'streaming' ? (
                      <span className="chat-status-dot" />
                    ) : null}
                  </div>

                  <div className="chat-message-body">
                    {renderContent(message)}
                  </div>

                  <div className="chat-message-actions">
                    <button
                      type="button"
                      className="chat-action-btn"
                      aria-label={`Copy ${ROLE_LABEL[message.role]} message as markdown`}
                      onClick={() =>
                        handleCopyMarkdown(message.id, message.content ?? '')
                      }
                    >
                      <span aria-hidden="true">▣</span>
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <form slot="composer" className="chat-composer" onSubmit={handleSubmit}>
          <textarea
            name="chat-input"
            className="chat-composer-input"
            placeholder="Message ChatGPT"
            aria-label="Message ChatGPT"
            rows={1}
            autoComplete="off"
          />
          <button
            type="submit"
            className="chat-composer-btn"
            aria-label="Send message"
          >
            ↑
          </button>
        </form>
      </zw-chat>

      <StatusNote>{sendNote}</StatusNote>
    </DemoCard>
  )
}
