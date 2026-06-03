import typescript from '@rollup/plugin-typescript'
import zeus from '@zeus-js/bundler-plugin'
import react from '@zeus-js/output-react-wrapper'
import vue from '@zeus-js/output-vue-wrapper'
import wc from '@zeus-js/output-wc'

export function createPrimitiveRollupConfig(options = {}) {
  const { input = 'src/index.ts', tagPrefix = 'zw-', external = [] } = options

  return {
    input,
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
    },
    external: [
      '@zeus-js/zeus',
      '@zeus-js/signal',
      '@zeus-web/zeus-compat',
      'react',
      'vue',
      ...external,
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          target: 'ES2016',
          module: 'ESNext',
          declaration: false,
          outDir: 'dist',
          rootDir: 'src',
        },
        exclude: ['**/*.test.*', '**/__tests__/**'],
      }),
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
