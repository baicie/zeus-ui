import zeus, { componentLibrary } from '@zeus-js/web-c/rolldown'
import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: 'esm',
  },
  plugins: [
    zeus({
      plugins: componentLibrary(),
    }),
  ],
})
