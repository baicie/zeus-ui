import type { ComponentType } from 'react'

import { AlertDemoPage } from './AlertDemoPage'
import { AvatarDemoPage } from './AvatarDemoPage'
import { BadgeDemoPage } from './BadgeDemoPage'
import { CardDemoPage } from './CardDemoPage'
import { ProgressDemoPage } from './ProgressDemoPage'
import { SeparatorDemoPage } from './SeparatorDemoPage'
import { SkeletonDemoPage } from './SkeletonDemoPage'

export const reactVisualDemoPages: Record<string, ComponentType> = {
  card: CardDemoPage,
  badge: BadgeDemoPage,
  separator: SeparatorDemoPage,
  skeleton: SkeletonDemoPage,
  alert: AlertDemoPage,
  progress: ProgressDemoPage,
  avatar: AvatarDemoPage,
}

export const reactVisualDemoNames = Object.keys(reactVisualDemoPages)
