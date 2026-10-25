import { realpathSync } from 'node:fs'
import { join, relative } from 'node:path'

import { execaSync } from 'execa'

interface ListedWorkspacePackage {
  path: string
}

export function listZeusDependencyManifests(root: string): string[] {
  // Let pnpm interpret its workspace patterns, including exclusions. Recursive
  // filesystem scans also pick up isolated consumer fixtures and build output.
  const { stdout } = execaSync(
    'pnpm',
    ['--recursive', 'list', '--depth', '-1', '--json'],
    { cwd: root },
  )
  const packages = JSON.parse(stdout) as ListedWorkspacePackage[]
  const canonicalRoot = realpathSync(root)
  return Array.from(
    new Set(
      packages.map(pkg =>
        join(root, relative(canonicalRoot, pkg.path), 'package.json'),
      ),
    ),
  ).sort()
}
