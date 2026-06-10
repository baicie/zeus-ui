import { Textarea } from '@zeus-web/textarea/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

export function TextareaDemoPage() {
  const [value, setValue] = useState('Initial deployment note')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Textarea capability page"
      description="Tests Textarea sizes, resize modes, controlled value, formatter, validation and value/focus events."
      meta={
        <>
          <span className="showcase-badge">textarea</span>
          <span className="showcase-badge">@zeus-web/textarea/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={2}>
          <Textarea placeholder="Write a message..." rows={4} />
          <Textarea defaultValue="Default value" rows={4} />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes and resize">
        <DemoGrid columns={3}>
          <Textarea size="sm" resize="none" placeholder="Small / no resize" />
          <Textarea
            size="md"
            resize="vertical"
            placeholder="Medium / vertical"
          />
          <Textarea size="lg" resize="both" placeholder="Large / both" />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="States">
        <DemoGrid columns={3}>
          <Textarea disabled placeholder="Disabled" />
          <Textarea readonly value="Readonly" />
          <Textarea
            invalid
            aria-errormessage="textarea-error"
            placeholder="Invalid"
          />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Textarea
            value={value}
            rows={5}
            placeholder="Controlled textarea"
            onValueChange={(event: unknown) => {
              const next = readDetailValue(event, value)
              setValue(next)
              events.log('value-change', { value: next })
            }}
            onFocusChange={(event: unknown) => {
              events.log('focus-change', event)
            }}
          />

          <div className="showcase-demo-card">
            <strong>Current value</strong>
            <pre className="showcase-code">{value}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Formatter">
        <Textarea
          placeholder="Uppercase formatter"
          formatter={(input: string) => input.toUpperCase()}
          onValueChange={(event: unknown) => {
            events.log('formatted-value-change', {
              value: readDetailValue(event),
            })
          }}
        />
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'value-change',
              reactName: 'onValueChange',
              vueName: 'value-change',
              description: 'Emitted when textarea value changes.',
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
              description: 'Controlled textarea value.',
            },
            {
              name: 'defaultValue',
              type: 'string',
              description: 'Initial uncontrolled value.',
            },
            {
              name: 'resize',
              type: "'none' | 'vertical' | 'horizontal' | 'both'",
              defaultValue: "'vertical'",
              description: 'Textarea resize behavior.',
            },
            {
              name: 'formatter',
              type: '(value: string) => string',
              description: 'Formats text before emitting value-change.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['input', 'ring', 'muted-foreground', 'destructive']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-form-stack">
          <Textarea
            rows={5}
            maxlength={240}
            placeholder="Describe the release risk and rollback plan..."
          >
            <span slot="message">
              Max 240 characters. Include rollback plan.
            </span>
          </Textarea>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
