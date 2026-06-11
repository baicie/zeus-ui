import { mount } from '@vue/test-utils'

import ThemesPage from '../routes/ThemesPage.vue'

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

describe('vue ThemesPage', () => {
  it('renders theme variants and token metadata', () => {
    const wrapper = mount(ThemesPage)

    expect(wrapper.text()).toContain('Themes')
    expect(wrapper.text()).toContain('Default')
    expect(wrapper.text()).toContain('Slate')
    expect(wrapper.text()).toContain('19 semantic tokens')
    expect(wrapper.text()).toContain('Component preview')
    expect(wrapper.text()).toContain('Semantic token palette')
  })

  it('switches theme, mode, radius and motion controls', async () => {
    const wrapper = mount(ThemesPage)

    const slateButton = wrapper
      .findAll('button')
      .find(button => button.text().includes('Slate'))

    expect(slateButton).toBeDefined()

    await slateButton?.trigger('click')
    await wrapper.get('[aria-label="Theme mode"]').setValue('dark')
    await wrapper.get('[aria-label="Radius preset"]').setValue('xl')
    await wrapper.get('[aria-label="Motion preset"]').setValue('expressive')

    expect(
      (wrapper.get('[aria-label="Theme mode"]').element as HTMLSelectElement)
        .value,
    ).toBe('dark')
    expect(
      (wrapper.get('[aria-label="Radius preset"]').element as HTMLSelectElement)
        .value,
    ).toBe('xl')
    expect(
      (wrapper.get('[aria-label="Motion preset"]').element as HTMLSelectElement)
        .value,
    ).toBe('expressive')
    expect(wrapper.text()).toContain("import '@zeus-web/themes/slate.css'")
  })

  it('switches snippets and copies the selected snippet', async () => {
    const writeText = mockClipboard()
    const wrapper = mount(ThemesPage)

    const htmlButton = wrapper
      .findAll('button')
      .find(button => button.text() === 'HTML usage')

    expect(htmlButton).toBeDefined()

    await htmlButton?.trigger('click')
    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Copy snippet')
      ?.trigger('click')

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('data-theme="default"'),
    )
    expect(wrapper.text()).toContain('Copied')
  })
})
