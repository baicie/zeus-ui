/**
 * Running a release rehearsal without touching the caller's working tree.
 *
 * ## Why this exists
 *
 * `@baicie/release`'s `runRelease` calls `prepareVersion()` before it looks at
 * `dryRun`, and `prepareVersion` passes `dryRun: false` down to
 * `versionPackages()`. So `pnpm release --dry` rewrites every package version,
 * runs `pnpm install --lockfile-only`, and then the precheck builds. The
 * library says so itself:
 *
 *     Dry-run mutates version files, changelog and lockfile.
 *
 * The flag only suppresses the publish call and the git commit. That is a
 * defensible reading of "dry", but it makes a rehearsal destructive in the
 * one place operators run it: a real checkout.
 *
 * ## What this does
 *
 * When `--dry` is requested, the rehearsal runs in a **detached, temporary
 * worktree** and the caller's checkout is never opened for writing. The
 * worktree is removed afterwards whatever the outcome. Uncommitted work in
 * the caller's tree is ignored, not reset, not stashed, and definitely not
 * `git checkout -- .`'d.
 *
 * ## Why not fix it upstream
 *
 * That would be the right fix, and this module is not it. `@baicie/release`
 * publishes no repository field and has no source checkout here, so there is
 * nowhere to send the patch. `release.ts` therefore keeps the defect outside
 * this repository and records it; see `docs/release/dry-run-semantics.md`.
 * When upstream exposes a real dry-run, this wrapper can be deleted without
 * changing any caller.
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export interface RehearsalPlan {
  readonly isolated: boolean
  readonly cwd: string
  readonly reason: string
}

export interface RehearsalOutcome {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

function git(cwd: string, args: readonly string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

/**
 * Whether this invocation is a rehearsal.
 *
 * `--publishOnly --dry` does not call `prepareVersion` at all, so it is safe
 * in place; only the plain `--dry` path mutates.
 */
export function isRehearsal(args: readonly string[]): boolean {
  /*
   * The rehearsal re-executes this entry point inside its worktree. Without
   * this guard the child would see `--dry` again, decide it needs a worktree
   * of its own, and recurse until the disk or the process limit stops it.
   */
  if (process.env.ZEUS_RELEASE_REHEARSAL === '1') return false

  const dry = args.includes('--dry') || args.includes('--dry-run')

  return dry && !args.includes('--publishOnly')
}

/**
 * Decides where the rehearsal should run.
 *
 * A clean tree and a dirty tree get the same answer — isolated — because the
 * point is to never depend on the caller's discipline. Returning `cwd` is
 * reserved for the non-rehearsal path, where `@baicie/release` fails closed
 * on its own if the tree is dirty.
 */
export function planRehearsal(
  args: readonly string[],
  cwd: string,
  gitRoot: string | undefined,
): RehearsalPlan {
  if (!isRehearsal(args)) {
    return {
      isolated: false,
      cwd,
      reason: 'not a rehearsal; the real release path checks the tree itself',
    }
  }

  if (!gitRoot) {
    return {
      isolated: false,
      cwd,
      reason:
        'not inside a git checkout; an isolated worktree is impossible, so the rehearsal runs in place',
    }
  }

  return {
    isolated: true,
    cwd,
    reason:
      'rehearsal: @baicie/release rewrites versions even with --dry, so it runs in a throwaway worktree',
  }
}

/** Resolves the git top-level directory, or undefined outside a repository. */
export function findGitRoot(cwd: string): string | undefined {
  try {
    return git(cwd, ['rev-parse', '--show-toplevel'])
  } catch {
    return undefined
  }
}

/**
 * Creates a detached worktree at HEAD.
 *
 * Detached on purpose: a rehearsal must not be able to advance or create a
 * branch, so it cannot leave the caller on a different commit or push
 * something. `HEAD` rather than a branch name means uncommitted work is
 * simply absent, which is the correct input for "would this release work".
 */
export function createRehearsalWorktree(gitRoot: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'zeus-release-rehearsal-'))

  git(gitRoot, ['worktree', 'add', '--detach', directory, 'HEAD'])

  return directory
}

/** Removes a rehearsal worktree, even when the rehearsal failed. */
export function removeRehearsalWorktree(
  gitRoot: string,
  directory: string,
): void {
  try {
    git(gitRoot, ['worktree', 'remove', '--force', directory])
  } catch {
    // The directory can outlive git's bookkeeping if the process was killed;
    // removing it directly keeps the next run from tripping over it.
    if (existsSync(directory))
      rmSync(directory, { recursive: true, force: true })

    try {
      git(gitRoot, ['worktree', 'prune'])
    } catch {
      // Nothing further to do; the caller reports the rehearsal result, which
      // is what matters.
    }
  }
}

/** Runs the release inside a worktree and always cleans up. */
export function runIsolated(
  gitRoot: string,
  directory: string,
  run: (cwd: string) => Promise<RehearsalOutcome>,
): Promise<RehearsalOutcome> {
  return run(directory).finally(() => {
    removeRehearsalWorktree(gitRoot, directory)
  })
}

/**
 * The command a rehearsal should actually execute.
 *
 * `@baicie/release` is resolved from the package manager, so the worktree
 * needs the dependencies that the caller's checkout already installed. Rather
 * than copying `node_modules` (large, and a source of stale-state bugs), the
 * worktree is given a symlink to the caller's `node_modules`. It is read by
 * the rehearsal and never written, because the rehearsal's own writes are all
 * inside the worktree.
 */
export function linkDependencies(
  fromCheckout: string,
  intoWorktree: string,
): void {
  /*
   * Two different link shapes, for two different reasons.
   *
   * The root `node_modules` can be shared wholesale: it holds tools and the
   * store, and nothing in it resolves back into workspace packages.
   *
   * A workspace package's own `node_modules` cannot. pnpm writes its
   * workspace dependencies as *relative* symlinks — `@zeus-web/input ->
   * ../../../primitives/input` — and Node resolves those against the real
   * path of the directory, not against the link. Sharing the directory
   * therefore pointed the rehearsal at the caller's checkout: a build there
   * produced `dist` in the worktree while the import resolved to the
   * checkout, which has none. Measured on the rc.8 dry run:
   *
   *   src/index.ts(101,35): error TS2307: Cannot find module '@zeus-web/input'
   *
   * So each package's `node_modules` is rebuilt entry by entry: workspace
   * dependencies point at the worktree's own packages, everything else is
   * linked straight through to the checkout.
   */
  const rootSource = resolve(fromCheckout, 'node_modules')
  const rootTarget = resolve(intoWorktree, 'node_modules')
  if (existsSync(rootSource) && !existsSync(rootTarget)) {
    symlinkDirectory(rootSource, rootTarget)
  }

  for (const { directory, names } of workspaceModuleTrees(fromCheckout)) {
    const target = resolve(intoWorktree, directory)
    if (existsSync(target)) continue
    mkdirSync(target, { recursive: true })

    const source = resolve(fromCheckout, directory)
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      const entrySource = resolve(source, entry.name)
      const entryTarget = resolve(target, entry.name)
      if (!entry.name.startsWith('@')) {
        linkEntry(entrySource, entryTarget, names, intoWorktree)
        continue
      }
      /*
       * A scope directory (`@zeus-web`) holds plain-named entries, so the
       * package name is only known one level down. Treating those entries as
       * unscoped — testing each one for `@` — linked every workspace
       * dependency straight back to the checkout, and a build in the worktree
       * then resolved into a tree with no `dist`.
       */
      mkdirSync(entryTarget, { recursive: true })
      for (const scoped of readdirSync(entrySource, { withFileTypes: true })) {
        linkEntry(
          resolve(entrySource, scoped.name),
          resolve(entryTarget, scoped.name),
          names,
          intoWorktree,
          `${entry.name}/${scoped.name}`,
        )
      }
    }
  }
}

/**
 * Links one entry, rebasing it into the worktree when it names a workspace
 * package.
 *
 * pnpm writes workspace dependencies as relative symlinks, and Node resolves
 * them against the link target's real path. Sharing the checkout's directory
 * therefore made the rehearsal read the checkout's packages — which have no
 * `dist` — instead of the ones it had just built.
 */
function linkEntry(
  source: string,
  target: string,
  names: ReadonlyMap<string, string>,
  intoWorktree: string,
  packageName?: string,
): void {
  const workspacePackage = packageName ? names.get(packageName) : undefined
  symlinkSync(
    workspacePackage ? resolve(intoWorktree, workspacePackage) : source,
    target,
  )
}

/**
 * `fs.symlinkSync` rather than `ln -s`: there is no `ln` on Windows, and the
 * first version of this used `execFileSync('ln', ...)` and failed there.
 *
 * `junction` on Windows is a directory link that does not require the elevated
 * privilege a plain symlink does, which matters because a rehearsal must work
 * for any developer, not only admins.
 */
function symlinkDirectory(source: string, target: string): void {
  symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir')
}

/**
 * Every workspace package that has a `node_modules`, with a name → directory
 * map for rewriting the workspace edges.
 *
 * Read from `pnpm-workspace.yaml` rather than hardcoded, so a new workspace
 * glob cannot silently reintroduce the unresolved-import failure.
 */
function workspaceModuleTrees(root: string): Array<{
  directory: string
  names: ReadonlyMap<string, string>
}> {
  const trees: Array<{ directory: string; names: Map<string, string> }> = []
  const byDirectory = new Map<string, Map<string, string>>()

  const nameAt = (directory: string): string | undefined => {
    const manifest = resolve(root, directory, 'package.json')
    if (!existsSync(manifest)) return undefined
    try {
      return (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string })
        .name
    } catch {
      return undefined
    }
  }

  for (const directory of workspaceDirectories(root)) {
    const name = nameAt(directory)
    if (name) byDirectory.set(directory, new Map([[name, directory]]))
  }
  const allNames = new Map<string, string>()
  for (const entries of byDirectory.values()) {
    for (const [name, directory] of entries) allNames.set(name, directory)
  }

  for (const directory of workspaceDirectories(root)) {
    if (!existsSync(resolve(root, directory, 'node_modules'))) continue
    trees.push({ directory: join(directory, 'node_modules'), names: allNames })
  }
  return trees
}

/**
 * Every workspace package directory, relative to the root.
 *
 * Read from `pnpm-workspace.yaml` rather than hardcoded, so a new workspace
 * glob cannot silently reintroduce the unresolved-import failure.
 */
function workspaceDirectories(root: string): string[] {
  const manifest = resolve(root, 'pnpm-workspace.yaml')
  if (!existsSync(manifest)) return []

  const patterns = readFileSync(manifest, 'utf8')
    .split('\n')
    .map(line => /^\s*-\s*'([^']+)'\s*$/.exec(line)?.[1])
    .filter((pattern): pattern is string => Boolean(pattern))

  /*
   * Expand one level per `*` segment, so `packages/primitives/*` reaches the
   * packages under it rather than only `packages/`.
   */
  const directories: string[] = []
  const expand = (segments: string[]): void => {
    const star = segments.indexOf('*')
    if (star === -1) {
      if (existsSync(resolve(root, ...segments, 'package.json'))) {
        directories.push(join(...segments))
      }
      return
    }
    const prefix = segments.slice(0, star)
    const directory = resolve(root, ...prefix)
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue
      expand([...prefix, entry.name, ...segments.slice(star + 1)])
    }
  }
  for (const pattern of patterns) expand(pattern.split('/'))
  return [...new Set(directories)]
}
