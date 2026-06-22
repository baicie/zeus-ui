import type { RolldownOptions } from 'rolldown'

import zeus from '@zeus-js/bundler-plugin/rolldown'
import react from '@zeus-js/output-react-wrapper'
import vue from '@zeus-js/output-vue-wrapper'
import wc from '@zeus-js/output-wc'

interface CreatePrimitiveRolldownConfigOptions {
  input?: string
  tagPrefix?: string
  external?: string[]
}

export function createPrimitiveRolldownConfig(
  options: CreatePrimitiveRolldownConfigOptions = {},
): RolldownOptions {
  const { input = 'src/index.ts', tagPrefix = 'zw-', external = [] } = options

  return {
    input,
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
    },
    external: ['@zeus-js/zeus', '@zeus-web/zeus-compat', 'react', 'vue'].concat(
      external,
    ),
    plugins: [
      zeus({
        root: process.cwd(),
        dts: true,
        components: {
          include: ['src/**/*.{ts,tsx}'],
          exclude: ['src/**/*.test.*', 'src/**/__tests__/**'],
        },
        plugins: [
          wc({
            outDir: 'wc',
            stripPrefix: tagPrefix,
            manifestFile: 'zeus.components.json',
            customElementsFile: 'custom-elements.json',
            dts: true,
            jsxDts: true,
            index: true,
          }),
          react({
            outDir: 'react',
            stripPrefix: tagPrefix,
            dts: true,
            index: true,
            namedSlots: 'props',
            wrapper: 'runtime',
          }),
          vue({
            outDir: 'vue',
            stripPrefix: tagPrefix,
            dts: true,
            globalDts: true,
            index: true,
          }),
        ],
      }),
    ],
  }
}
