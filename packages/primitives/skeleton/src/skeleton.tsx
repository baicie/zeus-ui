import { defineElement, Host, prop } from '@zeus-js/zeus'

export type SkeletonVariant = 'text' | 'rect' | 'circle'

export interface SkeletonProps {
  variant?: SkeletonVariant
  animated?: boolean
}

export interface SkeletonElement extends HTMLElement {}

export const Skeleton = defineElement<SkeletonProps, SkeletonElement>(
  'zw-skeleton',
  {
    shadow: false,
    props: {
      variant: prop(['text', 'rect', 'circle'], {
        default: 'rect',
        reflect: true,
      }),
      animated: prop(Boolean, {
        default: true,
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless skeleton primitive.',
    },
  },
  props => (
    <Host
      part="root"
      data-slot="skeleton-root"
      data-variant={() => props.variant}
      data-animated={() => (props.animated ? '' : null)}
      aria-hidden={() => 'true'}
    />
  ),
)
