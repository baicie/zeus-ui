import { Switch } from '@zeus-web/switch/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailChecked, useDemoEventLog } from './event-utils'

export function SwitchDemoPage() {
  const [checked, setChecked] = useState(false)
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Forms"
      title="Switch capability page"
      description="Tests switch on/off states, sizes, controlled usage and checkedChange events."
      meta={
        <>
          <span className="showcase-badge">switch</span>
          <span className="showcase-badge">@zeus-web/switch/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={3}>
          <Switch>Notifications</Switch>
          <Switch defaultChecked>Enabled</Switch>
          <Switch disabled>Disabled</Switch>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes and states">
        <DemoGrid columns={3}>
          <Switch size="sm">Small</Switch>
          <Switch size="md">Medium</Switch>
          <Switch size="lg">Large</Switch>
          <Switch invalid>Invalid</Switch>
          <Switch required>Required</Switch>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Switch
            checked={checked}
            onCheckedChange={(event: unknown) => {
              const next = readDetailChecked(event, checked)
              setChecked(next)
              events.log('checked-change', { checked: next })
            }}
          >
            Controlled switch
          </Switch>

          <div className="showcase-demo-card">
            <strong>Enabled</strong>
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
        <ThemeTokenPreview tokens={['primary', 'input', 'ring']} />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <Switch defaultChecked>Enable dark mode</Switch>
          <Switch>Send deployment alerts</Switch>
          <Switch defaultChecked>Auto-refresh dashboard</Switch>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
