# Tabs

Tabs are built on `@zeus-web/tabs`.

## Add

```bash
zweb add tabs
```

## Import

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
```

## Usage

```tsx
export function Example() {
  return (
    <Tabs defaultValue="account">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">Account panel</TabsContent>
      <TabsContent value="password">Password panel</TabsContent>
    </Tabs>
  )
}
```

## Props

```txt
value: string
defaultValue: string
orientation: horizontal | vertical
disabled: boolean
```

## Events

```txt
onValueChange
```
