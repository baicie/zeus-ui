/**
 * Keyboard helpers shared by list-like primitives (WAI-ARIA APG listbox,
 * tablist, feed). Pure index math; adapters move DOM focus.
 */

import type { PartEvent } from './parts'

export interface NavigateOptions {
  orientation?: 'vertical' | 'horizontal'
  wrap?: boolean
}

/** Next index for a navigation key, or undefined when the key is not one. */
export function navigateIndex(
  key: string | undefined,
  index: number,
  count: number,
  options: NavigateOptions = {},
): number | undefined {
  if (count === 0) return undefined

  const vertical = (options.orientation ?? 'vertical') === 'vertical'
  const next = vertical ? 'ArrowDown' : 'ArrowRight'
  const previous = vertical ? 'ArrowUp' : 'ArrowLeft'
  const clamp = (value: number): number =>
    options.wrap
      ? ((value % count) + count) % count
      : Math.max(0, Math.min(count - 1, value))

  switch (key) {
    case next:
      return clamp(index < 0 ? 0 : index + 1)
    case previous:
      return clamp(index < 0 ? count - 1 : index - 1)
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return undefined
  }
}

/** Input methods report Enter while composing; never act on those. */
export function isComposingKey(event: PartEvent): boolean {
  return event.isComposing === true
}
