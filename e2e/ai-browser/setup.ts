import { resolve } from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

export const AI_E2E_PORT = Number(process.env.AI_E2E_PORT || 5195)

/** Serve the AI showcase (stories S1/S2/S3) for the browser E2E project. */
export default function setup(): Promise<() => Promise<void>> {
  const root = resolve(process.cwd(), 'examples/ai-showcase')
  return createServer({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    server: { host: '127.0.0.1', port: AI_E2E_PORT, strictPort: true },
    logLevel: 'warn',
  })
    .then(server => server.listen())
    .then(server => () => server.close())
}
