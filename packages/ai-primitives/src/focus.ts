/**
 * Focus helpers for adapters that own real elements (dialogs, feeds). They
 * take the container as an argument and never read globals at import time,
 * so the package stays SSR-safe.
 */

interface FocusableContainer {
  querySelectorAll: (selector: string) => ArrayLike<unknown>
}

interface FocusableElement {
  focus: () => void
  hasAttribute: (name: string) => boolean
}

const FOCUSABLE =
  'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'

export function focusableElements(
  container: FocusableContainer,
): FocusableElement[] {
  return Array.from(
    container.querySelectorAll(FOCUSABLE) as ArrayLike<FocusableElement>,
  ).filter(
    element =>
      !element.hasAttribute('disabled') && !element.hasAttribute('hidden'),
  )
}

/**
 * Keep Tab inside a modal container (APG dialog). Returns true when the key
 * was handled.
 */
export function trapFocus(
  container: FocusableContainer,
  event: { key?: string; shiftKey?: boolean; preventDefault: () => void },
  active: unknown,
): boolean {
  if (event.key !== 'Tab') return false
  const elements = focusableElements(container)
  if (elements.length === 0) return false

  const first = elements[0]
  const last = elements[elements.length - 1]

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
    return true
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
    return true
  }
  return false
}
