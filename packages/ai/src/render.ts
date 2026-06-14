import type {
  ZeusWebAiAdvancedComponent,
  ZeusWebAiComponent,
  ZeusWebAiMetadata,
} from './types'

function renderList(items: string[]): string {
  return items.map(item => `- ${item}`).join('\n')
}

function renderIcons(metadata: ZeusWebAiMetadata): string {
  const icons = metadata.icons

  return [
    '## Icons',
    '',
    `Package: \`${icons.packageName}\``,
    `Install: \`${icons.installCommand}\``,
    `React: \`${icons.reactImport}\``,
    `Vue: \`${icons.vueImport}\``,
    `Web Component: \`${icons.webComponentImport}\``,
    `Raw SVG: \`${icons.rawSvgImport}\``,
    '',
    'Recommended icons:',
    renderList(icons.recommendedIcons.map(icon => `\`${icon}\``)),
    '',
    'Icon AI do:',
    renderList(icons.aiRules.do),
    '',
    'Icon AI do not:',
    renderList(icons.aiRules.dont),
  ].join('\n')
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

function renderAdvancedComponent(
  component: ZeusWebAiAdvancedComponent,
): string {
  const examples = component.examples
    .map(
      example =>
        `### ${example.title}\n\n${example.description}\n\n\`\`\`tsx\n${example.code}\n\`\`\``,
    )
    .join('\n\n')

  return [
    `## ${component.name} (advanced)`,
    '',
    component.summary,
    '',
    `Package: \`${component.packageName}\``,
    `Tags: ${component.tags.map(tag => `\`${tag}\``).join(', ')}`,
    '',
    '### When to use',
    '',
    renderList(component.whenToUse),
    '',
    '### Do not use for',
    '',
    renderList(component.doNotUseFor),
    '',
    '### Components',
    '',
    renderList(component.components.map(tag => `\`${tag}\``)),
    '',
    '### Slots',
    '',
    renderList(
      Object.entries(component.slots).flatMap(([tag, slots]) =>
        slots.map(slot => `\`${tag}\` → \`${slot}\``),
      ),
    ),
    '',
    '### Events',
    '',
    renderList(
      Object.entries(component.events).flatMap(([tag, events]) =>
        events.map(event => `\`${tag}\` → \`${event}\``),
      ),
    ),
    '',
    '### Methods',
    '',
    renderList(
      Object.entries(component.methods).flatMap(([tag, methods]) =>
        methods.map(method => `\`${tag}\` → \`${method}()\``),
      ),
    ),
    '',
    '### Prompt hints',
    '',
    renderList(component.promptHints),
    '',
    examples,
  ].join('\n')
}

export function renderAiMarkdown(metadata: ZeusWebAiMetadata): string {
  const advanced = metadata.advancedComponents ?? []

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
    renderIcons(metadata),
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
    ...(advanced.length === 0
      ? []
      : [
          '',
          '# Advanced components',
          '',
          advanced.map(renderAdvancedComponent).join('\n\n---\n\n'),
        ]),
    '',
  ].join('\n')
}

export function renderAiJson(metadata: ZeusWebAiMetadata): string {
  return `${JSON.stringify(metadata, null, 2)}\n`
}
