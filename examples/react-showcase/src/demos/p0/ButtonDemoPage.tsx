import { Button } from '@zeus-web/button/react'
import {
  CheckIcon,
  LoaderIcon,
  PlusIcon,
  TrashIcon,
} from '@zeus-web/icons/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { useDemoEventLog } from './event-utils'

export function ButtonDemoPage() {
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Actions"
      title="Button capability page"
      description="Tests Button variants, sizes, states, icon slots, press events and production usage."
      meta={
        <>
          <span className="showcase-badge">button</span>
          <span className="showcase-badge">@zeus-web/button/react</span>
        </>
      }
    >
      <DemoSection title="Basic" description="Default button usage.">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <Button onPress={() => events.log('press', 'Default button')}>
              Default button
            </Button>
          </div>
          <div className="showcase-demo-card">
            <Button
              variant="primary"
              onPress={() => events.log('press', 'Primary CTA')}
            >
              Primary CTA
            </Button>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Variants" description="Semantic visual variants.">
        <DemoGrid columns={3}>
          {(
            [
              'default',
              'primary',
              'secondary',
              'outline',
              'ghost',
              'danger',
            ] as const
          ).map(variant => (
            <div key={variant} className="showcase-demo-card">
              <Button
                variant={variant}
                onPress={() => events.log('press', variant)}
              >
                {variant}
              </Button>
            </div>
          ))}
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="Sizes"
        description="Size presets including icon-only."
      >
        <DemoGrid columns={3}>
          <div className="showcase-demo-card">
            <Button size="sm">Small</Button>
          </div>
          <div className="showcase-demo-card">
            <Button size="md">Medium</Button>
          </div>
          <div className="showcase-demo-card">
            <Button size="lg">Large</Button>
          </div>
          <div className="showcase-demo-card">
            <Button size="icon" ariaLabel="Add item">
              <PlusIcon slot="prefix" width="16" height="16" />
            </Button>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="States"
        description="Disabled, loading and pressed states."
      >
        <DemoGrid columns={3}>
          <div className="showcase-demo-card">
            <Button disabled>Disabled</Button>
          </div>
          <div className="showcase-demo-card">
            <Button loading>
              <LoaderIcon slot="prefix" width="16" height="16" />
              Loading
            </Button>
          </div>
          <div className="showcase-demo-card">
            <Button pressed>Pressed</Button>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="With icons"
        description="Prefix and suffix slot composition."
      >
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <Button variant="primary">
              <CheckIcon slot="prefix" width="16" height="16" />
              Confirm
            </Button>
          </div>
          <div className="showcase-demo-card">
            <Button variant="danger">
              Delete
              <TrashIcon slot="suffix" width="16" height="16" />
            </Button>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events" description="Press event log.">
        <EventLog
          events={[
            {
              name: 'press',
              reactName: 'onPress',
              vueName: 'press',
              description: 'Emitted when the button is activated.',
            },
          ]}
        />

        <div className="showcase-event-feed">
          {events.records.length === 0 ? (
            <div className="showcase-empty">
              Click a button to record events.
            </div>
          ) : (
            events.records.map(record => (
              <div key={record.id} className="showcase-event-record">
                <strong>{record.name}</strong>
                {record.detail ? <span>{record.detail}</span> : null}
              </div>
            ))
          )}
        </div>
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={[
            'primary',
            'primary-foreground',
            'ring',
            'border',
            'destructive',
          ]}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-production-row">
          <Button variant="outline">Cancel</Button>
          <Button variant="primary">Save changes</Button>
          <Button variant="danger">
            <TrashIcon slot="prefix" width="16" height="16" />
            Delete project
          </Button>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
