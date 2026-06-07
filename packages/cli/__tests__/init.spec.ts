import { resolve } from 'node:path'

import { parseInitArgs } from '../src/commands/init'

describe('@zeus-web/cli init', () => {
  it('parses init options', () => {
    const parsed = parseInitArgs(
      [
        '--cwd',
        'demo',
        '--style',
        'slate',
        '--css',
        'app/globals.css',
        '--overwrite',
        '--no-install',
        '--package-manager',
        'npm',
      ],
      '/repo',
    )

    expect(parsed.options).toEqual({
      cwd: resolve('/repo', 'demo'),
      style: 'slate',
      css: 'app/globals.css',
      overwrite: true,
      install: false,
      packageManager: 'npm',
    })
  })

  it('rejects unsupported style', () => {
    expect(() => parseInitArgs(['--style', 'bad'])).toThrow(
      'Unsupported style: bad',
    )
  })

  it('rejects empty css option', () => {
    expect(() => parseInitArgs(['--css='])).toThrow(
      '--css requires a file path',
    )
  })

  it('rejects empty style option', () => {
    expect(() => parseInitArgs(['--style='])).toThrow(
      '--style requires a theme name',
    )
  })
})
