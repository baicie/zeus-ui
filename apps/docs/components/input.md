# Input

Input is built on `@zeus-web/input`.

## Add

```bash
zweb add input
```

## Import

```tsx
import { Input } from '@/components/ui/input'
```

## Usage

```tsx
export function Example() {
  return <Input placeholder="Email" type="email" />
}
```

## Props

```txt
value: string
defaultValue: string
type: text | email | password | search | tel | url | number
placeholder: string
disabled: boolean
readonly: boolean
required: boolean
name: string
```

## Events

```txt
onValueChange
```

## Notes

Do not assume the custom element host is the native input. The primitive exposes internal selectors such as `data-slot="input"` and `part="root"`.
