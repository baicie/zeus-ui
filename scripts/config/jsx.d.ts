// NOTE: JSX.Element and Host types are stubs since @zeus-js/runtime-dom
// is not installed in the zeus-ui workspace. Use `pnpm link:zeus-js` to
// develop against the real Zeus monorepo, or install @zeus-js/*@canary in CI.

declare global {
  namespace JSX {
    type Element = Record<string, unknown>

    interface ElementChildrenAttribute {
      children: object
    }

    interface IntrinsicElements {
      Host: Record<string, unknown>
      div: HTMLAttributes<HTMLDivElement>
      span: HTMLAttributes<HTMLSpanElement>
      p: HTMLAttributes<HTMLParagraphElement>
      a: HTMLAttributes<HTMLAnchorElement>
      button: HTMLAttributes<HTMLButtonElement>
      input: HTMLAttributes<HTMLInputElement>
      textarea: HTMLAttributes<HTMLTextAreaElement>
      select: HTMLAttributes<HTMLSelectElement>
      option: HTMLAttributes<HTMLOptionElement>
      form: HTMLAttributes<HTMLFormElement>
      label: HTMLAttributes<HTMLLabelElement>
      ul: HTMLAttributes<HTMLUListElement>
      ol: HTMLAttributes<HTMLOListElement>
      li: HTMLAttributes<HTMLLIElement>
      h1: HTMLAttributes<HTMLHeadingElement>
      h2: HTMLAttributes<HTMLHeadingElement>
      h3: HTMLAttributes<HTMLHeadingElement>
      h4: HTMLAttributes<HTMLHeadingElement>
      h5: HTMLAttributes<HTMLHeadingElement>
      h6: HTMLAttributes<HTMLHeadingElement>
      img: HTMLAttributes<HTMLImageElement>
      table: HTMLAttributes<HTMLTableElement>
      thead: HTMLAttributes<HTMLTableSectionElement>
      tbody: HTMLAttributes<HTMLTableSectionElement>
      tr: HTMLAttributes<HTMLTableRowElement>
      th: HTMLAttributes<HTMLTableCellElement>
      td: HTMLAttributes<HTMLTableCellElement>
      hr: HTMLAttributes<HTMLHRElement>
      br: HTMLAttributes<HTMLBRElement>
      pre: HTMLAttributes<HTMLPreElement>
      code: HTMLAttributes<HTMLElement>
      strong: HTMLAttributes<HTMLElement>
      em: HTMLAttributes<HTMLElement>
      i: HTMLAttributes<HTMLElement>
      b: HTMLAttributes<HTMLElement>
      u: HTMLAttributes<HTMLElement>
      s: HTMLAttributes<HTMLElement>
      del: HTMLAttributes<HTMLElement>
      ins: HTMLAttributes<HTMLElement>
      sub: HTMLAttributes<HTMLElement>
      sup: HTMLAttributes<HTMLElement>
      script: HTMLAttributes<HTMLScriptElement>
      style: HTMLAttributes<HTMLStyleElement>
      link: HTMLAttributes<HTMLLinkElement>
      meta: HTMLAttributes<HTMLMetaElement>
      title: HTMLAttributes<HTMLTitleElement>
      base: HTMLAttributes<HTMLBaseElement>
      slot: HTMLAttributes<HTMLSlotElement>
      template: HTMLAttributes<HTMLTemplateElement>
    }
  }
}

interface HTMLAttributes<T extends Element> {
  children?: unknown
  class?: string
  className?: string
  style?: string | Record<string, string | number>
  id?: string
  key?: string
  ref?: unknown
  slot?: string
  part?: string
  name?: string

  // ARIA
  role?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-hidden'?: string
  'aria-disabled'?: string
  'aria-expanded'?: string
  'aria-selected'?: string
  'aria-checked'?: string
  'aria-pressed'?: string
  'aria-current'?: string
  'aria-details'?: string
  'aria-invalid'?: string

  // Events
  onAbort?: (event: Event) => void
  onBlur?: (event: FocusEvent) => void
  onCanPlay?: (event: Event) => void
  onCanPlayThrough?: (event: Event) => void
  onChange?: (event: Event) => void
  onClick?: (event: MouseEvent) => void
  onContextMenu?: (event: MouseEvent) => void
  onCopy?: (event: ClipboardEvent) => void
  onCut?: (event: ClipboardEvent) => void
  onDoubleClick?: (event: MouseEvent) => void
  onDrag?: (event: DragEvent) => void
  onDragEnd?: (event: DragEvent) => void
  onDragEnter?: (event: DragEvent) => void
  onDragLeave?: (event: DragEvent) => void
  onDragOver?: (event: DragEvent) => void
  onDragStart?: (event: DragEvent) => void
  onDrop?: (event: DragEvent) => void
  onDurationChange?: (event: Event) => void
  onEmptied?: (event: Event) => void
  onEnded?: (event: Event) => void
  onError?: (event: ErrorEvent) => void
  onFocus?: (event: FocusEvent) => void
  onInput?: (event: Event) => void
  onInvalid?: (event: Event) => void
  onKeyDown?: (event: KeyboardEvent) => void
  onKeyPress?: (event: KeyboardEvent) => void
  onKeyUp?: (event: KeyboardEvent) => void
  onLoad?: (event: Event) => void
  onLoadedData?: (event: Event) => void
  onLoadedMetadata?: (event: Event) => void
  onLoadStart?: (event: Event) => void
  onMouseDown?: (event: MouseEvent) => void
  onMouseEnter?: (event: MouseEvent) => void
  onMouseLeave?: (event: MouseEvent) => void
  onMouseMove?: (event: MouseEvent) => void
  onMouseOut?: (event: MouseEvent) => void
  onMouseOver?: (event: MouseEvent) => void
  onMouseUp?: (event: MouseEvent) => void
  onPaste?: (event: ClipboardEvent) => void
  onPause?: (event: Event) => void
  onPlay?: (event: Event) => void
  onPlaying?: (event: Event) => void
  onProgress?: (event: Event) => void
  onRateChange?: (event: Event) => void
  onReset?: (event: Event) => void
  onResize?: (event: Event) => void
  onScroll?: (event: Event) => void
  onSearch?: (event: Event) => void
  onSeeked?: (event: Event) => void
  onSeeking?: (event: Event) => void
  onSelect?: (event: Event) => void
  onStalled?: (event: Event) => void
  onSubmit?: (event: Event) => void
  onSuspend?: (event: Event) => void
  onTimeUpdate?: (event: Event) => void
  onTouchCancel?: (event: TouchEvent) => void
  onTouchEnd?: (event: TouchEvent) => void
  onTouchMove?: (event: TouchEvent) => void
  onTouchStart?: (event: TouchEvent) => void
  onVolumeChange?: (event: Event) => void
  onWaiting?: (event: Event) => void
  onWheel?: (event: WheelEvent) => void

  // HTML attributes
  accept?: string
  acceptCharset?: string
  action?: string
  allowFullScreen?: boolean
  alt?: string
  as?: string
  async?: boolean
  autoComplete?: string
  autoFocus?: boolean
  autoPlay?: boolean
  capture?: boolean | string
  cellPadding?: number | string
  cellSpacing?: number | string
  charSet?: string
  checked?: boolean
  cite?: string
  cols?: number
  colSpan?: number
  content?: string
  controls?: boolean
  coords?: string
  crossOrigin?: string
  dateTime?: string
  default?: boolean
  defer?: boolean
  disabled?: boolean
  download?: string
  encType?: string
  form?: string
  formAction?: string
  formEncType?: string
  formMethod?: string
  formNoValidate?: boolean
  formTarget?: string
  headers?: string
  height?: number | string
  high?: number
  href?: string
  hrefLang?: string
  htmlFor?: string
  httpEquiv?: string
  isMap?: boolean
  itemProp?: string
  itemScope?: boolean
  itemType?: string
  kind?: string
  label?: string
  lang?: string
  list?: string
  loop?: boolean
  low?: number
  max?: number | string
  maxLength?: number
  media?: string
  method?: string
  min?: number | string
  minLength?: number
  multiple?: boolean
  muted?: boolean
  noValidate?: boolean
  open?: boolean
  optimum?: number
  pattern?: string
  placeholder?: string
  playsInline?: boolean
  poster?: string
  preload?: string
  readOnly?: boolean
  rel?: string
  required?: boolean
  reversed?: boolean
  rows?: number
  rowSpan?: number
  sandbox?: string
  scope?: string
  seamless?: boolean
  selected?: boolean
  shape?: string
  size?: number
  sizes?: string
  span?: number
  src?: string
  srcDoc?: string
  srcSet?: string
  start?: number
  step?: number | string
  target?: string
  type?: string
  useMap?: string
  value?: string | number | boolean
  width?: number | string
  wmode?: string
  wrap?: string

  // data attributes
  'data-slot'?: string
  'data-variant'?: string
  'data-size'?: string
  'data-disabled'?: string
  'data-value'?: string
  'data-default-value'?: string
  'data-type'?: string
  'data-checked'?: string
  'data-open'?: string

  // aria attributes
  'aria-controls'?: string
  'aria-orientation'?: string
  'aria-owns'?: string
  'aria-activedescendant'?: string
  'aria-autocomplete'?: string
  'aria-busy'?: string
  'aria-colcount'?: string
  'aria-colindex'?: string
  'aria-colspan'?: string
  'aria-live'?: string
  'aria-multiline'?: string
  'aria-multiselectable'?: string
  'aria-placeholder'?: string
  'aria-posinset'?: string
  'aria-readonly'?: string
  'aria-relevant'?: string
  'aria-required'?: string
  'aria-roledescription'?: string
  'aria-rowcount'?: string
  'aria-rowindex'?: string
  'aria-rowspan'?: string
  'aria-setsize'?: string
  'aria-sort'?: string
  'aria-valuemax'?: string
  'aria-valuemin'?: string
  'aria-valuenow'?: string
  'aria-valuetext'?: string
  'aria-haspopup'?: string

  // CSS custom properties
  [key: `data-${string}`]: unknown
  [key: `--${string}`]: string | number | undefined
}
