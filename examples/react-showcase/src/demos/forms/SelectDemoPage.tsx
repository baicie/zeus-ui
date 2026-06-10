import { Select } from '@zeus-web/select/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

export function SelectDemoPage() {
  const [value, setValue] = useState('production')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Select capability page"
      description="Tests Select sizes, disabled/invalid states, controlled value, multiple mode and value/focus events."
      meta={
        <>
          <span className="showcase-badge">select</span>
          <span className="showcase-badge">@zeus-web/select/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={2}>
          <Select defaultValue="staging" ariaLabel="Environment">
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </Select>

          <Select ariaLabel="Role" defaultValue="editor">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </Select>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes and states">
        <DemoGrid columns={3}>
          <Select size="sm" defaultValue="sm" ariaLabel="Small select">
            <option value="sm">Small</option>
          </Select>

          <Select size="md" defaultValue="md" ariaLabel="Medium select">
            <option value="md">Medium</option>
          </Select>

          <Select size="lg" defaultValue="lg" ariaLabel="Large select">
            <option value="lg">Large</option>
          </Select>

          <Select disabled defaultValue="disabled" ariaLabel="Disabled select">
            <option value="disabled">Disabled</option>
          </Select>

          <Select
            invalid
            ariaErrormessage="select-error"
            ariaLabel="Invalid select"
          >
            <option value="">Choose one</option>
          </Select>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Select
            value={value}
            name="react-controlled-select"
            ariaLabel="Controlled environment"
            onValueChange={(event: unknown) => {
              const next = readDetailValue(event, value)
              setValue(next)
              events.log('value-change', { value: next })
            }}
            onFocusChange={(event: unknown) => {
              events.log('focus-change', event)
            }}
          >
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </Select>

          <div className="showcase-demo-card">
            <strong>Selected</strong>
            <pre className="showcase-code">{value}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Multiple">
        <Select multiple ariaLabel="Multiple select">
          <option value="rum">RUM</option>
          <option value="logs">Logs</option>
          <option value="traces">Traces</option>
          <option value="metrics">Metrics</option>
        </Select>
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
            {
              name: 'focus-change',
              reactName: 'onFocusChange',
              vueName: 'focus-change',
              description: 'Emitted when focus state changes.',
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
              name: 'multiple',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Enables multiple selection.',
            },
            {
              name: 'invalid',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Marks select as invalid.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['input', 'ring', 'background', 'foreground']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-form-stack">
          <label className="showcase-field">
            <span>Environment</span>
            <Select defaultValue="production" name="environment">
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </Select>
          </label>

          <label className="showcase-field">
            <span>Owner role</span>
            <Select defaultValue="owner" name="role">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </Select>
          </label>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
