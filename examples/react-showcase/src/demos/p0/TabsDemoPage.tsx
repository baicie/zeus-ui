import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zeus-web/tabs/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailValue, useDemoEventLog } from './event-utils'

export function TabsDemoPage() {
  const [value, setValue] = useState('overview')
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Navigation"
      title="Tabs capability page"
      description="Tests tab orientation, controlled value, disabled triggers and valueChange events."
      meta={
        <>
          <span className="showcase-badge">tabs</span>
          <span className="showcase-badge">@zeus-web/tabs/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="showcase-demo-card">Overview panel</div>
          </TabsContent>
          <TabsContent value="usage">
            <div className="showcase-demo-card">Usage panel</div>
          </TabsContent>
          <TabsContent value="api">
            <div className="showcase-demo-card">API panel</div>
          </TabsContent>
        </Tabs>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Tabs
            value={value}
            onValueChange={(event: unknown) => {
              const next = readDetailValue(event, value)
              setValue(next)
              events.log('value-change', { value: next })
            }}
          >
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="showcase-demo-card">Overview settings</div>
            </TabsContent>
            <TabsContent value="billing">
              <div className="showcase-demo-card">Billing settings</div>
            </TabsContent>
            <TabsContent value="security">
              <div className="showcase-demo-card">Security settings</div>
            </TabsContent>
          </Tabs>

          <div className="showcase-demo-card">
            <strong>Active tab</strong>
            <pre className="showcase-code">{value}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Vertical and disabled">
        <Tabs defaultValue="profile" orientation="vertical">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="disabled" disabled>
              Disabled
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="showcase-demo-card">Profile panel</div>
          </TabsContent>
          <TabsContent value="team">
            <div className="showcase-demo-card">Team panel</div>
          </TabsContent>
        </Tabs>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'value-change',
              reactName: 'onValueChange',
              vueName: 'value-change',
              description: 'Emitted when active tab changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['muted', 'muted-foreground', 'ring']} />
      </DemoSection>
    </DemoPage>
  )
}
