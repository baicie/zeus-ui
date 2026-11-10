/**
 * OpenAI-compatible chat client.
 *
 * This is the only module that talks to a user-supplied gateway. It is kept
 * apart from the AI Headless controllers on purpose: a BYOK request is *not* an
 * agent command, and must never be dressed up as one. The Host's snapshot and
 * SSE stream stay the authority for agent state; these messages are local to
 * the browser.
 *
 * What it handles:
 * - plain and `stream: true` requests
 * - SSE frame assembly across chunk boundaries, `[DONE]`, and `finish_reason`
 * - `usage` when the gateway reports it
 * - cancellation through `AbortSignal`
 * - HTTP and network failures mapped to messages a person can act on
 *
 * The key is passed in by the caller and used exactly once, in the
 * `Authorization` header of the request it belongs to. It is not stored here.
 */

import type { ProviderProfile } from './profiles'
import { beginAttempt, cspBlockedFor } from './csp'
import { DEFAULT_CHAT_PATH } from './profiles'

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

export interface ChatUsage {
  readonly promptTokens?: number
  readonly completionTokens?: number
  readonly totalTokens?: number
}

export interface ChatResult {
  readonly text: string
  readonly finishReason: string | null
  readonly usage?: ChatUsage
  readonly model?: string
}

export interface StreamHandlers {
  /** Called with the accumulated text so far, not the delta. */
  readonly onText?: (accumulated: string) => void
  readonly onUsage?: (usage: ChatUsage) => void
}

/** A failure with a message written for the person configuring the gateway. */
export class GatewayError extends Error {
  readonly status: number | undefined
  readonly hint: string | undefined
  constructor(
    message: string,
    options: { status?: number; hint?: string } = {},
  ) {
    super(message)
    this.name = 'GatewayError'
    this.status = options.status
    this.hint = options.hint
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

function endpoint(profile: ProviderProfile): string {
  return joinUrl(profile.baseUrl, profile.chatPath || DEFAULT_CHAT_PATH)
}

function modelsEndpoint(profile: ProviderProfile): string {
  return joinUrl(profile.baseUrl, '/models')
}

/**
 * Turns a non-2xx response into a sentence plus a hint about what to change.
 * The gateway's own error text is included when it is short and textual, but
 * never when it looks like a key echo.
 */
async function describeFailure(
  response: Response,
  kind: 'chat' | 'models',
): Promise<GatewayError> {
  let detail = ''
  try {
    const text = await response.text()
    const parsed = JSON.parse(text) as {
      error?: { message?: string }
      message?: string
    }
    detail = parsed.error?.message ?? parsed.message ?? ''
    if (!detail) detail = text.slice(0, 200)
  } catch {
    // A non-JSON body is not worth surfacing verbatim.
  }
  // Never echo something that looks like the credential back to the page.
  detail = detail.replace(/(sk-|Bearer\s+)\S+/gi, '[redacted]').trim()

  const base = kind === 'models' ? 'Could not list models' : 'Request failed'
  switch (response.status) {
    case 401:
      return new GatewayError(
        `${base}: the gateway rejected the API key (401).`,
        {
          status: 401,
          hint: 'Check the key, and that it belongs to this gateway.',
        },
      )
    case 403:
      return new GatewayError(
        `${base}: this key is not allowed to use that model (403).`,
        { status: 403, hint: 'Ask the gateway owner to enable the model.' },
      )
    case 404:
      return new GatewayError(
        `${base}: the endpoint or model was not found (404).`,
        {
          status: 404,
          hint:
            kind === 'models'
              ? 'This gateway may not expose /models. Enter the model id manually.'
              : 'Check the base URL, the custom path, and the model id.',
        },
      )
    case 429:
      return new GatewayError(`${base}: rate limited (429).`, {
        status: 429,
        hint: 'Wait, or raise the limit on the gateway.',
      })
    default:
      if (response.status >= 500) {
        return new GatewayError(
          `${base}: the gateway returned ${response.status}.`,
          { status: response.status, hint: detail || 'Try again shortly.' },
        )
      }
      return new GatewayError(
        `${base}: ${response.status}${detail ? ` — ${detail}` : ''}.`,
        { status: response.status, hint: detail || undefined },
      )
  }
}

/** True when the failure is a browser CORS rejection rather than HTTP. */
function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    !(error instanceof GatewayError) &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}

/**
 * Explains a request the page's own Content-Security-Policy stopped.
 *
 * This is a deployment problem, not a gateway problem, and the message says so:
 * telling someone to fix CORS when CSP is the blocker sends them to the wrong
 * place entirely.
 */
function cspHint(target: string): GatewayError {
  return new GatewayError(
    `The deployment's Content-Security-Policy blocked the request to ${target}.`,
    {
      hint: 'This page is not allowed to open connections to that origin. The operator must add it to the workbench connect-src policy, or point BYOK at a relay that is already allowed.',
    },
  )
}

function corsHint(target: string): GatewayError {
  return new GatewayError(`The browser could not reach ${target}.`, {
    hint:
      'This is usually a CORS rejection: the gateway did not allow this page as an origin. ' +
      'Use a gateway that permits browser origins, or route requests through a trusted proxy you control.',
  })
}

async function request(
  profile: ProviderProfile,
  apiKey: string,
  body: unknown,
  signal: AbortSignal,
  kind: 'chat' | 'models',
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), profile.timeoutMs)
  const onAbort = (): void => controller.abort()
  signal.addEventListener('abort', onAbort, { once: true })
  const url = kind === 'models' ? modelsEndpoint(profile) : endpoint(profile)
  // Clear stale violations so only this attempt's can be attributed.
  beginAttempt()
  try {
    const response = await fetch(url, {
      method: 'GET',
      ...(kind === 'chat'
        ? {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
          }
        : { headers: { Authorization: `Bearer ${apiKey}` } }),
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (signal.aborted) throw error
    if (controller.signal.aborted) {
      throw new GatewayError(
        `The request timed out after ${Math.round(profile.timeoutMs / 1000)}s.`,
        { hint: 'Raise the timeout, or reduce the max output tokens.' },
      )
    }
    if (isNetworkFailure(error)) {
      // A blocked `fetch` and a CORS rejection look identical to the caller.
      // The violation event tells them apart, and the fix differs: one is the
      // deployment's `connect-src`, the other is the gateway's allowlist.
      //
      // The event is dispatched on a task boundary in some engines, so give it
      // one turn before deciding. Without this the CSP case falls through to
      // the CORS message, which sends the reader to the wrong fix.
      const target =
        kind === 'models' ? modelsEndpoint(profile) : endpoint(profile)
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      if (cspBlockedFor(target)) throw cspHint(target)
      throw corsHint(target)
    }
    throw error
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}

/* ------------------------------------------------------------ SSE parser */

interface SseFrame {
  readonly event: string | undefined
  readonly data: string
}

/**
 * Incremental SSE parser. Chunks arrive at arbitrary boundaries, so a partial
 * frame is buffered until its terminating blank line.
 */
function createSseDecoder(): (chunk: string) => SseFrame[] {
  let buffer = ''
  return (chunk: string): SseFrame[] => {
    buffer += chunk
    const frames: SseFrame[] = []
    let boundary = findBoundary(buffer)
    while (boundary) {
      const raw = buffer.slice(0, boundary.index)
      buffer = buffer.slice(boundary.index + boundary.length)
      const frame = parseFrame(raw)
      if (frame) frames.push(frame)
      boundary = findBoundary(buffer)
    }
    return frames
  }
}

/** Finds the next blank line, tolerating CRLF, LF and CR. */
function findBoundary(
  text: string,
): { index: number; length: number } | undefined {
  const match = /\r\n\r\n|\n\n|\r\r/.exec(text)
  if (!match) return undefined
  return { index: match.index, length: match[0].length }
}

function parseFrame(raw: string): SseFrame | undefined {
  let event: string | undefined
  const data: string[] = []
  for (const line of raw.split(/\r\n|\n|\r/)) {
    if (line.length === 0 || line.startsWith(':')) continue
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    // A single leading space after the colon is part of the framing.
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }
  if (data.length === 0) return undefined
  return { event, data: data.join('\n') }
}

interface ChunkPayload {
  choices?: Array<{
    delta?: { content?: string | null; role?: string }
    finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  model?: string
  error?: { message?: string }
}

function toUsage(usage: ChunkPayload['usage']): ChatUsage | undefined {
  if (!usage) return undefined
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  }
}

/* ----------------------------------------------------------------- public */

/**
 * Sends a chat request. When `profile.stream` is set the response is consumed
 * as SSE and `handlers.onText` receives the running total; otherwise the whole
 * message is returned at once.
 */
export async function sendChat(
  profile: ProviderProfile,
  apiKey: string,
  messages: readonly ChatMessage[],
  signal: AbortSignal,
  handlers: StreamHandlers = {},
): Promise<ChatResult> {
  if (!profile.baseUrl.trim()) {
    throw new GatewayError('No gateway URL is configured.', {
      hint: 'Open Settings → Model providers and add one.',
    })
  }
  if (!profile.model.trim()) {
    throw new GatewayError('No model id is configured.', {
      hint: 'Pick a model from the list, or type one.',
    })
  }

  const body = {
    model: profile.model,
    messages,
    temperature: profile.temperature,
    max_tokens: profile.maxTokens,
    stream: profile.stream,
  }

  const response = await request(profile, apiKey, body, signal, 'chat')
  if (!response.ok) throw await describeFailure(response, 'chat')

  if (!profile.stream) {
    const payload = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string }
        finish_reason?: string | null
      }>
      usage?: ChunkPayload['usage']
      model?: string
      error?: { message?: string }
    }
    if (payload.error?.message) {
      throw new GatewayError(payload.error.message)
    }
    const choice = payload.choices?.[0]
    const text = choice?.message?.content ?? ''
    const usage = toUsage(payload.usage)
    if (usage) handlers.onUsage?.(usage)
    handlers.onText?.(text)
    return {
      text,
      finishReason: choice?.finish_reason ?? null,
      ...(usage ? { usage } : {}),
      ...(payload.model ? { model: payload.model } : {}),
    }
  }

  return consumeStream(response, signal, handlers)
}

async function consumeStream(
  response: Response,
  signal: AbortSignal,
  handlers: StreamHandlers,
): Promise<ChatResult> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new GatewayError('The gateway returned no response body.', {
      hint: 'Turn streaming off in the provider settings.',
    })
  }
  const decoder = new TextDecoder()
  const parse = createSseDecoder()
  let text = ''
  let finishReason: string | null = null
  let usage: ChatUsage | undefined
  let model: string | undefined
  let done = false

  try {
    while (!done) {
      const { value, done: exhausted } = await reader.read()
      if (exhausted) break
      for (const frame of parse(decoder.decode(value, { stream: true }))) {
        if (frame.data === '[DONE]') {
          done = true
          break
        }
        let payload: ChunkPayload
        try {
          payload = JSON.parse(frame.data) as ChunkPayload
        } catch {
          // A keep-alive comment or a non-JSON frame; skip it.
          continue
        }
        if (payload.error?.message) {
          throw new GatewayError(payload.error.message)
        }
        if (payload.model) model = payload.model
        const reported = toUsage(payload.usage)
        if (reported) {
          usage = reported
          handlers.onUsage?.(reported)
        }
        const choice = payload.choices?.[0]
        const delta = choice?.delta?.content
        if (typeof delta === 'string' && delta.length > 0) {
          text += delta
          handlers.onText?.(text)
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason
      }
    }
  } finally {
    reader.cancel().catch(() => undefined)
  }

  if (signal.aborted) {
    // Return what arrived so the caller can keep a partial answer.
    return {
      text,
      finishReason: finishReason ?? 'aborted',
      ...(usage ? { usage } : {}),
      ...(model ? { model } : {}),
    }
  }

  return {
    text,
    finishReason,
    ...(usage ? { usage } : {}),
    ...(model ? { model } : {}),
  }
}

export interface ConnectionCheck {
  readonly ok: boolean
  readonly models: readonly string[]
  readonly error?: GatewayError
}

/**
 * Proves the configured gateway, key and model actually work.
 *
 * `/models` is tried first because it is cheap and separates "wrong key" from
 * "wrong model". A gateway that does not implement it is not an error: the
 * check falls back to a one-token chat request.
 */
export async function testConnection(
  profile: ProviderProfile,
  apiKey: string,
  signal: AbortSignal,
): Promise<ConnectionCheck> {
  const listResponse = await request(
    profile,
    apiKey,
    undefined,
    signal,
    'models',
  ).catch((error: unknown) => {
    if (error instanceof GatewayError) throw error
    throw corsHint(modelsEndpoint(profile))
  })

  if (listResponse.ok) {
    const payload = (await listResponse.json()) as {
      data?: Array<{ id?: string }>
    }
    const models = (payload.data ?? [])
      .map(entry => entry.id)
      .filter((id): id is string => typeof id === 'string')
    return { ok: true, models }
  }

  if (listResponse.status === 401 || listResponse.status === 403) {
    return {
      ok: false,
      models: [],
      error: await describeFailure(listResponse, 'models'),
    }
  }

  // 404 or 501: the gateway has no model listing. Verify with a real call.
  if (listResponse.status === 404 || listResponse.status === 501) {
    try {
      await sendChat(
        { ...profile, stream: false, maxTokens: 1 },
        apiKey,
        [{ role: 'user', content: 'ping' }],
        signal,
      )
      return { ok: true, models: [] }
    } catch (error) {
      return {
        ok: false,
        models: [],
        error:
          error instanceof GatewayError
            ? error
            : new GatewayError(String(error)),
      }
    }
  }

  return {
    ok: false,
    models: [],
    error: await describeFailure(listResponse, 'models'),
  }
}

/** Lists models for the settings picker; never throws. */
export async function listModels(
  profile: ProviderProfile,
  apiKey: string,
  signal: AbortSignal,
): Promise<readonly string[]> {
  try {
    const response = await request(profile, apiKey, undefined, signal, 'models')
    if (!response.ok) return []
    const payload = (await response.json()) as {
      data?: Array<{ id?: string }>
    }
    return (payload.data ?? [])
      .map(entry => entry.id)
      .filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}
