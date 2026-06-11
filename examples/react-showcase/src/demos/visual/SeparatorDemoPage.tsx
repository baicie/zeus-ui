import { Separator } from '@zeus-web/separator/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

export function SeparatorDemoPage() {
  return (
    <DemoPage
      eyebrow="Layout"
      title="Separator capability page"
      description="Tests horizontal, vertical, decorative and semantic separators."
      meta={
        <>
          <span className="showcase-badge">separator</span>
          <span className="showcase-badge">@zeus-web/separator/react</span>
        </>
      }
    >
      <DemoSection title="Horizontal">
        <div className="showcase-demo-card">
          <p>Account settings</p>
          <Separator />
          <p className="showcase-form-note">
            Configure billing, members and deployment permissions.
          </p>
        </div>
      </DemoSection>

      <DemoSection title="Vertical">
        <div className="showcase-demo-card showcase-toolbar-row">
          <span>Overview</span>
          <Separator orientation="vertical" />
          <span>Usage</span>
          <Separator orientation="vertical" />
          <span>Settings</span>
        </div>
      </DemoSection>

      <DemoSection title="Semantic separator">
        <DemoGrid columns={2}>
          <div className="showcase-demo-card">
            <strong>Decorative</strong>
            <Separator decorative />
          </div>

          <div className="showcase-demo-card">
            <strong>Semantic</strong>
            <Separator decorative={false} orientation="horizontal" />
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'orientation',
              type: "'horizontal' | 'vertical'",
              defaultValue: "'horizontal'",
              description: 'Separator direction.',
            },
            {
              name: 'decorative',
              type: 'boolean',
              defaultValue: 'true',
              description:
                'Whether the separator is hidden from assistive tech.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['border', 'muted-foreground']} />
      </DemoSection>
    </DemoPage>
  )
}
