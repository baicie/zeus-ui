import { Skeleton } from '@zeus-web/skeleton/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

export function SkeletonDemoPage() {
  return (
    <DemoPage
      eyebrow="Feedback"
      title="Skeleton capability page"
      description="Tests Skeleton variants, animation toggle and loading-card composition."
      meta={
        <>
          <span className="showcase-badge">skeleton</span>
          <span className="showcase-badge">@zeus-web/skeleton/react</span>
        </>
      }
    >
      <DemoSection title="Variants">
        <DemoGrid columns={3}>
          <div className="showcase-demo-card">
            <Skeleton variant="text" />
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>

          <div className="showcase-demo-card">
            <Skeleton variant="rect" />
          </div>

          <div className="showcase-demo-card">
            <Skeleton variant="circle" />
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Animation">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <strong>Animated</strong>
            <Skeleton animated variant="rect" />
          </div>

          <div className="showcase-demo-card">
            <strong>Static</strong>
            <Skeleton animated={false} variant="rect" />
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <div className="showcase-loading-row">
            <Skeleton variant="circle" />
            <div className="showcase-loading-stack">
              <Skeleton variant="text" />
              <Skeleton variant="text" />
            </div>
          </div>
          <Skeleton variant="rect" />
        </div>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'variant',
              type: "'text' | 'rect' | 'circle'",
              defaultValue: "'rect'",
              description: 'Skeleton shape variant.',
            },
            {
              name: 'animated',
              type: 'boolean',
              defaultValue: 'true',
              description: 'Enables loading animation.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['muted', 'muted-foreground']} />
      </DemoSection>
    </DemoPage>
  )
}
