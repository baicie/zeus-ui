import { mount } from '@vue/test-utils'

import { p0VueDemoNames, p0VueDemoPages } from '../demos/p0'

describe('vue P0 showcase demos', () => {
  it('registers the six P0 demo pages', () => {
    expect(p0VueDemoNames.sort()).toEqual([
      'button',
      'checkbox',
      'dialog',
      'input',
      'switch',
      'tabs',
    ])
  })

  it.each(p0VueDemoNames)('renders %s demo page', name => {
    const DemoPage = p0VueDemoPages[name]

    const wrapper = mount(DemoPage)

    expect(wrapper.text()).toContain('capability page')
  })
})
