import type { Context } from '@zeus-js/runtime-dom'
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { provideDOMContext, resolveDOMContext } from '@zeus-js/runtime-dom'
import {
  createContext,
  defineElement,
  event,
  Host,
  prop,
  Slot,
} from '@zeus-js/zeus'

export type AvatarSize = 'sm' | 'md' | 'lg'
export type AvatarShape = 'circle' | 'square'
export type AvatarImageStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface AvatarProps {
  size?: AvatarSize
  shape?: AvatarShape
  imageStatus?: AvatarImageStatus
}

export interface AvatarElement extends HTMLElement {
  imageStatus?: AvatarImageStatus
}

interface AvatarContextValue {
  getImageStatus: () => AvatarImageStatus
  setImageStatus: (status: AvatarImageStatus) => void
}

const AvatarContext =
  createContext<AvatarContextValue>() as Context<AvatarContextValue>

function resolveImageStatus(
  props: AvatarProps,
  host: AvatarElement,
): AvatarImageStatus {
  return host.imageStatus || props.imageStatus || 'idle'
}

function setupAvatar(
  props: AvatarProps,
  ctx: DefineElementContext<AvatarElement>,
) {
  const context: AvatarContextValue = {
    getImageStatus: () => resolveImageStatus(props, ctx.host),
    setImageStatus: status => {
      ctx.host.imageStatus = status
    },
  }

  provideDOMContext(ctx.host, AvatarContext, context)

  return (
    <Host
      part="root"
      data-slot="avatar-root"
      data-size={() => props.size}
      data-shape={() => props.shape}
      data-image-status={() => context.getImageStatus()}
    >
      <Slot />
    </Host>
  )
}

export const Avatar = defineElement<AvatarProps, AvatarElement>(
  'zw-avatar',
  {
    shadow: false,
    props: {
      size: prop(['sm', 'md', 'lg'], { default: 'md', reflect: true }),
      shape: prop(['circle', 'square'], { default: 'circle', reflect: true }),
      imageStatus: prop(['idle', 'loading', 'loaded', 'error'], {
        attr: 'image-status',
        default: 'idle',
        reflect: true,
      }),
    },
    meta: { description: 'Headless avatar root primitive.' },
  },
  setupAvatar,
)

export interface AvatarImageProps {
  src?: string
  alt?: string
  loading?: 'eager' | 'lazy'
  referrerPolicy?: string
}

export interface AvatarImageLoadDetail {
  nativeEvent: Event
}
export interface AvatarImageErrorDetail {
  nativeEvent: Event
}
export interface AvatarImageElement extends HTMLElement {}
interface AvatarImageEmits extends Record<string, EventDefinition<unknown>> {
  imageLoad: EventDefinition<AvatarImageLoadDetail>
  imageError: EventDefinition<AvatarImageErrorDetail>
}

function setupAvatarImage(
  props: AvatarImageProps,
  ctx: DefineElementContext<AvatarImageElement, AvatarImageEmits>,
) {
  const result = resolveDOMContext(ctx.host, AvatarContext)
  const avatar = result.found ? result.value : undefined

  return (
    <Host part="image" data-slot="avatar-image-root">
      <img
        part="image"
        data-slot="avatar-image"
        src={() => props.src}
        alt={() => props.alt || ''}
        loading={() => props.loading}
        referrerPolicy={() => props.referrerPolicy}
        onLoad={(nativeEvent: Event) => {
          avatar?.setImageStatus('loaded')
          ctx.emit.imageLoad({ nativeEvent })
        }}
        onError={(nativeEvent: Event) => {
          avatar?.setImageStatus('error')
          ctx.emit.imageError({ nativeEvent })
        }}
      />
    </Host>
  )
}

export const AvatarImage = defineElement<
  AvatarImageProps,
  AvatarImageElement,
  AvatarImageEmits
>(
  'zw-avatar-image',
  {
    shadow: false,
    props: {
      src: String,
      alt: String,
      loading: prop(['eager', 'lazy'], { default: 'lazy' }),
      referrerPolicy: prop(String, { attr: 'referrerpolicy' }),
    },
    emits: {
      imageLoad: event<{ nativeEvent: Event }>(),
      imageError: event<{ nativeEvent: Event }>(),
    },
    meta: { description: 'Headless avatar image primitive.' },
  },
  setupAvatarImage,
)

export interface AvatarFallbackProps {
  delayMs?: number
}
export interface AvatarFallbackElement extends HTMLElement {}

function setupAvatarFallback(
  props: AvatarFallbackProps,
  ctx: DefineElementContext<AvatarFallbackElement>,
) {
  const result = resolveDOMContext(ctx.host, AvatarContext)
  const avatar = result.found ? result.value : undefined

  const shouldShow = () => avatar?.getImageStatus() !== 'loaded'

  return (
    <Host
      part="fallback"
      data-slot="avatar-fallback"
      data-delay-ms={() => String(props.delayMs ?? 0)}
      hidden={() => !shouldShow()}
    >
      <Slot />
    </Host>
  )
}

export const AvatarFallback = defineElement<
  AvatarFallbackProps,
  AvatarFallbackElement
>(
  'zw-avatar-fallback',
  {
    shadow: false,
    props: { delayMs: prop(Number, { attr: 'delay-ms', default: 0 }) },
    meta: { description: 'Headless avatar fallback primitive.' },
  },
  setupAvatarFallback,
)
