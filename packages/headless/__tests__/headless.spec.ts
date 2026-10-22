import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('@zeus-web/headless entry', () => {
  it('aggregates the custom element entry for every primitive package', () => {
    const workspaceRoot = existsSync(
      resolve(process.cwd(), 'pnpm-workspace.yaml'),
    )
      ? process.cwd()
      : resolve(process.cwd(), '../..')
    const primitiveRoot = resolve(workspaceRoot, 'packages/primitives')
    const primitives = readdirSync(primitiveRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .flatMap(entry => {
        const packagePath = resolve(primitiveRoot, entry.name, 'package.json')
        try {
          const packageJson = JSON.parse(
            readFileSync(packagePath, 'utf-8'),
          ) as {
            name: string
          }
          return [{ name: packageJson.name, slug: entry.name }]
        } catch {
          return []
        }
      })

    const headlessSource = readFileSync(
      resolve(workspaceRoot, 'packages/headless/src/index.ts'),
      'utf-8',
    )
    const headlessPackage = JSON.parse(
      readFileSync(
        resolve(workspaceRoot, 'packages/headless/package.json'),
        'utf-8',
      ),
    ) as { dependencies: Record<string, string> }
    const reactSource = readFileSync(
      resolve(workspaceRoot, 'packages/react/src/index.ts'),
      'utf-8',
    )
    const reactPackage = JSON.parse(
      readFileSync(
        resolve(workspaceRoot, 'packages/react/package.json'),
        'utf-8',
      ),
    ) as { dependencies: Record<string, string> }
    const vueSource = readFileSync(
      resolve(workspaceRoot, 'packages/vue/src/index.ts'),
      'utf-8',
    )
    const vuePackage = JSON.parse(
      readFileSync(
        resolve(workspaceRoot, 'packages/vue/package.json'),
        'utf-8',
      ),
    ) as { dependencies: Record<string, string> }

    for (const primitive of primitives) {
      expect(headlessSource).toContain(`import '${primitive.name}/wc/auto'`)
      expect(headlessPackage.dependencies).toHaveProperty(primitive.name)
      expect(reactSource).toContain(`export * from '${primitive.name}/react'`)
      expect(reactPackage.dependencies).toHaveProperty(primitive.name)
      expect(vueSource).toContain(`export * from '${primitive.name}/vue'`)
      expect(vuePackage.dependencies).toHaveProperty(primitive.name)
    }
  })
})
