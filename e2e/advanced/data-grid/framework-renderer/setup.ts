import { resolve } from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

export default async function setup() {
  const root = resolve(
    process.cwd(),
    'e2e/advanced/data-grid/framework-renderer',
  )
  const server = await createServer({
    root,
    configFile: resolve(root, 'vite.config.ts'),
  })
  await server.listen()

  return async () => {
    await server.close()
  }
}
