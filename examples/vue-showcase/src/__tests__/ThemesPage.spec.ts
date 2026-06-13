import { mount } from '@vue/test-utils'

import { semanticTokens } from '@zeus-web/example-showcase-shared'

import ThemesPage from '../routes/ThemesPage.vue'
import { findButtonByText, mockClipboard } from '../test-utils/custom-events'

describe('vue ThemesPage', () => {
  it('renders theme variants and token metadata', () => {
    const wrapper = mount(ThemesPage)

    expect(wrapper.text()).toContain('Themes')
    expect(wrapper.text()).toContain('Default')
    expect(wrapper.text()).toContain('Slate')
    expect(wrapper.text()).toContain(`${semanticTokens.length} semantic tokens`)
    expect(wrapper.text()).toContain('Component preview')
    expect(wrapper.text()).toContain('Semantic token palette')
    expect(wrapper.text()).toContain('hsl(var(--background))')
  })

  it('switches theme, mode, radius and motion controls', async () => {
    const wrapper = mount(ThemesPage)

    await findButtonByText(wrapper, 'Slate').trigger('click')
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
    expect(wrapper.text()).toContain("import '@zeus-web/themes/components.css'")
  })

  it('switches snippets and copies the selected snippet', async () => {
    const writeText = mockClipboard()
    const wrapper = mount(ThemesPage)

    await findButtonByText(wrapper, 'HTML usage').trigger('click')
    await findButtonByText(wrapper, 'Copy snippet').trigger('click')

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('data-theme="default"'),
    )
    expect(wrapper.text()).toContain('Copied')
  })
})
