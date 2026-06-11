import { mount } from '@vue/test-utils'

import { p0VueDemoNames, p0VueDemoPages } from '../demos/p0'

const expectedP0Names = [
  'button',
  'checkbox',
  'dialog',
  'input',
  'switch',
  'tabs',
]

describe('vue P0 showcase demos', () => {
  it('registers the six P0 demo pages', () => {
    expect([...p0VueDemoNames].sort()).toEqual(expectedP0Names)
  })

  it.each(expectedP0Names)('renders %s demo page', name => {
    const DemoPage = p0VueDemoPages[name]

    expect(DemoPage).toBeTruthy()

    const wrapper = mount(DemoPage)

    expect(wrapper.text()).toContain('capability page')
  })
})
