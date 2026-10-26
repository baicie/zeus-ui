import fs from 'node:fs'
import path from 'node:path'

/** Refresh only links owned by the temporary consumer; never delete other content. */
export function ensureFixtureSymlink(
  dependencyPath: string,
  targetPath: string,
): void {
  const target = fs.realpathSync(targetPath)
  const existing = fs.lstatSync(dependencyPath, { throwIfNoEntry: false })

  if (existing) {
    if (!existing.isSymbolicLink()) {
      throw new Error(
        `Refusing to replace a non-symlink fixture dependency: ${dependencyPath}`,
      )
    }

    let current: string | undefined
    try {
      current = fs.realpathSync(dependencyPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (current === target) return
    fs.unlinkSync(dependencyPath)
  }

  fs.mkdirSync(path.dirname(dependencyPath), { recursive: true })
  fs.symlinkSync(target, dependencyPath, 'dir')
}

/** Bound resource operations and consume their eventual result after a timeout. */
export function boundedOperation<T>(
  label: string,
  operation: () => T | PromiseLike<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new Error(`${label} requires a positive timeout`))
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      let message = `${label} timed out after ${timeoutMs}ms`
      try {
        if (onTimeout) onTimeout()
      } catch (error) {
        message += `; timeout cleanup failed: ${String(error)}`
      }
      reject(new Error(message))
    }, timeoutMs)

    Promise.resolve()
      .then(operation)
      .then(
        value => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(value)
        },
        error => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          reject(error)
        },
      )
  })
}
