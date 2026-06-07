import type { ZeusWebAiComponent, ZeusWebAiMetadata } from './types'

function renderList(items: string[]): string {
  return items.map(item => `- ${item}`).join('\n')
}

function renderComponent(component: ZeusWebAiComponent): string {
  const props = component.props.length
    ? component.props
        .map(prop => {
          const values = prop.values?.length
            ? ` Values: ${prop.values.join(', ')}.`
            : ''
          const defaultValue = prop.default ? ` Default: ${prop.default}.` : ''

          return `- \`${prop.name}\` (\`${prop.type}\`): ${prop.description}.${values}${defaultValue}`
        })
        .join('\n')
    : '- No public props documented.'

  const events = component.events.length
    ? component.events
        .map(event => {
          const detailParts: string[] = []
          for (const key of Object.keys(event.detail)) {
            detailParts.push(`${key}: ${event.detail[key]}`)
          }
          const detail = detailParts.join(', ')

          return `- \`${event.name}\` / React \`${event.reactName}\`: ${event.description}. Detail: ${detail}`
        })
        .join('\n')
    : '- No public events documented.'

  const slots = component.slots.length
    ? component.slots
        .map(slot => `- \`${slot.name}\`: ${slot.description}`)
        .join('\n')
    : '- No slots documented.'

  const examples = component.examples
    .map(
      example => `### ${example.title}\n\n\`\`\`tsx\n${example.code}\n\`\`\``,
    )
    .join('\n\n')

  return [
    `## ${component.name}`,
    '',
    component.description,
    '',
    `Add command: \`${component.registryCommand}\``,
    `Install command: \`${component.installCommand}\``,
    `Styled import: \`${component.styledImport}\``,
    `Primitive React import: \`${component.reactImport}\``,
    `Web Component import: \`${component.webComponentImport}\``,
    '',
    '### Props',
    '',
    props,
    '',
    '### Events',
    '',
    events,
    '',
    '### Slots',
    '',
    slots,
    '',
    '### Styling',
    '',
    `Tailwind: ${component.styling.usesTailwind ? 'yes' : 'no'}`,
    '',
    'Theme tokens:',
    renderList(component.styling.themeTokens),
    '',
    'Internal selectors:',
    renderList(component.styling.internalSelectors),
    '',
    '### AI do',
    '',
    renderList(component.aiRules.do),
    '',
    '### AI do not',
    '',
    renderList(component.aiRules.dont),
    '',
    examples,
  ].join('\n')
}

export function renderAiMarkdown(metadata: ZeusWebAiMetadata): string {
  return [
    '# Zeus Web AI Guide',
    '',
    'This file is generated from `@zeus-web/ai` metadata.',
    '',
    '## Recommended workflow',
    '',
    renderList(metadata.recommendedWorkflow),
    '',
    '## Themes',
    '',
    renderList(metadata.themes.map(theme => `\`${theme}\``)),
    '',
    '## Global AI rules: do',
    '',
    renderList(metadata.globalRules.do),
    '',
    '## Global AI rules: do not',
    '',
    renderList(metadata.globalRules.dont),
    '',
    '# Components',
    '',
    metadata.components.map(renderComponent).join('\n\n---\n\n'),
    '',
  ].join('\n')
}

export function renderAiJson(metadata: ZeusWebAiMetadata): string {
  return `${JSON.stringify(metadata, null, 2)}\n`
}
