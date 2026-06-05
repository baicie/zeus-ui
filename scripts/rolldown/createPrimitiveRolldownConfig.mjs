import zeus from '@zeus-js/bundler-plugin/rolldown'
import react from '@zeus-js/output-react-wrapper'
import vue from '@zeus-js/output-vue-wrapper'
import wc from '@zeus-js/output-wc'

export function createPrimitiveRolldownConfig(options = {}) {
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
      fixWcEventListenerDts(),
    ],
  }
}

function fixWcEventListenerDts() {
  return {
    name: 'zeus-ui-fix-wc-event-listener-dts',
    generateBundle(_, bundle) {
      for (const item of Object.values(bundle)) {
        if (
          item.type !== 'asset' ||
          typeof item.fileName !== 'string' ||
          !item.fileName.startsWith('wc/') ||
          !item.fileName.endsWith('.d.ts') ||
          typeof item.source !== 'string'
        ) {
          continue
        }

        item.source = item.source
          .replace(
            /(addEventListener<K extends keyof \w+EventMap>\([\s\S]+?\): void\n)/,
            `$1
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void
`,
          )
          .replace(
            /(removeEventListener<K extends keyof \w+EventMap>\([\s\S]+?\): void\n)/,
            `$1
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void
`,
          )
      }
    },
  }
}
