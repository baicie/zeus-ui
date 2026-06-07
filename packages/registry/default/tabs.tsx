import {
  TabsContent as TabsContentPrimitive,
  TabsList as TabsListPrimitive,
  Tabs as TabsPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
} from '@zeus-web/tabs/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface TabsProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive
> {}

export const Tabs = React.forwardRef<HTMLElement, TabsProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsPrimitive
        ref={ref}
        data-slot="tabs"
        className={cn('flex flex-col gap-2', className)}
        {...props}
      />
    )
  },
)

Tabs.displayName = 'Tabs'

export interface TabsListProps extends React.ComponentPropsWithoutRef<
  typeof TabsListPrimitive
> {}

export const TabsList = React.forwardRef<HTMLElement, TabsListProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsListPrimitive
        ref={ref}
        data-slot="tabs-list"
        className={cn(
          'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
          className,
        )}
        {...props}
      />
    )
  },
)

TabsList.displayName = 'TabsList'

export interface TabsTriggerProps extends React.ComponentPropsWithoutRef<
  typeof TabsTriggerPrimitive
> {}

export const TabsTrigger = React.forwardRef<HTMLElement, TabsTriggerProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsTriggerPrimitive
        ref={ref}
        data-slot="tabs-trigger"
        className={cn(
          [
            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium',
            'ring-offset-background transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
          ].join(' '),
          className,
        )}
        {...props}
      />
    )
  },
)

TabsTrigger.displayName = 'TabsTrigger'

export interface TabsContentProps extends React.ComponentPropsWithoutRef<
  typeof TabsContentPrimitive
> {}

export const TabsContent = React.forwardRef<HTMLElement, TabsContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsContentPrimitive
        ref={ref}
        data-slot="tabs-content"
        className={cn(
          'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className,
        )}
        {...props}
      />
    )
  },
)

TabsContent.displayName = 'TabsContent'
