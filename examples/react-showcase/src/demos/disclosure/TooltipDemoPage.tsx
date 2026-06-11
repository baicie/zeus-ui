import { Button } from '@zeus-web/button/react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@zeus-web/tooltip/react'

import { useState } from 'react'
import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailOpen, useDemoEventLog } from '../p0/event-utils'

const sides = ['top', 'right', 'bottom', 'left'] as const

export function TooltipDemoPage() {
  const [open, setOpen] = useState(false)
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Overlay"
      title="Tooltip capability page"
      description="Tests Tooltip trigger/content composition, side placement, controlled open state, delay duration and openChange events."
      meta={
        <>
          <span className="showcase-badge">tooltip</span>
          <span className="showcase-badge">@zeus-web/tooltip/react</span>
        </>
      }
    >
      <DemoSection title="Basic" description="Hover or focus the trigger.">
        <Tooltip>
          <TooltipTrigger>
            <Button variant="outline">Hover for tooltip</Button>
          </TooltipTrigger>
          <TooltipContent>Helpful context for this action.</TooltipContent>
        </Tooltip>
      </DemoSection>

      <DemoSection title="Sides" description="Tooltip content side variants.">
        <DemoGrid columns={4}>
          {sides.map(side => (
            <Tooltip key={side} defaultOpen>
              <TooltipTrigger>
                <Button variant="outline">{side}</Button>
              </TooltipTrigger>
              <TooltipContent side={side} forceMount>
                {side} tooltip
              </TooltipContent>
            </Tooltip>
          ))}
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="Controlled"
        description="Controlled open state synchronized with React state."
      >
        <DemoGrid columns={2}>
          <Tooltip
            open={open}
            delayDuration={0}
            onOpenChange={(event: unknown) => {
              const next = readDetailOpen(event, open)
              setOpen(next)
              events.log('open-change', { open: next })
            }}
          >
            <TooltipTrigger>
              <Button variant="primary">Controlled tooltip</Button>
            </TooltipTrigger>
            <TooltipContent forceMount>
              Controlled tooltip content.
            </TooltipContent>
          </Tooltip>

          <div className="showcase-demo-card">
            <strong>Open</strong>
            <pre className="showcase-code">{String(open)}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="States">
        <DemoGrid columns={2}>
          <Tooltip disabled defaultOpen>
            <TooltipTrigger>
              <Button variant="outline">Disabled tooltip</Button>
            </TooltipTrigger>
            <TooltipContent forceMount>
              This should not open from trigger interaction.
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={800}>
            <TooltipTrigger>
              <Button variant="outline">Delayed tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>Opens after 800ms.</TooltipContent>
          </Tooltip>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'open-change',
              reactName: 'onOpenChange',
              vueName: 'open-change',
              description: 'Emitted when tooltip open state changes.',
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
              description: 'Disables tooltip interaction.',
            },
            {
              name: 'delayDuration',
              type: 'number',
              defaultValue: '300',
              description: 'Delay before opening on hover/focus.',
            },
            {
              name: 'side',
              type: "'top' | 'right' | 'bottom' | 'left'",
              defaultValue: "'top'",
              description: 'Preferred content side.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['popover', 'popover-foreground', 'border', 'ring']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-production-row">
          <Tooltip>
            <TooltipTrigger>
              <Button variant="outline">Deploy</Button>
            </TooltipTrigger>
            <TooltipContent>
              Deploys the current canary to production.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button variant="danger">Rollback</Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Immediately rolls back to the previous stable version.
            </TooltipContent>
          </Tooltip>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
