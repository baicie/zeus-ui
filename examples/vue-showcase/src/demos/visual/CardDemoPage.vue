<script setup lang="ts">
import { Badge } from '@zeus-web/badge/vue'
import { Button } from '@zeus-web/button/vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@zeus-web/card/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
</script>

<template>
  <DemoPage
    eyebrow="Layout"
    title="Card capability page"
    description="Tests Card composition, header/content/footer layout, nested badges and production dashboard usage."
  >
    <template #meta>
      <span class="showcase-badge">card</span>
      <span class="showcase-badge">@zeus-web/card/vue</span>
    </template>

    <DemoSection title="Basic" description="Composable card regions.">
      <Card>
        <CardHeader>
          <CardTitle>Project health</CardTitle>
          <CardDescription>
            Current deployment quality and operational signals.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p class="showcase-form-note">
            No critical regressions detected in the latest canary.
          </p>
        </CardContent>

        <CardFooter>
          <Button size="sm" variant="primary">View report</Button>
        </CardFooter>
      </Card>
    </DemoSection>

    <DemoSection title="Compositions">
      <DemoGrid :columns="3">
        <Card>
          <CardHeader>
            <CardTitle>Errors</CardTitle>
            <CardDescription>Last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="showcase-metric">12</div>
            <Badge variant="danger">+3</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latency</CardTitle>
            <CardDescription>P95 response time</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="showcase-metric">188ms</div>
            <Badge variant="success">stable</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>Active users</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="showcase-metric">4.2k</div>
            <Badge variant="secondary">live</Badge>
          </CardContent>
        </Card>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="[]" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['card', 'card-foreground', 'border', 'muted-foreground']"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-dashboard-grid">
        <Card>
          <CardHeader>
            <CardTitle>Release readiness</CardTitle>
            <CardDescription> Production deployment summary. </CardDescription>
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
</template>
