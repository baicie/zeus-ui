// Bundles the AI Host server into one ESM file for the runtime image.
//
// The image used to run a single stage: `pnpm install` then `pnpm build` then
// `chown -R`, which left the whole workspace dependency tree (428 MB
// uncompressed, incl. rolldown, esbuild, typescript, playwright) in the
// deployment. The Host imports only `node:*` builtins and `@zeus-web/ai-core`,
// which is plain ESM, so one bundled file replaces the tree.
//
// `node:*` stays external (runtime builtins); `@zeus-web/*` is inlined by
// resolving the workspace packages through their `exports` maps.
import path from 'node:path'
import { parseArgs } from 'node:util'

import { rolldown } from 'rolldown'

const { values } = parseArgs({
  options: {
    entry: { type: 'string' },
    outfile: { type: 'string' },
  },
})

if (!values.entry || !values.outfile) {
  throw new Error('--entry and --outfile are required')
}

const bundle = await rolldown({
  input: path.resolve(values.entry),
  platform: 'node',
  external: [/^node:/],
  resolve: {
    conditionNames: ['node', 'import', 'default'],
  },
})

try {
  await bundle.write({
    file: path.resolve(values.outfile),
    format: 'esm',
    sourcemap: false,
  })
} finally {
  await bundle.close()
}

console.info(`bundled ${values.entry} -> ${values.outfile}`)
