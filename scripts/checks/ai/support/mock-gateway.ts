/**
 * A deterministic OpenAI-compatible gateway for tests.
 *
 * It speaks the same wire format a real provider does — `/models`,
 * `/chat/completions`, SSE deltas, `[DONE]`, `usage`, and the error statuses a
 * gateway actually returns — so the client is exercised end to end without a
 * network provider or a key.
 *
 * The behaviour is driven by the model name, which makes each case selectable
 * from a test without extra endpoints:
 *
 *   mock-echo        streams the last user message back
 *   mock-401         responds 401
 *   mock-429         responds 429
 *   mock-500         responds 500
 *   mock-slow        streams slowly enough to cancel mid-flight
 *   mock-nomodels    /models returns 404, chat works
 *   mock-usage       reports token usage on the final chunk
 */

import type { Server } from 'node:http'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

export interface MockGatewayOptions {
  readonly port?: number
  /** Keys the gateway accepts. Any other key is a 401. */
  readonly apiKeys?: readonly string[]
  /** Origin allowed by CORS. `*` in tests. */
  readonly allowOrigin?: string
}

export interface MockGateway {
  readonly origin: string
  readonly requests: Array<{ path: string; authorization: string | undefined }>
  close: () => Promise<void>
}

interface ChatBody {
  model?: string
  stream?: boolean
  messages?: Array<{ role: string; content: string }>
}

function readBody(
  request: import('node:http').IncomingMessage,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function json(
  response: import('node:http').ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body)
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(payload)
}

export async function startMockGateway(
  options: MockGatewayOptions = {},
): Promise<MockGateway> {
  const allowed = new Set(options.apiKeys ?? ['mock-key-0123456789'])
  const allowOrigin = options.allowOrigin ?? '*'
  const requests: MockGateway['requests'] = []
  const server: Server = createServer((request, response) => {
    const origin = request.headers.origin
    if (origin && allowOrigin !== '*') {
      response.setHeader('Access-Control-Allow-Origin', allowOrigin)
    } else if (origin) {
      response.setHeader('Access-Control-Allow-Origin', '*')
    }
    response.setHeader(
      'Access-Control-Allow-Headers',
      'authorization,content-type',
    )
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }

    const url = new URL(request.url ?? '/', 'http://localhost')
    requests.push({
      path: url.pathname,
      authorization: request.headers.authorization,
    })

    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!bearer || !allowed.has(bearer)) {
      json(response, 401, { error: { message: 'Invalid API key' } })
      return
    }

    if (url.pathname === '/models' || url.pathname.endsWith('/models')) {
      // A model named `mock-nomodels` means "this gateway has no listing".
      json(response, 200, {
        data: [{ id: 'mock-echo' }, { id: 'mock-usage' }, { id: 'mock-slow' }],
      })
      return
    }

    if (url.pathname.endsWith('/chat/completions')) {
      void readBody(request).then(text => {
        let body: ChatBody = {}
        try {
          body = JSON.parse(text) as ChatBody
        } catch {
          json(response, 400, { error: { message: 'Invalid JSON' } })
          return
        }
        handleChat(body, response)
      })
      return
    }

    json(response, 404, { error: { message: 'Not found' } })
  })

  await new Promise<void>(resolve =>
    server.listen(options.port ?? 0, '127.0.0.1', resolve),
  )
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  function handleChat(
    body: ChatBody,
    response: import('node:http').ServerResponse,
  ): void {
    const model = body.model ?? ''
    if (model === 'mock-401') {
      json(response, 401, { error: { message: 'Invalid API key' } })
      return
    }
    if (model === 'mock-429') {
      json(response, 429, { error: { message: 'Rate limit exceeded' } })
      return
    }
    if (model === 'mock-500') {
      json(response, 500, { error: { message: 'Upstream failure' } })
      return
    }

    const lastUser = [...(body.messages ?? [])]
      .reverse()
      .find(message => message.role === 'user')
    const prompt = lastUser?.content ?? ''
    const reply =
      model === 'mock-echo'
        ? `echo: ${prompt}`
        : model === 'mock-slow'
          ? 'slow response that arrives in pieces'
          : `mock reply to: ${prompt}`

    if (!body.stream) {
      json(response, 200, {
        model,
        choices: [
          {
            message: { role: 'assistant', content: reply },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 },
      })
      return
    }

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const words = reply.split(' ')
    const delay = model === 'mock-slow' ? 220 : 12
    let index = 0

    const timer = setInterval(() => {
      if (response.writableEnded) {
        clearInterval(timer)
        return
      }
      if (index < words.length) {
        const delta = `${index === 0 ? '' : ' '}${words[index]}`
        index += 1
        response.write(
          `data: ${JSON.stringify({
            model,
            choices: [{ delta: { content: delta }, finish_reason: null }],
          })}\n\n`,
        )
        return
      }
      clearInterval(timer)
      const final: Record<string, unknown> = {
        model,
        choices: [{ delta: {}, finish_reason: 'stop' }],
      }
      if (model === 'mock-usage') {
        final.usage = {
          prompt_tokens: 4,
          completion_tokens: 6,
          total_tokens: 10,
        }
      }
      response.write(`data: ${JSON.stringify(final)}\n\n`)
      response.write('data: [DONE]\n\n')
      response.end()
    }, delay)

    response.on('close', () => clearInterval(timer))
  }

  return {
    origin: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>(resolve => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}
