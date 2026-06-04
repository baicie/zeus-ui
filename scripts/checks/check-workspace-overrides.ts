import { readFileSync } from 'node:fs'
import pc from 'picocolors'

const workspaceFile = 'pnpm-workspace.yaml'
const source = readFileSync(workspaceFile, 'utf8')

const forbiddenPatterns = [
  {
    label: 'local @zeus-js link/file override',
    pattern: /^\s*['"]?@zeus-js\/[^'":\s]+['"]?\s*:\s*['"]?(?:link:|file:)/m,
  },
  {
    label: 'absolute local link/file path',
    pattern: /(?:link:|file:)(?:[a-zA-Z]:[\\/]|\/(?:Users|home|mnt)\/)/,
  },
]

let hasError = false

for (const { label, pattern } of forbiddenPatterns) {
  if (!pattern.test(source)) continue

  hasError = true
  console.error(
    pc.red(`${workspaceFile}: contains forbidden ${label}: ${pattern}`),
  )
}

if (hasError) {
  console.error(
    pc.yellow(
      'Do not commit local Zeus overrides. Use pnpm link:zeus-js locally and revert workspace changes before committing.',
    ),
  )
  process.exit(1)
}

console.log(pc.green('Workspace overrides check passed.'))
