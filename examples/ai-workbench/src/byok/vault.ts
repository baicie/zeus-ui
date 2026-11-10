/**
 * Browser-side encrypted vault for provider API keys.
 *
 * The threat model this addresses is narrow and worth stating plainly:
 *
 * - **Protected:** data at rest. A key written here is ciphertext in IndexedDB.
 *   Someone reading the database file, a synced browser profile, or a disk
 *   image gets nothing without the passphrase.
 * - **NOT protected:** anything running in this origin while the vault is
 *   unlocked. Same-origin script (an XSS, a compromised dependency) can call
 *   `unlock()` too. Browser-side encryption raises the cost of offline theft;
 *   it is not a defence against a compromised page.
 *
 * Design:
 * - AES-GCM with a 256-bit key derived per unlock by PBKDF2-SHA-256 from the
 *   passphrase and a per-vault random salt.
 * - Every record carries its own random 96-bit IV. Reusing an IV under one key
 *   would break GCM, so the IV is generated per write and stored beside the
 *   ciphertext.
 * - The derived key lives only in memory, inside this module's closure. It is
 *   never written anywhere, and `lock()` drops it.
 * - The passphrase and the plaintext key are never persisted, logged, or put
 *   in a URL.
 * - A verifier record (a known plaintext encrypted under the same key) lets a
 *   wrong passphrase fail loudly at unlock time instead of at first use.
 */

const DB_NAME = 'zeus-byok-vault'
const DB_VERSION = 1
const RECORD_STORE = 'records'
const META_STORE = 'meta'

/** Bumped when the envelope changes shape; old records then fail closed. */
const ENVELOPE_VERSION = 1

/** PBKDF2 cost. 310k iterations matches OWASP's 2023 guidance for SHA-256. */
const PBKDF2_ITERATIONS = 310_000

const VERIFIER_PLAINTEXT = 'zeus-byok-vault-verifier'

export interface VaultEnvelope {
  readonly version: typeof ENVELOPE_VERSION
  /** Base64 salt for PBKDF2. Per vault, generated once. */
  readonly salt: string
  /** Base64 IV for AES-GCM. Unique per record. */
  readonly iv: string
  /** Base64 ciphertext. */
  readonly data: string
}

export type VaultStatus = 'empty' | 'locked' | 'unlocked'

export interface VaultState {
  readonly status: VaultStatus
  /** True once a passphrase has been set on this browser. */
  readonly initialized: boolean
}

export class VaultLockedError extends Error {
  constructor() {
    super('The vault is locked. Unlock it before using saved keys.')
    this.name = 'VaultLockedError'
  }
}

export class VaultPassphraseError extends Error {
  constructor() {
    super('That passphrase does not open this vault.')
    this.name = 'VaultPassphraseError'
  }
}

/* ---------------------------------------------------------------- crypto */

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptString(
  key: CryptoKey,
  salt: string,
  plaintext: string,
): Promise<VaultEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  )
  return {
    version: ENVELOPE_VERSION,
    salt,
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  }
}

async function decryptString(
  key: CryptoKey,
  envelope: VaultEnvelope,
): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(envelope.iv) as unknown as BufferSource,
    },
    key,
    fromBase64(envelope.data) as unknown as BufferSource,
  )
  return new TextDecoder().decode(plain)
}

/* -------------------------------------------------------------- idb glue */

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        db.createObjectStore(RECORD_STORE)
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDatabase()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(store, 'readonly')
      const request = tx.objectStore(store).get(key)
      request.onsuccess = () => resolve(request.result as T | undefined)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function idbSet(
  store: string,
  key: string,
  value: unknown,
): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

async function idbKeys(store: string): Promise<string[]> {
  const db = await openDatabase()
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(store, 'readonly')
      const request = tx.objectStore(store).getAllKeys()
      request.onsuccess = () => resolve(request.result.map(String))
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function idbClear(store: string): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/* ----------------------------------------------------------------- vault */

/**
 * The vault is a single module-level instance. `key` is the only thing that
 * unlocks it and it never leaves this closure.
 */
class Vault {
  private key: CryptoKey | null = null
  private salt: string | null = null
  private listeners = new Set<(state: VaultState) => void>()
  private state: VaultState = { status: 'empty', initialized: false }

  /** Reads persisted metadata so the UI knows whether to offer setup. */
  async refresh(): Promise<VaultState> {
    const salt = await idbGet<string>(META_STORE, 'salt')
    this.state = {
      status: this.key ? 'unlocked' : salt ? 'locked' : 'empty',
      initialized: Boolean(salt),
    }
    return this.state
  }

  getState(): VaultState {
    return this.state
  }

  subscribe(listener: (state: VaultState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state)
  }

  /** Creates the vault with a fresh salt. Fails if one already exists. */
  async initialize(passphrase: string): Promise<void> {
    if (passphrase.length < 8) {
      throw new Error('Use a passphrase of at least 8 characters.')
    }
    const existing = await idbGet<string>(META_STORE, 'salt')
    if (existing) throw new Error('This browser already has a vault.')
    const saltBytes = crypto.getRandomValues(new Uint8Array(16))
    const salt = toBase64(saltBytes)
    const key = await deriveKey(passphrase, saltBytes)
    // Prove the key works before committing the salt, so a failure cannot
    // leave a vault that no passphrase opens.
    const verifier = await encryptString(key, salt, VERIFIER_PLAINTEXT)
    await idbSet(META_STORE, 'salt', salt)
    await idbSet(META_STORE, 'verifier', verifier)
    this.key = key
    this.salt = salt
    this.state = { status: 'unlocked', initialized: true }
    this.emit()
  }

  /** Derives the key and checks it against the verifier record. */
  async unlock(passphrase: string): Promise<void> {
    const salt = await idbGet<string>(META_STORE, 'salt')
    const verifier = await idbGet<VaultEnvelope>(META_STORE, 'verifier')
    if (!salt || !verifier) throw new Error('There is no vault to unlock.')
    const key = await deriveKey(passphrase, fromBase64(salt))
    let opened: string
    try {
      opened = await decryptString(key, verifier)
    } catch {
      // A GCM authentication failure is indistinguishable from a wrong key, by
      // design. Report it as a passphrase problem.
      throw new VaultPassphraseError()
    }
    if (opened !== VERIFIER_PLAINTEXT) throw new VaultPassphraseError()
    this.key = key
    this.salt = salt
    this.state = { status: 'unlocked', initialized: true }
    this.emit()
  }

  /** Drops the derived key. Ciphertext stays; a passphrase is needed again. */
  lock(): void {
    this.key = null
    this.state = {
      status: this.salt ? 'locked' : 'empty',
      initialized: Boolean(this.salt),
    }
    this.emit()
  }

  /** Re-encrypts every record under a new passphrase. */
  async changePassphrase(current: string, next: string): Promise<void> {
    if (next.length < 8) {
      throw new Error('Use a passphrase of at least 8 characters.')
    }
    await this.unlock(current)
    const plaintexts = await this.readAllDecrypted()
    const saltBytes = crypto.getRandomValues(new Uint8Array(16))
    const salt = toBase64(saltBytes)
    const key = await deriveKey(next, saltBytes)
    const verifier = await encryptString(key, salt, VERIFIER_PLAINTEXT)
    await idbClear(RECORD_STORE)
    await idbSet(META_STORE, 'salt', salt)
    await idbSet(META_STORE, 'verifier', verifier)
    for (const [id, value] of plaintexts) {
      await idbSet(RECORD_STORE, id, await encryptString(key, salt, value))
    }
    this.key = key
    this.salt = salt
    this.state = { status: 'unlocked', initialized: true }
    this.emit()
  }

  private async readAllDecrypted(): Promise<Array<[string, string]>> {
    const ids = await idbKeys(RECORD_STORE)
    const out: Array<[string, string]> = []
    for (const id of ids) {
      const envelope = await idbGet<VaultEnvelope>(RECORD_STORE, id)
      if (!envelope) continue
      out.push([id, await this.decryptWith(envelope)])
    }
    return out
  }

  private decryptWith(envelope: VaultEnvelope): Promise<string> {
    const key = this.key
    if (!key) return Promise.reject(new VaultLockedError())
    return decryptString(key, envelope)
  }

  /** Encrypts a value under the open vault. */
  async put(id: string, value: string): Promise<void> {
    const key = this.key
    const salt = this.salt
    if (!key || !salt) throw new VaultLockedError()
    await idbSet(RECORD_STORE, id, await encryptString(key, salt, value))
  }

  /** Decrypts one value; rejects when locked. */
  async get(id: string): Promise<string | undefined> {
    const envelope = await idbGet<VaultEnvelope>(RECORD_STORE, id)
    if (!envelope) return undefined
    return this.decryptWith(envelope)
  }

  async delete(id: string): Promise<void> {
    await idbDelete(RECORD_STORE, id)
  }

  /** Removes every record and the salt, returning the vault to setup. */
  async destroy(): Promise<void> {
    await idbClear(RECORD_STORE)
    await idbClear(META_STORE)
    this.key = null
    this.salt = null
    this.state = { status: 'empty', initialized: false }
    this.emit()
  }

  /**
   * True when a ciphertext exists but cannot be opened, which is what a
   * corrupted or version-mismatched record looks like.
   */
  async isReadable(id: string): Promise<boolean> {
    try {
      await this.get(id)
      return true
    } catch {
      return false
    }
  }
}

export const vault = new Vault()
