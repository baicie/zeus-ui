import { publish } from '@baicie/release'

publish({
  defaultPackage: 'default',
  packageManager: 'pnpm',
  getPkgDir: () => '.',
})
