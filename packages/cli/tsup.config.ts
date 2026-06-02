import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'cjs',
  outDir: 'dist',
  clean: true,
  dts: false,
  skipNodeModulesBundle: true,
  shims: false,
  target: 'node18',
})
