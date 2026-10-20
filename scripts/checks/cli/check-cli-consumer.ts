import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = process.cwd()
const cli = resolve(root, 'packages/cli/dist/index.js')
assert(existsSync(cli), 'Build @zeus-web/cli before running check:cli-consumer')

function verifyFramework(framework: 'react' | 'vue'): void {
  const cwd = mkdtempSync(join(tmpdir(), `zweb-${framework}-consumer-`))
  const run = (args: string[], expectedStatus = 0): string => {
    const result = spawnSync(process.execPath, [cli, ...args, '--cwd', cwd], {
      encoding: 'utf8',
    })
    assert.equal(
      result.status,
      expectedStatus,
      `${framework} ${args.join(' ')}: ${result.stdout}\n${result.stderr}`,
    )
    return result.stdout
  }
  try {
    mkdirSync(join(cwd, 'src'))
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({
        name: `cli-${framework}-consumer`,
        private: true,
        dependencies: {
          [framework]: framework === 'react' ? '19.0.0' : '3.5.0',
          '@zeus-web/button': '0.1.0',
          '@zeus-web/input': '0.1.0',
          '@zeus-web/themes': '0.1.0',
        },
      }),
    )
    run(['init', '--framework', framework])
    run(['add', 'button', 'input'])
    const extension = framework === 'react' ? 'tsx' : 'vue'
    const target = join(cwd, `src/components/ui/button.${extension}`)
    const lockPath = join(cwd, 'zeus-ui.lock.json')
    assert(existsSync(target))
    const before = readFileSync(lockPath, 'utf8')
    run(['remove', 'button', '--dry-run'])
    assert.equal(readFileSync(lockPath, 'utf8'), before)
    const report: { checks: Array<{ level: string }> } = JSON.parse(
      run(['doctor', '--json']),
    )
    assert.equal(
      report.checks.some(check => check.level === 'fail'),
      false,
    )
    run(['diff', 'button'])
    run(['update', 'button', '--dry-run'])
    writeFileSync(
      target,
      `${readFileSync(target, 'utf8')}\n<!-- local edit -->\n`,
    )
    run(['remove', '--all'], 1)
    assert(existsSync(target))
    assert.equal(readFileSync(lockPath, 'utf8'), before)
    run(['remove', 'button', '--force'])
    assert.equal(existsSync(target), false)
    assert(existsSync(join(cwd, `src/components/ui/input.${extension}`)))
    assert(existsSync(join(cwd, 'src/lib/cn.ts')))
    run(['remove', '--all'])
    assert.deepEqual(JSON.parse(readFileSync(lockPath, 'utf8')).components, {})
    assert(existsSync(join(cwd, 'package.json')))
    assert(existsSync(join(cwd, 'zeus-ui.json')))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

function verifyFileRegistry(): void {
  const cwd = mkdtempSync(join(tmpdir(), 'zweb-file-registry-consumer-'))
  const registryRoot = mkdtempSync(join(tmpdir(), 'zweb-file-registry-'))
  const run = (args: string[], expectedStatus = 0): string => {
    const result = spawnSync(process.execPath, [cli, ...args, '--cwd', cwd], {
      encoding: 'utf8',
    })
    assert.equal(
      result.status,
      expectedStatus,
      `file registry ${args.join(' ')}: ${result.stdout}\n${result.stderr}`,
    )
    return result.stdout
  }

  try {
    mkdirSync(join(cwd, 'src'))
    mkdirSync(join(registryRoot, 'templates/react'), { recursive: true })
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'cli-file-registry-consumer', private: true }),
    )
    writeFileSync(
      join(registryRoot, 'registry.json'),
      JSON.stringify({
        schemaVersion: 1,
        name: '@example/registry',
        version: '1.0.0',
        items: [
          {
            name: 'badge',
            type: 'component',
            description: 'Badge component',
            frameworks: ['react'],
            dependencies: [],
            registryDependencies: [],
            files: [
              {
                framework: 'react',
                source: 'templates/react/badge.tsx',
                target: 'components/ui/badge.tsx',
              },
            ],
          },
        ],
      }),
    )
    const template = join(registryRoot, 'templates/react/badge.tsx')
    writeFileSync(template, 'export const Badge = () => "v1"\n')

    run(['init', '--framework', 'react'])
    run([
      'add',
      '--all',
      '--registry',
      registryRoot,
      '--path',
      'src/custom/ui',
      '--skip-deps',
    ])
    const target = join(cwd, 'src/custom/ui/badge.tsx')
    assert.match(readFileSync(target, 'utf8'), /v1/)

    writeFileSync(template, 'export const Badge = () => "v2"\n')
    run(['update', 'badge'])
    assert.match(readFileSync(target, 'utf8'), /v2/)

    const report: { checks: Array<{ level: string }> } = JSON.parse(
      run(['doctor', '--json']),
    )
    assert.equal(
      report.checks.some(check => check.level === 'fail'),
      false,
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
    rmSync(registryRoot, { recursive: true, force: true })
  }
}

for (const framework of ['react', 'vue'] as const) {
  verifyFramework(framework)
  console.info(`Built zweb ${framework} maintenance consumer passed.`)
}

verifyFileRegistry()
console.info('Built zweb file-registry consumer passed.')
