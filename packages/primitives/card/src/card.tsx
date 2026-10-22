import { defineElement, Host, Slot } from '@zeus-js/zeus'

export interface CardElement extends HTMLElement {}

export const Card = defineElement<object, CardElement>(
  'zw-card',
  {
    shadow: false,
    meta: {
      description: 'Headless card root primitive.',
    },
  },
  () => (
    <Host part="root" data-slot="card-root">
      <Slot />
    </Host>
  ),
)

export interface CardHeaderElement extends HTMLElement {}

export const CardHeader = defineElement<object, CardHeaderElement>(
  'zw-card-header',
  {
    shadow: false,
    meta: {
      description: 'Headless card header primitive.',
    },
  },
  () => (
    <Host part="header" data-slot="card-header">
      <Slot />
    </Host>
  ),
)

export interface CardTitleElement extends HTMLElement {}

export const CardTitle = defineElement<object, CardTitleElement>(
  'zw-card-title',
  {
    shadow: false,
    meta: {
      description: 'Headless card title primitive.',
    },
  },
  () => (
    <Host part="title" data-slot="card-title">
      <Slot />
    </Host>
  ),
)

export interface CardDescriptionElement extends HTMLElement {}

export const CardDescription = defineElement<object, CardDescriptionElement>(
  'zw-card-description',
  {
    shadow: false,
    meta: {
      description: 'Headless card description primitive.',
    },
  },
  () => (
    <Host part="description" data-slot="card-description">
      <Slot />
    </Host>
  ),
)

export interface CardContentElement extends HTMLElement {}

export const CardContent = defineElement<object, CardContentElement>(
  'zw-card-content',
  {
    shadow: false,
    meta: {
      description: 'Headless card content primitive.',
    },
  },
  () => (
    <Host part="content" data-slot="card-content">
      <Slot />
    </Host>
  ),
)

export interface CardFooterElement extends HTMLElement {}

export const CardFooter = defineElement<object, CardFooterElement>(
  'zw-card-footer',
  {
    shadow: false,
    meta: {
      description: 'Headless card footer primitive.',
    },
  },
  () => (
    <Host part="footer" data-slot="card-footer">
      <Slot />
    </Host>
  ),
)
