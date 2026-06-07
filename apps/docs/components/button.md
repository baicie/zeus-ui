# Button

Button is built on `@zeus-web/button`.

## Add

```bash
zweb add button
```

## Import

```tsx
import { Button } from '@/components/ui/button'
```

## Usage

```tsx
export function Example() {
  return (
    <div className="flex gap-2">
      <Button>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="danger">Delete</Button>
    </div>
  )
}
```

## Props

```txt
variant: default | primary | secondary | outline | ghost | danger
size: sm | md | lg | icon
disabled: boolean
loading: boolean
pressed: boolean
```

## Events

```txt
onPress
```

## Notes

The styled registry component targets the primitive internal button through `data-slot` selectors.
