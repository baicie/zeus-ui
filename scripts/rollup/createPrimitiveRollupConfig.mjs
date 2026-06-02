import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import zeus from '@zeus-js/bundler-plugin'
import react from '@zeus-js/output-react-wrapper'
import vue from '@zeus-js/output-vue-wrapper'
import wc from '@zeus-js/output-wc'
import { transformWithEsbuild } from 'vite'

function resolveTypeScriptSource() {
  return {
    name: 'zeus-ui-resolve-typescript-source',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) {
        return null
      }

      const resolved = resolve(dirname(importer), source)
      const candidates = [
        resolved,
        `${resolved}.ts`,
        `${resolved}.tsx`,
        resolve(resolved, 'index.ts'),
        resolve(resolved, 'index.tsx'),
      ]

      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          return candidate
        }
      }

      return null
    },
  }
}

function transformTypeScript() {
  return {
    name: 'zeus-ui-transform-typescript',
    transform(code, id) {
      if (!/\.[cm]?tsx?$/.test(id)) {
        return null
      }

      return transformWithEsbuild(code, id, {
        loader: id.endsWith('x') ? 'tsx' : 'ts',
        sourcemap: true,
        target: 'es2016',
      })
    },
  }
}

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
      '@zeus-js/runtime-dom',
      '@zeus-js/signal',
      'react',
      'vue',
      ...external,
    ],
    plugins: [
      resolveTypeScriptSource(),
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
      transformTypeScript(),
    ],
  }
}
