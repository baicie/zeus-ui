import { formatGeneratedMarkdown } from '../format-generated-docs'

describe('generated docs formatter', () => {
  it('formats markdown tables like repository docs', async () => {
    const source = [
      '| Prop | Type | Default | Description |',
      '| --- | --- | --- | --- |',
      '| `variant` | `ButtonVariant` | `default` | Visual style variant. |',
      '',
    ].join('\n')

    const formatted = await formatGeneratedMarkdown(source)

    expect(formatted).toContain(
      '| Prop      | Type            | Default   | Description           |',
    )
    expect(formatted).toContain(
      '| --------- | --------------- | --------- | --------------------- |',
    )
    expect(formatted).toContain(
      '| `variant` | `ButtonVariant` | `default` | Visual style variant. |',
    )
  })
})
