import { execa } from 'execa'

async function main() {
  await execa(
    'pnpm',
    ['-r', '--filter', './packages/**', '--workspace-concurrency=1', 'build'],
    {
      stdio: 'inherit',
    },
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
