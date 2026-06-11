import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@zeus-web/collapsible/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailOpen, useDemoEventLog } from '../p0/event-utils'

export function CollapsibleDemoPage() {
  const [open, setOpen] = useState(true)
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Disclosure"
      title="Collapsible capability page"
      description="Tests Collapsible uncontrolled state, controlled open state, disabled trigger, force mounted content and openChange events."
      meta={
        <>
          <span className="showcase-badge">collapsible</span>
          <span className="showcase-badge">@zeus-web/collapsible/react</span>
        </>
      }
    >
      <DemoSection
        title="Basic"
        description="Uncontrolled collapsible disclosure."
      >
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle release notes</CollapsibleTrigger>
          <CollapsibleContent>
            <div className="showcase-disclosure-panel">
              Canary build includes route shell, component metadata and visual
              demos.
            </div>
          </CollapsibleContent>
        </Collapsible>
      </DemoSection>

      <DemoSection
        title="Controlled"
        description="Open state synchronized with React state."
      >
        <DemoGrid columns={2}>
          <Collapsible
            open={open}
            onOpenChange={(event: unknown) => {
              const next = readDetailOpen(event, open)
              setOpen(next)
              events.log('open-change', { open: next })
            }}
          >
            <CollapsibleTrigger>Toggle controlled panel</CollapsibleTrigger>
            <CollapsibleContent>
              <div className="showcase-disclosure-panel">
                Controlled content is {open ? 'open' : 'closed'}.
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="showcase-demo-card">
            <strong>Open</strong>
            <pre className="showcase-code">{String(open)}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="States"
        description="Disabled and force mounted content states."
      >
        <DemoGrid columns={2}>
          <Collapsible disabled defaultOpen>
            <CollapsibleTrigger>Disabled trigger</CollapsibleTrigger>
            <CollapsibleContent>
              <div className="showcase-disclosure-panel">Disabled content</div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger>Force mounted content</CollapsibleTrigger>
            <CollapsibleContent forceMount>
              <div className="showcase-disclosure-panel">
                This stays mounted and toggles visibility state.
              </div>
            </CollapsibleContent>
          </Collapsible>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'open-change',
              reactName: 'onOpenChange',
              vueName: 'open-change',
              description: 'Emitted when collapsible open state changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'open',
              type: 'boolean',
              description: 'Controlled open state.',
            },
            {
              name: 'defaultOpen',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Initial uncontrolled open state.',
            },
            {
              name: 'disabled',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Disables trigger interaction.',
            },
            {
              name: 'forceMount',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Keeps content mounted when closed.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['border', 'muted', 'muted-foreground', 'ring']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <Collapsible defaultOpen>
            <CollapsibleTrigger>Advanced deployment options</CollapsibleTrigger>
            <CollapsibleContent>
              <div className="showcase-disclosure-panel showcase-form-stack">
                <span>Traffic split: 20% canary</span>
                <span>Rollback policy: automatic on error-rate spike</span>
                <span>Owner approval: required</span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
