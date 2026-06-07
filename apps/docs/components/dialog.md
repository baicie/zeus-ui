# Dialog

Dialog is built on `@zeus-web/dialog`.

## Add

```bash
zweb add dialog
```

## Import

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
```

## Usage

```tsx
import { Button } from '@/components/ui/button'

export function Example() {
  return (
    <Dialog>
      <DialogTrigger>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Title</DialogTitle>
        <DialogDescription>Description</DialogDescription>
      </DialogContent>
    </Dialog>
  )
}
```

## Props

```txt
open: boolean
defaultOpen: boolean
modal: boolean
```

## Events

```txt
onOpenChange
```

## Notes

Dialog is still MVP-level. Focus trap and advanced accessibility behavior should be improved in the accessibility phase.
