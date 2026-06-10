import type { Component } from 'vue'

import AlertDemoPage from './AlertDemoPage.vue'
import AvatarDemoPage from './AvatarDemoPage.vue'
import BadgeDemoPage from './BadgeDemoPage.vue'
import CardDemoPage from './CardDemoPage.vue'
import ProgressDemoPage from './ProgressDemoPage.vue'
import SeparatorDemoPage from './SeparatorDemoPage.vue'
import SkeletonDemoPage from './SkeletonDemoPage.vue'

export const vueVisualDemoPages: Record<string, Component> = {
  card: CardDemoPage,
  badge: BadgeDemoPage,
  separator: SeparatorDemoPage,
  skeleton: SkeletonDemoPage,
  alert: AlertDemoPage,
  progress: ProgressDemoPage,
  avatar: AvatarDemoPage,
}

export const vueVisualDemoNames = Object.keys(vueVisualDemoPages)
