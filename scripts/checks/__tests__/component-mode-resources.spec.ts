import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  boundedOperation,
  ensureFixtureSymlink,
} from '../wc/component-mode-resources'

describe('component mode fixture dependency links', () => {
  let root: string
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-mode-link-'))
  })
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  function target(name: string): string {
    const directory = path.join(root, name)
    fs.mkdirSync(directory)
    return directory
  }

  it('creates a link and replaces an older runtime without deleting its target', () => {
    const previous = target('beta18')
    const current = target('beta20')
    const dependency = path.join(root, 'consumer/node_modules/@zeus-js/runtime')
    fs.writeFileSync(path.join(previous, 'retained'), 'keep')
    ensureFixtureSymlink(dependency, previous)
    expect(fs.realpathSync(dependency)).toBe(fs.realpathSync(previous))
    ensureFixtureSymlink(dependency, current)
    expect(fs.realpathSync(dependency)).toBe(fs.realpathSync(current))
    ensureFixtureSymlink(dependency, current)
    expect(fs.realpathSync(dependency)).toBe(fs.realpathSync(current))
    expect(fs.readFileSync(path.join(previous, 'retained'), 'utf8')).toBe(
      'keep',
    )
  })

  it('repairs a dangling runtime link', () => {
    const dependency = path.join(root, 'runtime')
    fs.symlinkSync(path.join(root, 'removed-version'), dependency, 'dir')
    const current = target('current')
    ensureFixtureSymlink(dependency, current)
    expect(fs.realpathSync(dependency)).toBe(fs.realpathSync(current))
  })

  it.each(['file', 'directory'] as const)(
    'rejects an existing %s and preserves its content',
    kind => {
      const dependency = path.join(root, 'runtime')
      if (kind === 'directory') fs.mkdirSync(dependency)
      const content =
        kind === 'directory' ? path.join(dependency, 'retained') : dependency
      fs.writeFileSync(content, 'keep')
      expect(() => ensureFixtureSymlink(dependency, target('current'))).toThrow(
        'non-symlink fixture dependency',
      )
      expect(fs.readFileSync(content, 'utf8')).toBe('keep')
    },
  )
})

describe('bounded component mode resource operations', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('rejects a hanging close and terminates the owned resource once', () => {
    const terminate = vi.fn()
    const close = vi.fn(() => new Promise<void>(() => {}))
    const result = boundedOperation('browser close', close, 100, terminate)
    const rejected = expect(result).rejects.toThrow(
      'browser close timed out after 100ms',
    )
    return vi
      .advanceTimersByTimeAsync(100)
      .then(() => rejected)
      .then(() => {
        expect(close).toHaveBeenCalledOnce()
        expect(terminate).toHaveBeenCalledOnce()
        expect(vi.getTimerCount()).toBe(0)
      })
  })

  it('clears the timer after success and does not terminate later', () => {
    const terminate = vi.fn()
    return boundedOperation(
      'server close',
      () => Promise.resolve('closed'),
      100,
      terminate,
    )
      .then(value => {
        expect(value).toBe('closed')
        expect(vi.getTimerCount()).toBe(0)
        return vi.advanceTimersByTimeAsync(1000)
      })
      .then(() => expect(terminate).not.toHaveBeenCalled())
  })

  it('preserves ordinary operation failures and clears the timer', () => {
    const failure = new Error('close failed')
    const terminate = vi.fn()
    const result = boundedOperation(
      'browser close',
      () => Promise.reject(failure),
      100,
      terminate,
    )
    const rejected = expect(result).rejects.toBe(failure)
    return rejected.then(() => {
      expect(terminate).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    })
  })

  it('turns a synchronous operation throw into the same rejection', () => {
    const failure = new Error('synchronous close failure')
    const result = boundedOperation(
      'server close',
      () => {
        throw failure
      },
      100,
    )
    const rejected = expect(result).rejects.toBe(failure)
    return rejected.then(() => expect(vi.getTimerCount()).toBe(0))
  })

  it('keeps a timeout failure when forced termination also throws', () => {
    const result = boundedOperation(
      'browser close',
      () => new Promise<void>(() => {}),
      100,
      () => {
        throw new Error('termination failed')
      },
    )
    const rejected = expect(result).rejects.toThrow(
      'browser close timed out after 100ms; timeout cleanup failed: Error: termination failed',
    )
    return vi.advanceTimersByTimeAsync(100).then(() => rejected)
  })

  it('consumes a late close rejection after timing out', () => {
    let rejectClose!: (error: Error) => void
    const terminate = vi.fn()
    const result = boundedOperation(
      'browser close',
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectClose = reject
        }),
      100,
      terminate,
    )
    const rejected = expect(result).rejects.toThrow('browser close timed out')
    return vi
      .advanceTimersByTimeAsync(100)
      .then(() => rejected)
      .then(() => rejectClose(new Error('late close failure')))
      .then(() => {
        expect(terminate).toHaveBeenCalledOnce()
        expect(vi.getTimerCount()).toBe(0)
      })
  })
})
