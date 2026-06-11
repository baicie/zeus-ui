import { iconNames, searchIcons } from '@zeus-web/icons'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { icon } from '../src/commands/icon'

describe('@zeus-web/cli icon workflow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    process.exitCode = undefined
  })

  it('can read icon names from icons package', () => {
    expect(iconNames).toContain('check')
    expect(iconNames).toContain('x')
    expect(iconNames).toContain('search')
  })

  it('can search icon metadata', () => {
    expect(searchIcons('success').map(item => item.name)).toContain('check')
    expect(searchIcons('warning').map(item => item.name)).toContain(
      'alert-triangle',
    )
  })

  it('prints icon list', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await icon(['list'])

    expect(log.mock.calls.flat().join('\n')).toContain('Available icons:')
    expect(log.mock.calls.flat().join('\n')).toContain('check')
  })

  it('prints icon list as json', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await icon(['list', '--json'])

    const output = log.mock.calls.flat().join('\n')
    const parsed = JSON.parse(output) as {
      icons: Array<{ name: string }>
    }

    expect(parsed.icons.map(item => item.name)).toContain('check')
  })

  it('prints icon search results', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await icon(['search', 'warning'])

    expect(log.mock.calls.flat().join('\n')).toContain('alert-triangle')
  })

  it('prints icon show usage snippets', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await icon(['show', 'check'])

    const output = log.mock.calls.flat().join('\n')

    expect(output).toContain(
      "import { IconCheck } from '@zeus-web/icons/react'",
    )
    expect(output).toContain(
      '<zw-icon-check aria-hidden="true"></zw-icon-check>',
    )
    expect(output).toContain('@zeus-web/icons/svg/check.svg')
  })

  it('sets exitCode for unknown icon', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await icon(['show', 'unknown'])

    expect(error.mock.calls.flat().join('\n')).toContain(
      'Unknown icon: unknown',
    )
    expect(process.exitCode).toBe(1)
  })
})
