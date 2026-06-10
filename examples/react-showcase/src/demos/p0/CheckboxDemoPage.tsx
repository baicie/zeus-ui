import { Checkbox } from '@zeus-web/checkbox/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailChecked, useDemoEventLog } from './event-utils'

export function CheckboxDemoPage() {
  const [checked, setChecked] = useState(true)
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Checkbox capability page"
      description="Tests checked, defaultChecked, indeterminate, disabled, invalid and checkedChange."
      meta={
        <>
          <span className="showcase-badge">checkbox</span>
          <span className="showcase-badge">@zeus-web/checkbox/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={3}>
          <Checkbox>Accept terms</Checkbox>
          <Checkbox defaultChecked>Default checked</Checkbox>
          <Checkbox indeterminate>Indeterminate</Checkbox>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes and states">
        <DemoGrid columns={3}>
          <Checkbox size="sm">Small</Checkbox>
          <Checkbox size="md">Medium</Checkbox>
          <Checkbox size="lg">Large</Checkbox>
          <Checkbox disabled>Disabled</Checkbox>
          <Checkbox invalid>Invalid</Checkbox>
          <Checkbox required>Required</Checkbox>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Checkbox
            checked={checked}
            onCheckedChange={(event: unknown) => {
              const next = readDetailChecked(event, checked)
              setChecked(next)
              events.log('checked-change', { checked: next })
            }}
          >
            Controlled checkbox
          </Checkbox>

          <div className="showcase-demo-card">
            <strong>Checked</strong>
            <pre className="showcase-code">{String(checked)}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'checked-change',
              reactName: 'onCheckedChange',
              vueName: 'checked-change',
              description: 'Emitted when checked state changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['primary', 'primary-foreground', 'ring']} />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <Checkbox defaultChecked>Enable product analytics</Checkbox>
          <Checkbox>Send weekly summary email</Checkbox>
          <Checkbox invalid required>
            I understand this destructive action
          </Checkbox>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
