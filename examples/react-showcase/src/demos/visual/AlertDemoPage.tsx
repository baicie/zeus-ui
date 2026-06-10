import { Alert, AlertDescription, AlertTitle } from '@zeus-web/alert/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

const variants = ['default', 'info', 'success', 'warning', 'danger'] as const

export function AlertDemoPage() {
  return (
    <DemoPage
      eyebrow="Feedback"
      title="Alert capability page"
      description="Tests Alert variants, live region behavior and production incident messaging."
      meta={
        <>
          <span className="showcase-badge">alert</span>
          <span className="showcase-badge">@zeus-web/alert/react</span>
        </>
      }
    >
      <DemoSection title="Variants">
        <DemoGrid columns={2}>
          {variants.map(variant => (
            <Alert key={variant} variant={variant}>
              <AlertTitle>{variant} alert</AlertTitle>
              <AlertDescription>
                This is a {variant} message for operational feedback.
              </AlertDescription>
            </Alert>
          ))}
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Live regions">
        <DemoGrid columns={3}>
          <Alert live="polite" variant="info">
            <AlertTitle>Polite</AlertTitle>
            <AlertDescription>Non-urgent background status.</AlertDescription>
          </Alert>

          <Alert live="assertive" variant="danger">
            <AlertTitle>Assertive</AlertTitle>
            <AlertDescription>
              Important incident notification.
            </AlertDescription>
          </Alert>

          <Alert live="off">
            <AlertTitle>Off</AlertTitle>
            <AlertDescription>Static decorative message.</AlertDescription>
          </Alert>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Production pattern">
        <Alert variant="warning" live="assertive">
          <AlertTitle>Canary degradation detected</AlertTitle>
          <AlertDescription>
            Error rate increased by 2.4% in the last 10 minutes. Check traces
            before promoting.
          </AlertDescription>
        </Alert>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'variant',
              type: "'default' | 'info' | 'success' | 'warning' | 'danger'",
              defaultValue: "'default'",
              description: 'Visual semantic alert variant.',
            },
            {
              name: 'live',
              type: "'polite' | 'assertive' | 'off'",
              defaultValue: "'polite'",
              description: 'ARIA live region politeness.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['background', 'foreground', 'destructive', 'border']}
        />
      </DemoSection>
    </DemoPage>
  )
}
