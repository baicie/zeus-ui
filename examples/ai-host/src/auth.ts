import type { Buffer } from 'node:buffer'
import { createHash, timingSafeEqual } from 'node:crypto'

export type AiRole = 'viewer' | 'editor' | 'approver' | 'admin'

export interface AiPrincipal {
  readonly tenantId: string
  readonly userId: string
  readonly role: AiRole
}

export interface AiTokenConfig extends AiPrincipal {
  readonly token: string
}

export interface AiTokenRecord {
  readonly tokenHash: Buffer
  readonly principal: AiPrincipal
}

const ROLES = new Set<AiRole>(['viewer', 'editor', 'approver', 'admin'])

/**
 * Tokens are supplied by the trusted deployment boundary (ingress or process
 * environment). They are never accepted from the browser as a provider key.
 */
export function parseAiTokens(
  value: string | undefined,
): readonly AiTokenRecord[] {
  if (!value) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(value) as unknown
  } catch {
    throw new Error('ZEUS_AI_TOKENS must be valid JSON')
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError('ZEUS_AI_TOKENS must be an array')
  }
  return parsed.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`ZEUS_AI_TOKENS[${index}] must be an object`)
    }
    const token = entry.token
    const tenantId = entry.tenantId
    const userId = entry.userId
    const role = entry.role
    if (
      typeof token !== 'string' ||
      token.length < 16 ||
      typeof tenantId !== 'string' ||
      tenantId.length === 0 ||
      typeof userId !== 'string' ||
      userId.length === 0 ||
      typeof role !== 'string' ||
      !ROLES.has(role as AiRole)
    ) {
      throw new Error(`ZEUS_AI_TOKENS[${index}] has an invalid shape`)
    }
    return {
      tokenHash: hashToken(token),
      principal: {
        tenantId,
        userId,
        role: role as AiRole,
      },
    }
  })
}

export function tokenRecordsFromConfig(
  configs: readonly AiTokenConfig[],
): readonly AiTokenRecord[] {
  return configs.map(config => ({
    tokenHash: hashToken(config.token),
    principal: {
      tenantId: config.tenantId,
      userId: config.userId,
      role: config.role,
    },
  }))
}

export function authenticateBearer(
  request: import('node:http').IncomingMessage,
  records: readonly AiTokenRecord[],
): AiPrincipal | undefined {
  const header = request.headers.authorization
  const value = Array.isArray(header) ? header[0] : header
  if (!value || !value.startsWith('Bearer ')) return undefined
  const candidate = hashToken(value.slice('Bearer '.length).trim())
  let match: AiPrincipal | undefined
  for (const record of records) {
    if (
      candidate.length === record.tokenHash.length &&
      timingSafeEqual(candidate, record.tokenHash)
    ) {
      match = record.principal
    }
  }
  return match
}

export function requireAiRole(
  principal: AiPrincipal,
  roles: readonly AiRole[],
): boolean {
  return roles.includes(principal.role)
}

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
