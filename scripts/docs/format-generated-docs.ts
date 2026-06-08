import type { GeneratedDoc } from './component-docs'

import { format } from 'prettier'

export async function formatGeneratedMarkdown(source: string): Promise<string> {
  return format(source, {
    parser: 'markdown',
    proseWrap: 'preserve',
    singleQuote: true,
    semi: false,
  })
}

export async function formatGeneratedDocs(
  docs: GeneratedDoc[],
): Promise<GeneratedDoc[]> {
  return Promise.all(
    docs.map(async doc => ({
      ...doc,
      content: await formatGeneratedMarkdown(doc.content),
    })),
  )
}
