import { mount } from '@vue/test-utils'

import { vueShowcaseDemoNames } from '../demos'
import { vueFormsDemoNames, vueFormsDemoPages } from '../demos/forms'

const expectedFormNames = ['label', 'radio-group', 'select', 'textarea']

describe('vue forms showcase demos', () => {
  it('registers form demo pages', () => {
    expect([...vueFormsDemoNames].sort()).toEqual(expectedFormNames)
  })

  it('merges form demos into the global showcase demo registry', () => {
    expect(vueShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedFormNames),
    )
  })

  it.each(expectedFormNames)('renders %s demo page', name => {
    const DemoPage = vueFormsDemoPages[name]

    expect(DemoPage).toBeTruthy()

    const wrapper = mount(DemoPage)

    expect(wrapper.text()).toContain('capability page')
  })
})
