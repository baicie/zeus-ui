import { mount } from '@vue/test-utils'

import IconsPage from './IconsPage.vue'

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText,
    },
  })

  return writeText
}

describe('vue IconsPage', () => {
  it('renders recommended icons', () => {
    const wrapper = mount(IconsPage)

    expect(wrapper.text()).toContain('Icons')
    expect(wrapper.text()).toContain('Check')
    expect(wrapper.text()).toContain('Menu')
    expect(wrapper.text()).toContain('Settings')
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

    await wrapper
      .findAll('button')
      .find(button => button.text() === 'navigation')
      ?.trigger('click')

    expect(wrapper.text()).toContain('Menu')
    expect(wrapper.text()).toContain('Chevron down')
    expect(wrapper.text()).not.toContain('Settings')
  })

  it('copies Vue import snippet', async () => {
    const writeText = mockClipboard()
    const wrapper = mount(IconsPage)

    await wrapper
      .get('[aria-label="Copy VUE import for Check"]')
      .trigger('click')

    expect(writeText).toHaveBeenCalledWith(
      `<script setup lang="ts">
import { IconCheck } from '@zeus-web/icons/vue'
<\/script>`,
    )
    expect(wrapper.text()).toContain('Copied VUE')
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
