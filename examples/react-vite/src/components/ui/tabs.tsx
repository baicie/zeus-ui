import type {
  TabsContentElement,
  TabsElement,
  TabsListElement,
  TabsTriggerElement,
} from '@zeus-web/tabs/react'
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

export const Tabs = React.forwardRef<TabsElement, TabsProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsPrimitive
        ref={ref}
        className={cn('zw-tabs', className)}
        {...props}
      />
    )
  },
)

Tabs.displayName = 'Tabs'

export interface TabsListProps extends React.ComponentPropsWithoutRef<
  typeof TabsListPrimitive
> {}

export const TabsList = React.forwardRef<TabsListElement, TabsListProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsListPrimitive
        ref={ref}
        className={cn('zw-tabs-list', className)}
        {...props}
      />
    )
  },
)

TabsList.displayName = 'TabsList'

export interface TabsTriggerProps extends React.ComponentPropsWithoutRef<
  typeof TabsTriggerPrimitive
> {}

export const TabsTrigger = React.forwardRef<
  TabsTriggerElement,
  TabsTriggerProps
>(({ className, ...props }, ref) => {
  return (
    <TabsTriggerPrimitive
      ref={ref}
      className={cn('zw-tabs-trigger', className)}
      {...props}
    />
  )
})

TabsTrigger.displayName = 'TabsTrigger'

export interface TabsContentProps extends React.ComponentPropsWithoutRef<
  typeof TabsContentPrimitive
> {}

export const TabsContent = React.forwardRef<
  TabsContentElement,
  TabsContentProps
>(({ className, ...props }, ref) => {
  return (
    <TabsContentPrimitive
      ref={ref}
      className={cn('zw-tabs-content', className)}
      {...props}
    />
  )
})

TabsContent.displayName = 'TabsContent'
