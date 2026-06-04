import { readFileSync } from 'node:fs'
import pc from 'picocolors'

const workspaceFile = 'pnpm-workspace.yaml'
const source = readFileSync(workspaceFile, 'utf8')

const forbiddenPatterns = [
  /link:[a-zA-Z]:[\\/]/,
  /link:\/Users\//,
  /link:\/home\//,
  /link:\/mnt\//,
  /workspace[\\/].*zeus/,
]

let hasError = false

for (const pattern of forbiddenPatterns) {
  if (pattern.test(source)) {
    hasError = true
    console.error(
      pc.red(
        `${workspaceFile}: contains local machine link override matching ${pattern}`,
      ),
    )
  }
}

if (hasError) {
  console.error(
    pc.yellow(
      'Do not commit local Zeus link overrides. Use pnpm link:zeus-js locally and revert workspace changes before committing.',
    ),
  )
  process.exit(1)
}

console.log(pc.green('Workspace overrides check passed.'))
