import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@zeus-web/accordion/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

export function AccordionDemoPage() {
  const [value, setValue] = useState('metrics')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Disclosure"
      title="Accordion capability page"
      description="Tests Accordion single and multiple modes, collapsible behavior, controlled value, disabled items and valueChange events."
      meta={
        <>
          <span className="showcase-badge">accordion</span>
          <span className="showcase-badge">@zeus-web/accordion/react</span>
        </>
      }
    >
      <DemoSection title="Single" description="Default single-item accordion.">
        <Accordion type="single" defaultValue="overview" collapsible>
          <AccordionItem value="overview">
            <AccordionTrigger>Overview</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                The overview panel explains high-level usage.
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="usage">
            <AccordionTrigger>Usage</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                The usage panel explains composition and state.
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DemoSection>

      <DemoSection
        title="Multiple"
        description="Multiple items can be open at the same time."
      >
        <Accordion type="multiple" defaultValue="logs,traces">
          <AccordionItem value="logs">
            <AccordionTrigger>Logs</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                Log pipeline is enabled.
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="traces">
            <AccordionTrigger>Traces</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                Trace sampling is at 20%.
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="metrics">
            <AccordionTrigger>Metrics</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                Metrics scrape interval is 30s.
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DemoSection>

      <DemoSection
        title="Controlled"
        description="Controlled active value synchronized with React state."
      >
        <DemoGrid columns={2}>
          <Accordion
            type="single"
            value={value}
            collapsible
            onValueChange={(event: unknown) => {
              const next = readDetailValue(event, value)
              setValue(next)
              events.log('value-change', { value: next })
            }}
          >
            <AccordionItem value="logs">
              <AccordionTrigger>Logs</AccordionTrigger>
              <AccordionContent>
                <div className="showcase-disclosure-panel">Logs settings</div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="metrics">
              <AccordionTrigger>Metrics</AccordionTrigger>
              <AccordionContent>
                <div className="showcase-disclosure-panel">
                  Metrics settings
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="disabled" disabled>
              <AccordionTrigger>Disabled</AccordionTrigger>
              <AccordionContent>
                <div className="showcase-disclosure-panel">
                  Disabled content
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="showcase-demo-card">
            <strong>Active value</strong>
            <pre className="showcase-code">{value || '(none)'}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Horizontal orientation">
        <Accordion type="single" orientation="horizontal" defaultValue="one">
          <AccordionItem value="one">
            <AccordionTrigger>One</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                Horizontal item one.
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="two">
            <AccordionTrigger>Two</AccordionTrigger>
            <AccordionContent>
              <div className="showcase-disclosure-panel">
                Horizontal item two.
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'value-change',
              reactName: 'onValueChange',
              vueName: 'value-change',
              description: 'Emitted when active accordion item changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'type',
              type: "'single' | 'multiple'",
              defaultValue: "'single'",
              description: 'Controls whether one or many items can be open.',
            },
            {
              name: 'value',
              type: 'string',
              description:
                'Controlled active value. Multiple values are comma-separated.',
            },
            {
              name: 'defaultValue',
              type: 'string',
              description: 'Initial uncontrolled active value.',
            },
            {
              name: 'collapsible',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Allows the active single item to be collapsed.',
            },
            {
              name: 'orientation',
              type: "'vertical' | 'horizontal'",
              defaultValue: "'vertical'",
              description: 'Accordion orientation.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['border', 'muted', 'muted-foreground', 'ring']}
        />
      </DemoSection>
    </DemoPage>
  )
}
