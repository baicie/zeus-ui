import { mount } from '@vue/test-utils'

import { vueShowcaseDemoNames } from '../demos'
import {
  vueDisclosureDemoNames,
  vueDisclosureDemoPages,
} from '../demos/disclosure'

const expectedDisclosureNames = ['accordion', 'collapsible', 'tooltip']

describe('vue disclosure showcase demos', () => {
  it('registers disclosure demo pages', () => {
    expect([...vueDisclosureDemoNames].sort()).toEqual(expectedDisclosureNames)
  })

  it('merges disclosure demos into the global showcase demo registry', () => {
    expect(vueShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedDisclosureNames),
    )
  })

  it.each(expectedDisclosureNames)('renders %s demo page', name => {
    const DemoPage = vueDisclosureDemoPages[name]

    expect(DemoPage).toBeTruthy()

    const wrapper = mount(DemoPage as Parameters<typeof mount>[0])

    expect(wrapper.text()).toContain('capability page')
  })
})
