import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('@zeus-web/headless entry', () => {
  it('imports all MVP primitive auto-registration entries', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'packages/headless/src/index.ts'),
      'utf-8',
    )

    expect(source).toContain("import '@zeus-web/button/wc/auto'")
    expect(source).toContain("import '@zeus-web/checkbox/wc/auto'")
    expect(source).toContain("import '@zeus-web/dialog/wc/auto'")
    expect(source).toContain("import '@zeus-web/input/wc/auto'")
    expect(source).toContain("import '@zeus-web/switch/wc/auto'")
    expect(source).toContain("import '@zeus-web/tabs/wc/auto'")
  })
})
