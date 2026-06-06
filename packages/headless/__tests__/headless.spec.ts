import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('@zeus-web/headless entry', () => {
  it('registers all MVP primitive wc entries by side effect', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'packages/headless/src/index.ts'),
      'utf-8',
    )

    const entries = ['button', 'checkbox', 'dialog', 'input', 'switch', 'tabs']

    for (const name of entries) {
      expect(source).toContain(`import '@zeus-web/${name}/wc'`)
    }
  })
})
