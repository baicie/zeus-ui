import type { CSSProperties } from 'react'
import { Button } from '@zeus-web/button/react'
import { Progress } from '@zeus-web/progress/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

type ProgressStyle = CSSProperties & {
  '--showcase-progress-value': number
}

function progressStyle(value: number): ProgressStyle {
  return {
    '--showcase-progress-value': value,
  }
}

export function ProgressDemoPage() {
  const [value, setValue] = useState(64)

  return (
    <DemoPage
      eyebrow="Feedback"
      title="Progress capability page"
      description="Tests determinate, indeterminate, max/value clamping and production progress usage."
      meta={
        <>
          <span className="showcase-badge">progress</span>
          <span className="showcase-badge">@zeus-web/progress/react</span>
        </>
      }
    >
      <DemoSection title="Determinate">
        <DemoGrid columns={3}>
          <Progress
            value={24}
            label="Upload progress"
            style={progressStyle(24)}
          />
          <Progress
            value={64}
            label="Build progress"
            style={progressStyle(64)}
          />
          <Progress
            value={100}
            label="Complete progress"
            style={progressStyle(100)}
          />
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Controlled">
        <div className="showcase-demo-card">
          <Progress
            value={value}
            max={100}
            label="Controlled progress"
            style={progressStyle(value)}
          >
            <span className="showcase-progress-label">{value}%</span>
          </Progress>

          <div className="showcase-production-row">
            <Button
              variant="outline"
              size="sm"
              onPress={() => setValue(current => Math.max(0, current - 10))}
            >
              -10
            </Button>
            <Button
              variant="primary"
              size="sm"
              onPress={() => setValue(current => Math.min(100, current + 10))}
            >
              +10
            </Button>
          </div>
        </div>
      </DemoSection>

      <DemoSection title="Indeterminate">
        <Progress indeterminate label="Loading deployment status" />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card">
          <strong>Release rollout</strong>
          <Progress
            value={72}
            label="Release rollout progress"
            style={progressStyle(72)}
          >
            <span className="showcase-progress-label">72% traffic shifted</span>
          </Progress>
        </div>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'value',
              type: 'number',
              description: 'Current determinate progress value.',
            },
            {
              name: 'max',
              type: 'number',
              defaultValue: '100',
              description: 'Maximum progress value.',
            },
            {
              name: 'indeterminate',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Shows loading state without a known value.',
            },
            {
              name: 'label',
              type: 'string',
              description: 'Accessible label for the progressbar.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview tokens={['primary', 'muted', 'ring']} />
      </DemoSection>
    </DemoPage>
  )
}
