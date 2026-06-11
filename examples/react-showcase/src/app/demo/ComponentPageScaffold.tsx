import type { ShowcaseComponent } from '@zeus-web/example-showcase-shared'
import {
  getShowcaseSectionDefinition,
  sortShowcaseSections,
} from '@zeus-web/example-showcase-shared'

import { DemoGrid } from './DemoGrid'
import { DemoPage } from './DemoPage'
import { DemoSection } from './DemoSection'
import { EventLog } from './EventLog'
import { ImportSnippet } from './ImportSnippet'
import { PropTable } from './PropTable'
import { StateMatrix } from './StateMatrix'
import { ThemeTokenPreview } from './ThemeTokenPreview'

export function ComponentPageScaffold(props: { component: ShowcaseComponent }) {
  const component = props.component
  const sortedSections = sortShowcaseSections(component.sections)

  return (
    <DemoPage
      eyebrow={component.group}
      title={component.title}
      description={component.description}
      meta={
        <>
          <span className="showcase-badge">{component.name}</span>
          <span className="showcase-badge">{component.packageName}</span>
        </>
      }
    >
      <DemoSection
        title="Install and imports"
        description="Framework-specific import snippets and registry command."
      >
        <DemoGrid columns={2}>
          <ImportSnippet title="Package" value={component.packageName} />
          <ImportSnippet
            title="Registry command"
            value={component.registryCommand}
          />
          <ImportSnippet title="React" value={component.imports.react} />
          <ImportSnippet title="Vue" value={component.imports.vue} />
          <ImportSnippet
            title="Web Component"
            value={component.imports.webComponent}
          />
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="Planned sections"
        description="The full component page will be implemented using this fixed section contract."
      >
        <div className="showcase-demo-grid showcase-demo-grid-3">
          {sortedSections.map(section => {
            const definition = getShowcaseSectionDefinition(section)

            return (
              <div key={section} className="showcase-card">
                <h3 className="showcase-card-title">{definition.label}</h3>
                <p className="showcase-card-description">
                  {definition.description}
                </p>
                {definition.requiredForMvp ? (
                  <span className="showcase-badge">required</span>
                ) : null}
              </div>
            )
          })}
        </div>
      </DemoSection>

      <DemoSection
        title="States"
        description="State matrix placeholder. Real component rendering is added in later phases."
      >
        <StateMatrix states={component.states} />
      </DemoSection>

      <DemoSection
        title="Events"
        description="Event names and framework callback aliases."
      >
        <EventLog events={component.events} />
      </DemoSection>

      <DemoSection
        title="Props"
        description="Phase 3 provides the table shell. Component-specific prop rows are added later."
      >
        <PropTable rows={[]} />
      </DemoSection>

      <DemoSection
        title="Theme tokens"
        description="Semantic tokens referenced by this component metadata."
      >
        <ThemeTokenPreview tokens={component.themeTokens} />
      </DemoSection>

      <DemoSection
        title="Icon examples"
        description="Icons commonly used with this component."
      >
        {component.iconExamples.length > 0 ? (
          <div className="showcase-demo-grid showcase-demo-grid-3">
            {component.iconExamples.map(icon => (
              <div key={icon} className="showcase-card">
                <span className="showcase-badge">{icon}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="showcase-empty">No icon examples planned.</div>
        )}
      </DemoSection>

      <DemoSection
        title="Production patterns"
        description="Real-world usage scenarios that later demo pages must cover."
      >
        <div className="showcase-card">
          <ul className="showcase-list">
            {component.productionPatterns.map(pattern => (
              <li key={pattern}>{pattern}</li>
            ))}
          </ul>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
