import { release } from '@baicie/release'

release({
  repo: 'baicie',
  packages: ['default'],
  toTag: (pkg, version) => `${pkg}@${version}`,
  getPkgDir: () => '.', // 指定根目录
})
