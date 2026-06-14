import type { ChatAttachmentData } from '../types'

export interface ComposerStateSnapshot {
  value: string
  attachments: ChatAttachmentData[]
}

export interface ComposerState {
  getValue: () => string
  setValue: (value: string) => string
  clearValue: () => void
  getAttachments: () => ChatAttachmentData[]
  setAttachments: (attachments: ChatAttachmentData[]) => ChatAttachmentData[]
  addAttachment: (attachment: ChatAttachmentData) => ChatAttachmentData[]
  removeAttachment: (id: string) => ChatAttachmentData[]
  clearAttachments: () => void
  getSnapshot: () => ComposerStateSnapshot
}

function normalizeValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function cloneAttachment(attachment: ChatAttachmentData): ChatAttachmentData {
  return {
    ...attachment,
    metadata: attachment.metadata ? { ...attachment.metadata } : undefined,
  }
}

function cloneAttachments(
  attachments: ChatAttachmentData[],
): ChatAttachmentData[] {
  return attachments.map(attachment => cloneAttachment(attachment))
}

export function createComposerState(
  initialValue = '',
  initialAttachments: ChatAttachmentData[] = [],
): ComposerState {
  let value = normalizeValue(initialValue)
  let attachments = cloneAttachments(initialAttachments)

  return {
    getValue(): string {
      return value
    },

    setValue(nextValue: string): string {
      value = normalizeValue(nextValue)
      return value
    },

    clearValue(): void {
      value = ''
    },

    getAttachments(): ChatAttachmentData[] {
      return cloneAttachments(attachments)
    },

    setAttachments(
      nextAttachments: ChatAttachmentData[],
    ): ChatAttachmentData[] {
      attachments = cloneAttachments(nextAttachments)
      return cloneAttachments(attachments)
    },

    addAttachment(attachment: ChatAttachmentData): ChatAttachmentData[] {
      attachments = [
        ...attachments.filter(item => item.id !== attachment.id),
        cloneAttachment(attachment),
      ]

      return cloneAttachments(attachments)
    },

    removeAttachment(id: string): ChatAttachmentData[] {
      attachments = attachments.filter(attachment => attachment.id !== id)
      return cloneAttachments(attachments)
    },

    clearAttachments(): void {
      attachments = []
    },

    getSnapshot(): ComposerStateSnapshot {
      return {
        value,
        attachments: cloneAttachments(attachments),
      }
    },
  }
}

export function shouldSubmitFromKeyboardEvent(
  event: KeyboardEvent,
  submitOnEnter: boolean,
): boolean {
  if (!submitOnEnter) return false
  if (event.defaultPrevented) return false
  if (event.key !== 'Enter') return false
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
    return false
  if (event.isComposing || event.keyCode === 229) return false

  return true
}
