import { inputTagName } from './index'

export class ZeusInputElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return [
      'value',
      'type',
      'placeholder',
      'disabled',
      'readonly',
      'required',
      'name',
    ]
  }

  private input?: HTMLInputElement

  connectedCallback() {
    if (this.input) return

    const input = document.createElement('input')
    input.part.add('input')
    input.setAttribute('data-slot', 'input')

    this.input = input
    this.syncAttributes()

    input.addEventListener('input', event => {
      const value = input.value
      this.dispatchEvent(
        new CustomEvent('value-change', {
          detail: {
            value,
            nativeEvent: event,
          },
          bubbles: true,
          composed: true,
        }),
      )
    })

    this.append(input)
  }

  attributeChangedCallback() {
    this.syncAttributes()
  }

  private syncAttributes(): void {
    if (!this.input) return

    for (const name of ZeusInputElement.observedAttributes) {
      if (this.hasAttribute(name)) {
        const value = this.getAttribute(name)

        if (name === 'disabled' || name === 'readonly' || name === 'required') {
          this.input.toggleAttribute(name, true)
        } else if (value != null) {
          this.input.setAttribute(name, value)
        }
      } else {
        this.input.removeAttribute(name)
      }
    }
  }
}

export function defineInputElement(): void {
  if (!customElements.get(inputTagName)) {
    customElements.define(inputTagName, ZeusInputElement)
  }
}

defineInputElement()
