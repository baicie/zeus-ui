/**
 * Provider profiles: the non-secret half of a BYOK configuration.
 *
 * Everything here is safe to keep in plain IndexedDB — base URL, model,
 * temperature, limits. The API key is the only secret, and it lives in
 * {@link import('./vault').vault} under the profile's id. Splitting them this
 * way means the settings UI can list, rename and reorder profiles while the
 * vault is locked; only a request needs the key.
 */

export type ProviderKind = 'openai-compatible'

export interface ProviderProfile {
  readonly id: string
  readonly name: string
  readonly kind: ProviderKind
  /** Gateway root, for example `https://api.example.com/v1`. */
  readonly baseUrl: string
  readonly model: string
  /** Overrides the default `/chat/completions` path when a gateway differs. */
  readonly chatPath: string
  readonly temperature: number
  readonly maxTokens: number
  /** Milliseconds before a request is aborted. */
  readonly timeoutMs: number
  readonly stream: boolean
  /** Set once a test request has succeeded. Never set optimistically. */
  readonly verifiedAt?: string
  readonly createdAt: string
  readonly updatedAt: string
}

/** The vault record id for a profile's key. */
export function keyRecordId(profileId: string): string {
  return `provider-key:${profileId}`
}

const DB_NAME = 'zeus-byok-profiles'
const DB_VERSION = 1
const STORE = 'profiles'
const SETTINGS = 'settings'

export const DEFAULT_CHAT_PATH = '/chat/completions'

export function createProfile(
  input: Partial<ProviderProfile> = {},
): ProviderProfile {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: input.name ?? '',
    kind: input.kind ?? 'openai-compatible',
    baseUrl: input.baseUrl ?? '',
    model: input.model ?? '',
    chatPath: input.chatPath ?? DEFAULT_CHAT_PATH,
    temperature: input.temperature ?? 0.7,
    maxTokens: input.maxTokens ?? 2048,
    timeoutMs: input.timeoutMs ?? 60_000,
    stream: input.stream ?? true,
    ...(input.verifiedAt ? { verifiedAt: input.verifiedAt } : {}),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      if (!db.objectStoreNames.contains(SETTINGS)) {
        db.createObjectStore(SETTINGS)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readAll(): Promise<ProviderProfile[]> {
  const db = await openDatabase()
  try {
    return await new Promise<ProviderProfile[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).getAll()
      request.onsuccess = () => resolve(request.result as ProviderProfile[])
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function write(profile: ProviderProfile): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(profile, profile.id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

async function remove(id: string): Promise<void> {
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
}

/** Non-secret UI state, such as which profile is selected. */
export async function readActiveProfileId(): Promise<string | undefined> {
  const db = await openDatabase()
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(SETTINGS, 'readonly')
      const request = tx.objectStore(SETTINGS).get('activeProfileId')
      request.onsuccess = () => resolve(request.result as string | undefined)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function writeActiveProfileId(
  id: string | undefined,
): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SETTINGS, 'readwrite')
      const store = tx.objectStore(SETTINGS)
      if (id) store.put(id, 'activeProfileId')
      else store.delete('activeProfileId')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/**
 * Profile store with a small subscription so the settings page and the chat
 * view stay in step without a framework.
 */
class ProfileStore {
  private profiles: ProviderProfile[] = []
  private activeId: string | undefined
  private listeners = new Set<() => void>()

  async load(): Promise<void> {
    this.profiles = (await readAll()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )
    this.activeId = await readActiveProfileId()
    if (this.activeId && !this.profiles.some(p => p.id === this.activeId)) {
      this.activeId = undefined
    }
    this.emit()
  }

  list(): readonly ProviderProfile[] {
    return this.profiles
  }

  get(id: string): ProviderProfile | undefined {
    return this.profiles.find(profile => profile.id === id)
  }

  active(): ProviderProfile | undefined {
    return this.activeId ? this.get(this.activeId) : undefined
  }

  activeIdValue(): string | undefined {
    return this.activeId
  }

  async save(profile: ProviderProfile): Promise<void> {
    const next = { ...profile, updatedAt: new Date().toISOString() }
    await write(next)
    const index = this.profiles.findIndex(item => item.id === next.id)
    if (index >= 0) this.profiles[index] = next
    else this.profiles.push(next)
    if (!this.activeId) await this.setActive(next.id)
    this.emit()
  }

  async delete(id: string): Promise<void> {
    await remove(id)
    this.profiles = this.profiles.filter(profile => profile.id !== id)
    if (this.activeId === id) {
      await this.setActive(this.profiles[0]?.id)
    }
    this.emit()
  }

  async setActive(id: string | undefined): Promise<void> {
    this.activeId = id
    await writeActiveProfileId(id)
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

export const providerStore = new ProfileStore()
