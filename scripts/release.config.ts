import { defineReleaseConfig } from '@baicie/release'

export default defineReleaseConfig({
  repo: 'baicie/zeus-ui',
  repositoryUrl: 'https://github.com/baicie/zeus-ui.git',
  mode: 'workspace-fixed',
  packageManager: 'pnpm',

  workspace: {
    roots: ['packages', 'packages/primitives'],
    publishable(pkg) {
      return pkg.name.startsWith('@zeus-web/')
    },
  },

  publish: {
    access: 'public',
    provenance: true,
    skipExisting: true,
    retry: 5,
  },

  precheck: {
    commands: [
      ['pnpm', 'format-check'],
      ['pnpm', 'lint'],
      ['pnpm', 'test-unit'],
      ['pnpm', 'check'],
      ['pnpm', 'build'],
      ['pnpm', 'check:exports'],
      ['pnpm', 'check:build-output'],
      ['pnpm', 'site:check'],
    ],
  },

  readiness: {
    common: true,
    strict: false,
    allowZero: false,
  },

  canary: {
    enabled: false,
  },
})
