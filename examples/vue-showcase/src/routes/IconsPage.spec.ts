import { mount } from '@vue/test-utils'

import { findButtonByText, mockClipboard } from '../test-utils/custom-events'
import IconsPage from './IconsPage.vue'

describe('vue IconsPage', () => {
  it('renders recommended icons with real svg previews', () => {
    const wrapper = mount(IconsPage)

    expect(wrapper.text()).toContain('Icons')
    expect(wrapper.text()).toContain('Check')
    expect(wrapper.text()).toContain('Menu')
    expect(wrapper.text()).toContain('Settings')
    expect(
      wrapper.findAll('.showcase-icon-preview svg').length,
    ).toBeGreaterThan(0)
  })

  it('filters icons by search query', async () => {
    const wrapper = mount(IconsPage)

    await wrapper.get('[aria-label="Search icons"]').setValue('settings')

    expect(wrapper.text()).toContain('Settings')
    expect(wrapper.text()).not.toContain('Menu')
    expect(wrapper.text()).not.toContain('Check')
  })

  it('filters icons by category', async () => {
    const wrapper = mount(IconsPage)

    await findButtonByText(wrapper, 'navigation').trigger('click')

    expect(wrapper.text()).toContain('Menu')
    expect(wrapper.text()).toContain('Chevron down')
    expect(wrapper.text()).not.toContain('Settings')
  })

  it('copies React, Vue, Web Component and raw SVG snippets', async () => {
    const writeText = mockClipboard()
    const wrapper = mount(IconsPage)

    await wrapper
      .get('[aria-label="Copy REACT import for Check"]')
      .trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(
      "import { CheckIcon } from '@zeus-web/icons/react'",
    )

    await wrapper
      .get('[aria-label="Copy VUE import for Check"]')
      .trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(
      `<script setup lang="ts">
import { CheckIcon } from '@zeus-web/icons/vue'
<\/script>`,
    )
    expect(wrapper.text()).toContain('Copied VUE')

    await wrapper
      .get('[aria-label="Copy WC import for Check"]')
      .trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(
      `import '@zeus-web/icons/wc'

<zw-icon-check></zw-icon-check>`,
    )

    await wrapper
      .get('[aria-label="Copy raw svg import for Check"]')
      .trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(
      "import CheckIconSvg from '@zeus-web/icons/svg/check.svg?raw'",
    )
  })

  it('updates preview size and currentColor tone controls', async () => {
    const wrapper = mount(IconsPage)

    await wrapper.get('[aria-label="Icon preview size"]').setValue('32')
    await wrapper.get('[aria-label="Icon preview color"]').setValue('primary')

    expect(
      (
        wrapper.get('[aria-label="Icon preview size"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe('32')
    expect(
      (
        wrapper.get('[aria-label="Icon preview color"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe('primary')
  })
})
