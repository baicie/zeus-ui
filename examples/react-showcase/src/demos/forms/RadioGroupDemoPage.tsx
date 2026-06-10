import { RadioGroup, RadioGroupItem } from '@zeus-web/radio-group/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

export function RadioGroupDemoPage() {
  const [value, setValue] = useState('weekly')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Radio Group capability page"
      description="Tests RadioGroup orientation, sizes, controlled value, disabled items and valueChange events."
      meta={
        <>
          <span className="showcase-badge">radio-group</span>
          <span className="showcase-badge">@zeus-web/radio-group/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <RadioGroup defaultValue="daily" ariaLabel="Notification frequency">
          <RadioGroupItem value="daily">Daily</RadioGroupItem>
          <RadioGroupItem value="weekly">Weekly</RadioGroupItem>
          <RadioGroupItem value="monthly">Monthly</RadioGroupItem>
        </RadioGroup>
      </DemoSection>

      <DemoSection title="Orientation and sizes">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <strong>Horizontal</strong>
            <RadioGroup orientation="horizontal" defaultValue="staging">
              <RadioGroupItem value="dev">Dev</RadioGroupItem>
              <RadioGroupItem value="staging">Staging</RadioGroupItem>
              <RadioGroupItem value="prod">Prod</RadioGroupItem>
            </RadioGroup>
          </div>

          <div className="showcase-demo-card">
            <strong>Large</strong>
            <RadioGroup size="lg" defaultValue="owner">
              <RadioGroupItem value="viewer">Viewer</RadioGroupItem>
              <RadioGroupItem value="editor">Editor</RadioGroupItem>
              <RadioGroupItem value="owner">Owner</RadioGroupItem>
            </RadioGroup>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="States">
        <DemoGrid columns={2}>
          <RadioGroup disabled defaultValue="disabled">
            <RadioGroupItem value="disabled">Disabled group</RadioGroupItem>
            <RadioGroupItem value="other">Other</RadioGroupItem>
          </RadioGroup>

          <RadioGroup invalid required defaultValue="required">
            <RadioGroupItem value="required">Required invalid</RadioGroupItem>
            <RadioGroupItem value="other">Other</RadioGroupItem>
          </RadioGroup>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <RadioGroup
            value={value}
            name="react-controlled-radio"
            onValueChange={(event: unknown) => {
              const next = readDetailValue(event, value)
              setValue(next)
              events.log('value-change', { value: next })
            }}
          >
            <RadioGroupItem value="daily">Daily</RadioGroupItem>
            <RadioGroupItem value="weekly">Weekly</RadioGroupItem>
            <RadioGroupItem value="monthly">Monthly</RadioGroupItem>
          </RadioGroup>

          <div className="showcase-demo-card">
            <strong>Selected</strong>
            <pre className="showcase-code">{value}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'value-change',
              reactName: 'onValueChange',
              vueName: 'value-change',
              description: 'Emitted when selected value changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'value',
              type: 'string',
              description: 'Controlled selected value.',
            },
            {
              name: 'defaultValue',
              type: 'string',
              description: 'Initial uncontrolled value.',
            },
            {
              name: 'orientation',
              type: "'horizontal' | 'vertical'",
              defaultValue: "'vertical'",
              description: 'Radio group layout direction.',
            },
            {
              name: 'size',
              type: "'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: 'Radio item size.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['primary', 'ring', 'muted-foreground']} />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <strong>Deployment strategy</strong>
          <RadioGroup defaultValue="rolling" name="deployment-strategy">
            <RadioGroupItem value="rolling">Rolling deployment</RadioGroupItem>
            <RadioGroupItem value="blue-green">
              Blue/green deployment
            </RadioGroupItem>
            <RadioGroupItem value="canary">Canary deployment</RadioGroupItem>
          </RadioGroup>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
