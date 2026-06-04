import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  outDir: 'dist',
  clean: true,
  dts: true,
  skipNodeModulesBundle: true,
  shims: false,
  target: 'node18',
})
