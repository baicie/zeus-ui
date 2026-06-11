import { Avatar, AvatarFallback, AvatarImage } from '@zeus-web/avatar/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { useDemoEventLog } from '../p0/event-utils'

export function AvatarDemoPage() {
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Data display"
      title="Avatar capability page"
      description="Tests Avatar sizes, shapes, image/fallback composition and image load/error events."
      meta={
        <>
          <span className="showcase-badge">avatar</span>
          <span className="showcase-badge">@zeus-web/avatar/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <DemoGrid columns={3}>
          <Avatar>
            <AvatarFallback>BC</AvatarFallback>
          </Avatar>

          <Avatar shape="square">
            <AvatarFallback>ZW</AvatarFallback>
          </Avatar>

          <Avatar imageStatus="error">
            <AvatarImage
              src="/missing-avatar.png"
              alt="Missing avatar"
              onImageError={(event: unknown) => {
                events.log('image-error', event)
              }}
            />
            <AvatarFallback>ER</AvatarFallback>
          </Avatar>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes and shapes">
        <DemoGrid columns={3}>
          <Avatar size="sm">
            <AvatarFallback>SM</AvatarFallback>
          </Avatar>

          <Avatar size="md">
            <AvatarFallback>MD</AvatarFallback>
          </Avatar>

          <Avatar size="lg">
            <AvatarFallback>LG</AvatarFallback>
          </Avatar>

          <Avatar shape="circle">
            <AvatarFallback>CI</AvatarFallback>
          </Avatar>

          <Avatar shape="square">
            <AvatarFallback>SQ</AvatarFallback>
          </Avatar>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Fallback">
        <DemoGrid columns={2}>
          <Avatar imageStatus="idle">
            <AvatarFallback delayMs={0}>JD</AvatarFallback>
          </Avatar>

          <Avatar imageStatus="loading">
            <AvatarFallback delayMs={300}>LD</AvatarFallback>
          </Avatar>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'image-load',
              reactName: 'onImageLoad',
              vueName: 'image-load',
              description: 'Emitted when avatar image loads.',
            },
            {
              name: 'image-error',
              reactName: 'onImageError',
              vueName: 'image-error',
              description: 'Emitted when avatar image fails.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'size',
              type: "'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: 'Avatar size.',
            },
            {
              name: 'shape',
              type: "'circle' | 'square'",
              defaultValue: "'circle'",
              description: 'Avatar shape.',
            },
            {
              name: 'imageStatus',
              type: "'idle' | 'loading' | 'loaded' | 'error'",
              defaultValue: "'idle'",
              description: 'Current image loading status.',
            },
            {
              name: 'delayMs',
              type: 'number',
              defaultValue: '0',
              description: 'AvatarFallback display delay in milliseconds.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['muted', 'muted-foreground', 'border']} />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-user-row">
          <Avatar size="lg">
            <AvatarFallback>BC</AvatarFallback>
          </Avatar>
          <div>
            <strong>bai cie</strong>
            <p className="showcase-form-note">Maintainer · Zeus Web</p>
          </div>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
