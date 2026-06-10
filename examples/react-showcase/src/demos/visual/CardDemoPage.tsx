import { Badge } from '@zeus-web/badge/react'
import { Button } from '@zeus-web/button/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@zeus-web/card/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

export function CardDemoPage() {
  return (
    <DemoPage
      eyebrow="Layout"
      title="Card capability page"
      description="Tests Card composition, header/content/footer layout, nested badges and production dashboard usage."
      meta={
        <>
          <span className="showcase-badge">card</span>
          <span className="showcase-badge">@zeus-web/card/react</span>
        </>
      }
    >
      <DemoSection title="Basic" description="Composable card regions.">
        <Card>
          <CardHeader>
            <CardTitle>Project health</CardTitle>
            <CardDescription>
              Current deployment quality and operational signals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="showcase-form-note">
              No critical regressions detected in the latest canary.
            </p>
          </CardContent>
          <CardFooter>
            <Button size="sm" variant="primary">
              View report
            </Button>
          </CardFooter>
        </Card>
      </DemoSection>

      <DemoSection
        title="Compositions"
        description="Cards can host badges, actions and metrics."
      >
        <DemoGrid columns={3}>
          <Card>
            <CardHeader>
              <CardTitle>Errors</CardTitle>
              <CardDescription>Last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="showcase-metric">12</div>
              <Badge variant="danger">+3</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Latency</CardTitle>
              <CardDescription>P95 response time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="showcase-metric">188ms</div>
              <Badge variant="success">stable</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>Active users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="showcase-metric">4.2k</div>
              <Badge variant="secondary">live</Badge>
            </CardContent>
          </Card>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable rows={[]} />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['card', 'card-foreground', 'border', 'muted-foreground']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-dashboard-grid">
          <Card>
            <CardHeader>
              <CardTitle>Release readiness</CardTitle>
              <CardDescription>Production deployment summary.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>All smoke checks passed. Canary traffic is healthy.</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline">Cancel</Button>
              <Button variant="primary">Ship release</Button>
            </CardFooter>
          </Card>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
