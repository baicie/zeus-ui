import { mount } from '@vue/test-utils'

import { vueShowcaseDemoNames } from '../demos'
import { vueVisualDemoNames, vueVisualDemoPages } from '../demos/visual'

const expectedVisualNames = [
  'alert',
  'avatar',
  'badge',
  'card',
  'progress',
  'separator',
  'skeleton',
]

describe('vue visual showcase demos', () => {
  it('registers visual demo pages', () => {
    expect([...vueVisualDemoNames].sort()).toEqual(expectedVisualNames)
  })

  it('merges visual demos into the global showcase demo registry', () => {
    expect(vueShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedVisualNames),
    )
  })

  it.each(expectedVisualNames)('renders %s demo page', name => {
    const DemoPage = vueVisualDemoPages[name]

    expect(DemoPage).toBeTruthy()

    const wrapper = mount(DemoPage)

    expect(wrapper.text()).toContain('capability page')
  })
})
