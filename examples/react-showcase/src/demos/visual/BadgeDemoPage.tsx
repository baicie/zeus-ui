import { Badge } from '@zeus-web/badge/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

const variants = [
  'default',
  'secondary',
  'outline',
  'danger',
  'success',
  'warning',
] as const
const sizes = ['sm', 'md', 'lg'] as const

export function BadgeDemoPage() {
  return (
    <DemoPage
      eyebrow="Feedback"
      title="Badge capability page"
      description="Tests Badge variants, sizes and production status usage."
      meta={
        <>
          <span className="showcase-badge">badge</span>
          <span className="showcase-badge">@zeus-web/badge/react</span>
        </>
      }
    >
      <DemoSection title="Variants">
        <DemoGrid columns={3}>
          {variants.map(variant => (
            <div key={variant} className="showcase-demo-card">
              <Badge variant={variant}>{variant}</Badge>
            </div>
          ))}
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Sizes">
        <DemoGrid columns={3}>
          {sizes.map(size => (
            <div key={size} className="showcase-demo-card">
              <Badge size={size}>{size}</Badge>
            </div>
          ))}
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-production-row">
          <Badge variant="success">healthy</Badge>
          <Badge variant="warning">degraded</Badge>
          <Badge variant="danger">incident</Badge>
          <Badge variant="outline">canary</Badge>
        </div>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'variant',
              type: "'default' | 'secondary' | 'outline' | 'danger' | 'success' | 'warning'",
              defaultValue: "'default'",
              description: 'Visual semantic variant.',
            },
            {
              name: 'size',
              type: "'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: 'Badge size.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['primary', 'secondary', 'destructive', 'border']}
        />
      </DemoSection>
    </DemoPage>
  )
}
