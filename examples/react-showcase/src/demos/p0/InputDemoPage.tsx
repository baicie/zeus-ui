import { EyeIcon, SearchIcon } from '@zeus-web/icons/react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from './event-utils'

export function InputDemoPage() {
  const [value, setValue] = useState('zeus')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Input capability page"
      description="Tests Input types, sizes, controlled value, formatter, focus events and validation states."
      meta={
        <>
          <span className="showcase-badge">input</span>
          <span className="showcase-badge">@/components/ui/input</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <Input placeholder="Email address" type="email" />
          </div>
          <div className="showcase-demo-card">
            <Input defaultValue="Default value" />
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Types and sizes">
        <DemoGrid columns={3}>
          <Input size="sm" placeholder="Small search" type="search" />
          <Input size="md" placeholder="Medium email" type="email" />
          <Input size="lg" placeholder="Large password" type="password" />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="States">
        <DemoGrid columns={3}>
          <Input disabled placeholder="Disabled" />
          <Input readonly value="Readonly" />
          <Input invalid ariaErrormessage="input-error" placeholder="Invalid" />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <Input
              value={value}
              placeholder="Controlled input"
              onValueChange={(event: unknown) => {
                const next = readDetailValue(event, value)
                setValue(next)
                events.log('value-change', { value: next })
              }}
              onFocusChange={(event: unknown) => {
                events.log('focus-change', event)
              }}
            />
          </div>
          <div className="showcase-demo-card">
            <strong>Current value</strong>
            <pre className="showcase-code">{value}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="With icons">
        <DemoGrid columns={2}>
          <Input placeholder="Search docs">
            <SearchIcon slot="prefix" width="16" height="16" />
          </Input>

          <Input type="password" placeholder="Password">
            <EyeIcon slot="suffix" width="16" height="16" />
          </Input>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Formatter">
        <Input
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
              description: 'Emitted when input value changes.',
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

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['input', 'ring', 'muted-foreground', 'destructive']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <label className="showcase-field">
            <span>Project name</span>
            <Input placeholder="observability-platform" required />
          </label>
          <label className="showcase-field">
            <span>Search members</span>
            <Input placeholder="Search by email">
              <SearchIcon slot="prefix" width="16" height="16" />
            </Input>
          </label>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
