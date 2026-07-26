import type { ReactNode } from 'react'

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { ChatPage } from '../pages/ChatPage'

class ChatTestElement extends HTMLElement {
  private _resolveReady: ((element: ChatTestElement) => void) | undefined
  private readonly _ready = new Promise<ChatTestElement>(resolve => {
    this._resolveReady = resolve
  })

  componentOnReady(): Promise<ChatTestElement> {
    return this._ready
  }

  resolveReady(): void {
    const resolveReady = this._resolveReady
    if (resolveReady) resolveReady(this)
  }

  setMessages(): void {}

  emitSend(value: string): void {
    this.dispatchEvent(
      new CustomEvent('send', {
        detail: { value },
      }),
    )
  }
}

vi.mock('../components/DemoCard', () => ({
  DemoCard: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

vi.mock('../components/StatusNote', () => ({
  StatusNote: ({ children }: { children: string }) => (
    <p role="status">{children}</p>
  ),
}))

describe('chat page', () => {
  beforeAll(() => {
    if (!globalThis.customElements.get('zw-chat')) {
      globalThis.customElements.define('zw-chat', ChatTestElement)
    }
  })

  afterEach(() => {
    cleanup()
  })

  it('enables sending only after the chat element is ready', () => {
    render(<ChatPage />)

    const input = screen.getByRole('textbox', { name: 'Message ChatGPT' })
    const send = screen.getByRole('button', { name: 'Send message' })
    const chat = input.closest('zw-chat')

    expect(chat).toBeInstanceOf(ChatTestElement)
    if (!(chat instanceof ChatTestElement)) {
      throw new TypeError('Expected the chat test element.')
    }

    expect((input as HTMLTextAreaElement).disabled).toBe(true)
    expect((send as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(send)

    expect(screen.getByRole('status').textContent).toBe(
      'Send a message to see the event.',
    )

    chat.resolveReady()

    return waitFor(() => {
      expect((input as HTMLTextAreaElement).disabled).toBe(false)
      expect((send as HTMLButtonElement).disabled).toBe(false)
    }).then(() => {
      fireEvent.change(input, {
        target: { value: 'Summarize the grid' },
      })
      fireEvent.click(send)

      expect(screen.getByRole('status').textContent).toContain(
        'Send: "Summarize the grid"',
      )
    })
  })
})
