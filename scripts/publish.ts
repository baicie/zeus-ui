import { publish } from '@baicie/release'

// TODO(Phase 5): multi-package publish scaffold
// When @baicie/release adds getPkgDirs support, add back listPackageDirs()
// and switch from getPkgDir to getPkgDirs:
//
//   function listPackageDirs(): string[] {
//     const dirs: string[] = []
//     const roots = ['packages', 'packages/primitives']
//     for (const rel of roots) {
//       const abs = join(process.cwd(), rel)
//       if (!existsSync(abs)) continue
//       for (const name of readdirSync(abs)) {
//         const pkgJsonPath = join(abs, name, 'package.json')
//         if (existsSync(pkgJsonPath)) dirs.push(join(abs, name))
//       }
//     }
//     return dirs
//   }

publish({
  defaultPackage: 'default',
  packageManager: 'pnpm',
  getPkgDir: () => '.',
} as Parameters<typeof publish>[0])
