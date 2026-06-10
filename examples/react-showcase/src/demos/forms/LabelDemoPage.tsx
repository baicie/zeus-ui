import { Input } from '@zeus-web/input/react'
import { Label } from '@zeus-web/label/react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { PropTable } from '../../app/demo/PropTable'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'

export function LabelDemoPage() {
  return (
    <DemoPage
      eyebrow="Forms"
      title="Label capability page"
      description="Tests Label sizes, required marker, disabled state, visually hidden labels and production form association."
      meta={
        <>
          <span className="showcase-badge">label</span>
          <span className="showcase-badge">@zeus-web/label/react</span>
        </>
      }
    >
      <DemoSection
        title="Basic"
        description="Label associated with a form control."
      >
        <div className="showcase-demo-card">
          <Label for="react-label-email">Email</Label>
          <Input id="react-label-email" placeholder="user@example.com" />
        </div>
      </DemoSection>

      <DemoSection title="Sizes" description="Small, medium and large labels.">
        <DemoGrid columns={3}>
          <div className="showcase-demo-card">
            <Label size="sm" for="react-label-sm">
              Small label
            </Label>
            <Input id="react-label-sm" size="sm" placeholder="Small field" />
          </div>

          <div className="showcase-demo-card">
            <Label size="md" for="react-label-md">
              Medium label
            </Label>
            <Input id="react-label-md" size="md" placeholder="Medium field" />
          </div>

          <div className="showcase-demo-card">
            <Label size="lg" for="react-label-lg">
              Large label
            </Label>
            <Input id="react-label-lg" size="lg" placeholder="Large field" />
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection
        title="States"
        description="Required, disabled and visually hidden states."
      >
        <DemoGrid columns={3}>
          <div className="showcase-demo-card">
            <Label required for="react-label-required">
              Required field
            </Label>
            <Input id="react-label-required" required placeholder="Required" />
          </div>

          <div className="showcase-demo-card">
            <Label disabled for="react-label-disabled">
              Disabled field
            </Label>
            <Input id="react-label-disabled" disabled placeholder="Disabled" />
          </div>

          <div className="showcase-demo-card">
            <Label visuallyHidden for="react-label-hidden">
              Hidden accessible label
            </Label>
            <Input
              id="react-label-hidden"
              placeholder="Label is visually hidden"
            />
            <span className="showcase-badge">visuallyHidden</span>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Props">
        <PropTable
          rows={[
            {
              name: 'for',
              type: 'string',
              description: 'Associates the label with a form control id.',
            },
            {
              name: 'size',
              type: "'sm' | 'md' | 'lg'",
              defaultValue: "'md'",
              description: 'Controls label size.',
            },
            {
              name: 'required',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Shows required indicator.',
            },
            {
              name: 'disabled',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Marks label as disabled.',
            },
            {
              name: 'visuallyHidden',
              type: 'boolean',
              defaultValue: 'false',
              description: 'Keeps label accessible while hiding it visually.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['foreground', 'destructive', 'muted-foreground']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <div className="showcase-demo-card showcase-form-stack">
          <div className="showcase-field">
            <Label required for="react-project-name">
              Project name
            </Label>
            <Input
              id="react-project-name"
              placeholder="observability-platform"
            />
          </div>

          <div className="showcase-field">
            <Label for="react-project-owner">Owner email</Label>
            <Input id="react-project-owner" placeholder="owner@example.com" />
          </div>
        </div>
      </DemoSection>
    </DemoPage>
  )
}
