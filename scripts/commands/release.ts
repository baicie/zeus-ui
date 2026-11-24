import { spawn } from 'node:child_process'

import { runReleaseCli } from '@baicie/release'

import config from '../release.config'
import { requirePublishChannel } from './channel-guard'
import {
  createRehearsalWorktree,
  findGitRoot,
  linkDependencies,
  planRehearsal,
  removeRehearsalWorktree,
} from './release-rehearsal'

const args = process.argv.slice(2)

// The version decides the npm dist-tag; an explicit `--tag` that disagrees with
// it is a release-channel error, not an operator preference.
try {
  requirePublishChannel(args)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}

/*
 * `@baicie/release` rewrites package versions and the lockfile before it ever
 * consults `--dry`, so a rehearsal in this checkout would silently edit the
 * files the operator is working on. `planRehearsal` moves it to a throwaway
 * worktree instead, and this wrapper never resets the caller's tree.
 */
const gitRoot = findGitRoot(process.cwd())
const plan = planRehearsal(args, process.cwd(), gitRoot)

if (!plan.isolated || !gitRoot) {
  if (plan.reason) console.info(`release: ${plan.reason}`)

  runReleaseCli(config).catch(error => {
    console.error(error)
    process.exit(1)
  })
} else {
  const worktree = createRehearsalWorktree(gitRoot)

  linkDependencies(process.cwd(), worktree)
  console.info(`release: rehearsal runs in ${worktree}`)
  console.info(
    'release: your checkout is not modified; the worktree is removed afterwards',
  )

  removeWorktreeOnExit(gitRoot, worktree)

  /*
   * The library reads `process.argv` and the current directory, so the
   * rehearsal re-executes this same entry point inside the worktree. That
   * keeps one code path rather than two, and the child sees a clean tree of
   * its own.
   */
  runInWorktree(worktree, args)
    .then(code => {
      removeRehearsalWorktree(gitRoot, worktree)
      process.exit(code)
    })
    .catch(error => {
      removeRehearsalWorktree(gitRoot, worktree)
      console.error(error)
      process.exit(1)
    })
}

/**
 * Cleanup must survive Ctrl-C, otherwise a killed rehearsal leaves a worktree
 * registered and the next `git worktree add` still works but the temp
 * directories accumulate.
 */
function removeWorktreeOnExit(gitRoot: string, worktree: string): void {
  const cleanup = (): void => {
    removeRehearsalWorktree(gitRoot, worktree)
  }

  process.once('SIGINT', () => {
    cleanup()
    process.exit(130)
  })
  process.once('SIGTERM', () => {
    cleanup()
    process.exit(143)
  })

  /*
   * SIGINT/SIGTERM cover the polite cases. A rehearsal that fails for any
   * other reason — an uncaught throw in a child, a non-zero exit path that
   * skips the promise chain — would otherwise leave the worktree registered,
   * and those accumulate. `exit` cannot be prevented, so it is the one hook
   * that runs on every non-SIGKILL ending. Removal is idempotent.
   */
  process.once('exit', cleanup)
}

function runInWorktree(
  worktree: string,
  args: readonly string[],
): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    /*
     * The entry point is TypeScript, so the child needs the same loader the
     * parent was started with (`tsx`, via the package script). Reusing
     * `process.execArgv` carries that loader across instead of hardcoding it,
     * which keeps `pnpm release` and a direct `tsx scripts/commands/release.ts`
     * behaving identically.
     */
    const child = spawn(
      process.execPath,
      [...process.execArgv, process.argv[1] ?? '', ...args],
      {
        cwd: worktree,
        stdio: 'inherit',
        env: { ...process.env, ZEUS_RELEASE_REHEARSAL: '1' },
      },
    )

    child.on('error', reject)
    child.on('close', code => resolvePromise(code ?? 1))
  })
}
