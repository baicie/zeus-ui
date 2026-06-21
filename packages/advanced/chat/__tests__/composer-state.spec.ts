import { describe, expect, it } from 'vitest'

import { createComposerState, shouldSubmitFromKeyboardEvent } from '../src/core'

interface MockKeyboardEvent {
  key: string
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  defaultPrevented: boolean
  isComposing: boolean
  keyCode: number
}

function createKeyboardEvent(
  init: Partial<MockKeyboardEvent> = {},
): KeyboardEvent {
  const event = {
    key: '',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    defaultPrevented: false,
    isComposing: false,
    keyCode: 0,
    ...init,
  } as unknown as KeyboardEvent

  return event
}

describe('createComposerState', () => {
  it('stores value', () => {
    const state = createComposerState('hello')

    expect(state.getValue()).toBe('hello')

    state.setValue('world')
    expect(state.getSnapshot().value).toBe('world')

    state.clearValue()
    expect(state.getValue()).toBe('')
  })

  it('stores attachments immutably', () => {
    const state = createComposerState()

    state.addAttachment({
      id: 'a1',
      name: 'a.txt',
      metadata: {
        type: 'demo',
      },
    })

    const attachments = state.getAttachments()
    attachments[0].metadata = {
      type: 'mutated',
    }

    expect(state.getAttachments()[0].metadata).toEqual({
      type: 'demo',
    })
  })

  it('replaces attachment with same id', () => {
    const state = createComposerState()

    state.addAttachment({
      id: 'a1',
      name: 'old.txt',
    })

    state.addAttachment({
      id: 'a1',
      name: 'new.txt',
    })

    expect(state.getAttachments()).toEqual([
      {
        id: 'a1',
        name: 'new.txt',
      },
    ])
  })

  it('removes attachments', () => {
    const state = createComposerState('', [
      {
        id: 'a1',
        name: 'a.txt',
      },
      {
        id: 'a2',
        name: 'b.txt',
      },
    ])

    state.removeAttachment('a1')

    expect(state.getAttachments()).toEqual([
      {
        id: 'a2',
        name: 'b.txt',
      },
    ])

    state.clearAttachments()
    expect(state.getAttachments()).toEqual([])
  })
})

describe('shouldSubmitFromKeyboardEvent', () => {
  it('submits on plain enter', () => {
    expect(
      shouldSubmitFromKeyboardEvent(
        createKeyboardEvent({
          key: 'Enter',
        }),
        true,
      ),
    ).toBe(true)
  })

  it('does not submit when submitOnEnter is disabled', () => {
    expect(
      shouldSubmitFromKeyboardEvent(
        createKeyboardEvent({
          key: 'Enter',
        }),
        false,
      ),
    ).toBe(false)
  })

  it('does not submit on shift enter', () => {
    expect(
      shouldSubmitFromKeyboardEvent(
        createKeyboardEvent({
          key: 'Enter',
          shiftKey: true,
        }),
        true,
      ),
    ).toBe(false)
  })

  it('does not submit while composing', () => {
    const event = createKeyboardEvent({
      key: 'Enter',
    })

    Object.defineProperty(event, 'isComposing', {
      configurable: true,
      value: true,
    })

    expect(shouldSubmitFromKeyboardEvent(event, true)).toBe(false)
  })

  it('does not submit for keyCode 229', () => {
    expect(
      shouldSubmitFromKeyboardEvent(
        createKeyboardEvent({
          key: 'Enter',
          keyCode: 229,
        }),
        true,
      ),
    ).toBe(false)
  })
})
