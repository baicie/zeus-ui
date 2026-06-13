import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(testDir, '..')

function read(relativePath: string): string {
  return readFileSync(resolve(packageRoot, relativePath), 'utf-8')
}

describe('@zeus-web/ui package contract', () => {
  it('declares native styled web component exports', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      name: string
      exports: Record<string, unknown>
      dependencies: Record<string, string>
    }

    expect(packageJson.name).toBe('@zeus-web/ui')
    expect(packageJson.exports).toHaveProperty('.')
    expect(packageJson.exports).toHaveProperty('./styles.css')
    expect(packageJson.exports).toHaveProperty('./button')
    expect(packageJson.exports).toHaveProperty('./button.css')
    expect(packageJson.exports).toHaveProperty('./input')
    expect(packageJson.exports).toHaveProperty('./input.css')

    expect(packageJson.dependencies).toHaveProperty('@zeus-web/button')
    expect(packageJson.dependencies).toHaveProperty('@zeus-web/input')
    expect(packageJson.dependencies).toHaveProperty('@zeus-web/themes')
  })

  it('keeps native entries styled by default', () => {
    expect(read('src/button.ts')).toContain(
      "import '@zeus-web/themes/default.css'",
    )
    expect(read('src/button.ts')).toContain("import './button.css'")
    expect(read('src/button.ts')).toContain("import '@zeus-web/button/wc/auto'")

    expect(read('src/input.ts')).toContain(
      "import '@zeus-web/themes/default.css'",
    )
    expect(read('src/input.ts')).toContain("import './input.css'")
    expect(read('src/input.ts')).toContain("import '@zeus-web/input/wc/auto'")
  })

  it('ships aggregate styles', () => {
    const styles = read('src/styles.css')

    expect(styles).toContain("@import '@zeus-web/themes/default.css'")
    expect(styles).toContain("@import './button.css'")
    expect(styles).toContain("@import './input.css'")
  })

  it('styles light DOM and future part selectors', () => {
    const buttonCss = read('src/button.css')
    const inputCss = read('src/input.css')

    expect(buttonCss).toContain("zw-button [data-slot='button']")
    expect(buttonCss).toContain('zw-button::part(button)')
    expect(buttonCss).toContain("zw-button[variant='primary']::part(button)")
    expect(buttonCss).toContain('hsl(var(--zw-primary))')

    expect(inputCss).toContain("zw-input [data-slot='input']")
    expect(inputCss).toContain('zw-input::part(input)')
    expect(inputCss).toContain('hsl(var(--zw-input))')
    expect(inputCss).toContain('hsl(var(--zw-ring))')
  })

  it('has a css copy build helper', () => {
    expect(existsSync(resolve(packageRoot, 'scripts/copy-css.ts'))).toBe(true)
  })
})
