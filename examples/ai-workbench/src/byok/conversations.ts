/**
 * Local conversation store for BYOK chat.
 *
 * These conversations are the browser's own. They are *not* Host state and are
 * never written to the replay stream: the Host's snapshot remains the single
 * authority for agent conversations, and mixing local messages into it would
 * corrupt that contract.
 *
 * Storage is IndexedDB, plain JSON. A message body is model output plus what
 * the user typed — neither is a secret — but the store still exposes a wipe so
 * a shared machine can be cleared.
 */

export interface ChatTurn {
  readonly id: string
  readonly role: 'user' | 'assistant' | 'system'
  readonly createdAt: string
  /**
   * Mutable while streaming: the assistant turn is appended empty and filled
   * as chunks arrive, so the store holds one record per turn rather than one
   * per token.
   */
  content: string
  /** Set when the turn failed; keeps the error with the message it belongs to. */
  error?: string
  model?: string
  /** Token counts when the gateway reported them. */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface LocalConversation {
  readonly id: string
  title: string
  readonly createdAt: string
  updatedAt: string
  /** The provider profile this conversation was started with. */
  providerId: string
  model: string
  readonly turns: ChatTurn[]
}

const DB_NAME = 'zeus-byok-chat'
const DB_VERSION = 1
const STORE = 'conversations'
/**
 * Which conversation is open. A conversation id is not a secret and it is not
 * message content, so it is the one piece of BYOK state kept in web storage:
 * a reload must come back to the chat the reader was in, not to the newest.
 */
const ACTIVE_KEY = 'zeus-byok-active'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function createConversation(
  providerId: string,
  model: string,
  title = 'New chat',
): LocalConversation {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    providerId,
    model,
    turns: [],
  }
}

class ConversationStore {
  private conversations: LocalConversation[] = []
  private activeId: string | undefined = readStoredActive()
  private listeners = new Set<() => void>()

  async load(): Promise<void> {
    const db = await openDatabase()
    try {
      this.conversations = await new Promise<LocalConversation[]>(
        (resolve, reject) => {
          const tx = db.transaction(STORE, 'readonly')
          const request = tx.objectStore(STORE).getAll()
          request.onsuccess = () =>
            resolve(request.result as LocalConversation[])
          request.onerror = () => reject(request.error)
        },
      )
      this.conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      if (!this.activeId || !this.get(this.activeId)) {
        this.activeId = this.conversations[0]?.id
        writeStoredActive(this.activeId)
      }
      this.emit()
    } finally {
      db.close()
    }
  }

  list(): readonly LocalConversation[] {
    return this.conversations
  }

  get(id: string): LocalConversation | undefined {
    return this.conversations.find(conversation => conversation.id === id)
  }

  active(): LocalConversation | undefined {
    return this.activeId ? this.get(this.activeId) : undefined
  }

  activeIdValue(): string | undefined {
    return this.activeId
  }

  setActive(id: string | undefined): void {
    this.activeId = id
    writeStoredActive(id)
    this.emit()
  }

  /**
   * Inserts a conversation and makes it active *before* it is persisted.
   *
   * `setActive` alone is not enough for a brand-new chat: the id is not in the
   * list yet, so a subscriber reading `active()` during the emit would see
   * `undefined` and clear the view that is being created.
   */
  add(conversation: LocalConversation): void {
    const index = this.conversations.findIndex(
      item => item.id === conversation.id,
    )
    if (index >= 0) this.conversations[index] = conversation
    else this.conversations.unshift(conversation)
    this.activeId = conversation.id
    writeStoredActive(conversation.id)
    this.emit()
  }

  /** Switches to a conversation by id; returns it when it exists. */
  open(id: string): LocalConversation | undefined {
    const conversation = this.get(id)
    if (!conversation) return undefined
    this.setActive(id)
    return conversation
  }

  async save(conversation: LocalConversation): Promise<void> {
    conversation.updatedAt = new Date().toISOString()
    const db = await openDatabase()
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(conversation)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
    const index = this.conversations.findIndex(
      item => item.id === conversation.id,
    )
    if (index >= 0) this.conversations[index] = conversation
    else this.conversations.unshift(conversation)
    this.conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    this.emit()
  }

  async delete(id: string): Promise<void> {
    const db = await openDatabase()
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
    this.conversations = this.conversations.filter(item => item.id !== id)
    if (this.activeId === id) {
      this.activeId = this.conversations[0]?.id
      writeStoredActive(this.activeId)
    }
    this.emit()
  }

  async rename(id: string, title: string): Promise<void> {
    const conversation = this.get(id)
    if (!conversation) return
    conversation.title = title.trim() || 'Untitled chat'
    await this.save(conversation)
  }

  /** Removes every locally stored conversation. */
  async clear(): Promise<void> {
    const db = await openDatabase()
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
    this.conversations = []
    this.activeId = undefined
    writeStoredActive(undefined)
    this.emit()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    listener()
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

export const conversationStore = new ConversationStore()

function readStoredActive(): string | undefined {
  try {
    const stored = localStorage.getItem(ACTIVE_KEY)
    return stored ?? undefined
  } catch {
    return undefined
  }
}

function writeStoredActive(id: string | undefined): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // Private mode; the in-memory choice still holds for this page.
  }
}
