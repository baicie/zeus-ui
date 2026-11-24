import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  createRehearsalWorktree,
  findGitRoot,
  isRehearsal,
  linkDependencies,
  planRehearsal,
  removeRehearsalWorktree,
} from '../release-rehearsal'

describe('isRehearsal', () => {
  it('treats a plain --dry invocation as a rehearsal', () => {
    expect(isRehearsal(['0.1.0-beta.36', '--dry'])).toBe(true)
    expect(isRehearsal(['0.1.0-beta.36', '--dry-run'])).toBe(true)
  })

  it('does not treat --publishOnly --dry as a rehearsal', () => {
    /*
     * `--publishOnly` returns before `prepareVersion`, so it never rewrites
     * versions. Isolating it would add a worktree for no benefit.
     */
    expect(isRehearsal(['--publishOnly', '--dry'])).toBe(false)
  })

  it('does not treat a real release as a rehearsal', () => {
    expect(isRehearsal(['0.1.0-beta.36', '--tag', 'beta'])).toBe(false)
  })

  it('refuses to recurse inside its own child process', () => {
    /*
     * The rehearsal re-executes this entry point in the worktree. Without the
     * marker the child decides it is a rehearsal too and creates another
     * worktree, forever. This guard is what stops that.
     */
    const previous = process.env.ZEUS_RELEASE_REHEARSAL

    process.env.ZEUS_RELEASE_REHEARSAL = '1'

    try {
      expect(isRehearsal(['0.1.0-beta.36', '--dry'])).toBe(false)
    } finally {
      if (previous === undefined) delete process.env.ZEUS_RELEASE_REHEARSAL
      else process.env.ZEUS_RELEASE_REHEARSAL = previous
    }
  })
})

describe('planRehearsal', () => {
  it('isolates a rehearsal inside a git checkout', () => {
    const plan = planRehearsal(['1.0.0', '--dry'], '/repo', '/repo')

    expect(plan.isolated).toBe(true)
  })

  it('runs in place when there is no git checkout to isolate into', () => {
    // A rehearsal cannot create a worktree without a repository. Saying so is
    // better than failing, because the caller is already in an unusual place.
    const plan = planRehearsal(['1.0.0', '--dry'], '/tmp/x', undefined)

    expect(plan.isolated).toBe(false)
    expect(plan.reason).toContain('not inside a git checkout')
  })

  it('leaves a real release in place', () => {
    const plan = planRehearsal(['1.0.0'], '/repo', '/repo')

    expect(plan.isolated).toBe(false)
  })
})

describe('worktree lifecycle', () => {
  const root = findGitRoot(process.cwd())

  /*
   * `git worktree add` shells out and copies a full checkout; on a Windows
   * runner that takes longer than vitest's 5s default, and the test failed
   * with a bare "Test timed out" that says nothing about why. The work itself
   * is fine — it just needs a budget that matches what it does.
   */
  const WORKTREE_TIMEOUT_MS = 60_000

  it('finds the repository this test runs in', () => {
    expect(root).toBeDefined()
  })

  it(
    'creates a detached worktree and removes it again',
    () => {
      if (!root) return

      const worktree = createRehearsalWorktree(root)

      try {
        expect(worktree).toContain('zeus-release-rehearsal-')
        // A detached worktree cannot advance a branch, so a rehearsal can never
        // leave the caller on a different commit.
        const branch = execFileSync(
          'git',
          ['rev-parse', '--abbrev-ref', 'HEAD'],
          {
            cwd: worktree,
            encoding: 'utf8',
          },
        ).trim()

        expect(branch).toBe('HEAD')
      } finally {
        removeRehearsalWorktree(root, worktree)
      }

      expect(existsSync(worktree)).toBe(false)
    },
    WORKTREE_TIMEOUT_MS,
  )

  it(
    'shares node_modules with the checkout instead of copying it',
    () => {
      if (!root) return

      const worktree = createRehearsalWorktree(root)

      try {
        linkDependencies(process.cwd(), worktree)

        const target = `${worktree}/node_modules`

        if (!existsSync(`${process.cwd()}/node_modules`)) return

        expect(existsSync(target)).toBe(true)
        // A symlink, not a copy: copying node_modules per rehearsal would cost
        // gigabytes and go stale the moment the caller installs something.
        expect(lstatSync(target).isSymbolicLink()).toBe(true)
      } finally {
        removeRehearsalWorktree(root, worktree)
      }
    },
    WORKTREE_TIMEOUT_MS,
  )

  it(
    'removes a worktree twice without throwing',
    () => {
      if (!root) return

      const worktree = createRehearsalWorktree(root)

      removeRehearsalWorktree(root, worktree)
      // The `exit` hook and the promise chain both call this; idempotence is
      // what keeps that from turning a clean run into a crash on exit.
      expect(() => removeRehearsalWorktree(root, worktree)).not.toThrow()
    },
    WORKTREE_TIMEOUT_MS,
  )
})
