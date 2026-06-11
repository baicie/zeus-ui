import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@zeus-web/dialog/react'
import { useState } from 'react'

import { DemoGrid } from '../../app/demo/DemoGrid'
import { DemoPage } from '../../app/demo/DemoPage'
import { DemoSection } from '../../app/demo/DemoSection'
import { EventLog } from '../../app/demo/EventLog'
import { ThemeTokenPreview } from '../../app/demo/ThemeTokenPreview'
import { readDetailOpen, useDemoEventLog } from './event-utils'

export function DialogDemoPage() {
  const [open, setOpen] = useState(false)
  const events = useDemoEventLog()

  return (
    <DemoPage
      eyebrow="Feedback"
      title="Dialog capability page"
      description="Tests dialog trigger, content, title, description, close, controlled open and openChange events."
      meta={
        <>
          <span className="showcase-badge">dialog</span>
          <span className="showcase-badge">@zeus-web/dialog/react</span>
        </>
      }
    >
      <DemoSection title="Basic">
        <Dialog>
          <DialogTrigger>Open basic dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Basic dialog</DialogTitle>
            <DialogDescription>
              This dialog is opened with an uncontrolled trigger.
            </DialogDescription>
            <div className="showcase-demo-card">Dialog body content</div>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>
      </DemoSection>

      <DemoSection title="Controlled">
        <DemoGrid columns={2}>
          <Dialog
            open={open}
            onOpenChange={(event: unknown) => {
              const next = readDetailOpen(event, open)
              setOpen(next)
              events.log('open-change', { open: next })
            }}
          >
            <DialogTrigger>Open controlled dialog</DialogTrigger>
            <DialogContent>
              <DialogTitle>Controlled dialog</DialogTitle>
              <DialogDescription>
                Open state is synchronized with React state.
              </DialogDescription>
              <DialogClose>Close controlled dialog</DialogClose>
            </DialogContent>
          </Dialog>

          <div className="showcase-demo-card">
            <strong>Open</strong>
            <pre className="showcase-code">{String(open)}</pre>
          </div>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="States">
        <DemoGrid columns={2}>
          <Dialog defaultOpen>
            <DialogContent forceMount>
              <DialogTitle>Default open</DialogTitle>
              <DialogDescription>Rendered initially open.</DialogDescription>
              <DialogClose>Close</DialogClose>
            </DialogContent>
          </Dialog>

          <Dialog modal={false}>
            <DialogTrigger>Open non-modal dialog</DialogTrigger>
            <DialogContent>
              <DialogTitle>Non-modal dialog</DialogTitle>
              <DialogDescription>Modal behavior disabled.</DialogDescription>
              <DialogClose>Close</DialogClose>
            </DialogContent>
          </Dialog>
        </DemoGrid>
      </DemoSection>

      <DemoSection title="Events">
        <EventLog
          events={[
            {
              name: 'open-change',
              reactName: 'onOpenChange',
              vueName: 'open-change',
              description: 'Emitted when open state changes.',
            },
          ]}
        />
      </DemoSection>

      <DemoSection title="Theme tokens">
        <ThemeTokenPreview
          tokens={['background', 'foreground', 'ring', 'border']}
        />
      </DemoSection>

      <DemoSection title="Production pattern">
        <Dialog>
          <DialogTrigger>Create project</DialogTrigger>
          <DialogContent>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              This production pattern will include a full form in a later phase.
            </DialogDescription>
            <div className="showcase-demo-card">Project form placeholder</div>
            <DialogClose>Cancel</DialogClose>
          </DialogContent>
        </Dialog>
      </DemoSection>
    </DemoPage>
  )
}
