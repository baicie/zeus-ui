import { defineReleaseConfig } from '@baicie/release'

import { createPackageKind } from './release/publish-order'
import { listPublishablePackages, packageRoots } from './release/workspace'

/*
 * Publish order, computed from the workspace as it is now.
 *
 * Without `packageKind` the release sorts every package into one group and
 * publishes alphabetically, which inverted 59 real `@zeus-web` dependency
 * edges — `@zeus-web/cli` before the `registry`/`themes`/`icons` it depends
 * on, and so on. npm accepts each publish independently, so that order leaves
 * a window where a published version names a dependency that is not on the
 * registry yet.
 *
 * `computePublishDepths` walks the same manifests the release reads, so a new
 * internal dependency moves a package to the right depth with no list to
 * maintain.
 */
const packageKind = createPackageKind(
  listPublishablePackages().map(pkg => ({
    name: pkg.name,
    deps: [
      ...Object.entries(pkg.packageJson.dependencies ?? {}),
      ...Object.entries(pkg.packageJson.peerDependencies ?? {}),
      ...Object.entries(pkg.packageJson.optionalDependencies ?? {}),
    ]
      .filter(
        ([dep, version]) =>
          dep.startsWith('@zeus-web/') &&
          String(version).startsWith('workspace:'),
      )
      .map(([dep]) => dep),
  })),
)

export default defineReleaseConfig({
  repo: 'baicie/zeus-ui',
  repositoryUrl: 'https://github.com/baicie/zeus-ui.git',
  mode: 'workspace-fixed',
  packageManager: 'pnpm',

  workspace: {
    roots: packageRoots.map(root => root.dir),
    publishable(pkg) {
      return pkg.name.startsWith('@zeus-web/')
    },
    /** Publish order. See `release/publish-order.ts`. */
    packageKind,
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
      /*
       * The pairing check belongs in the precheck, not only in the release
       * workflow. `release.yml` refuses a report without a Core commit for
       * rc/latest, and a report whose Core tag cannot be resolved — but it
       * runs after the version is cut. Answering the same question here means
       * a mispaired tree fails before anything irreversible happens.
       */
      ['pnpm', 'check:release-pairing'],
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
