import { mount } from '@vue/test-utils'

import { findButtonByText } from '../test-utils/custom-events'
import PlaygroundPage from './PlaygroundPage.vue'

describe('vue PlaygroundPage', () => {
  it('renders playground scenarios', () => {
    const wrapper = mount(PlaygroundPage)

    expect(wrapper.text()).toContain('Production composition playground')
    expect(wrapper.text()).toContain('Admin dashboard')
    expect(wrapper.text()).toContain('Settings form')
    expect(wrapper.text()).toContain('Project creation')
    expect(wrapper.text()).toContain('@zeus-web/alert')
  })

  it('renders admin dashboard scenario with initial state', () => {
    const wrapper = mount(PlaygroundPage)

    expect(wrapper.text()).toContain('68%')
    expect(wrapper.text()).toContain('production rollout')
    expect(wrapper.text()).toContain('Promote')
    expect(wrapper.text()).toContain('Roll back')
    expect(wrapper.text()).toContain(
      'No events yet. Interact with controls to record state changes.',
    )
  })

  it('switches to settings form scenario', async () => {
    const wrapper = mount(PlaygroundPage)

    await findButtonByText(wrapper, 'Settings form').trigger('click')

    expect(wrapper.text()).toContain('Workspace configuration')
    expect(wrapper.text()).toContain('Organization name')
    expect(wrapper.text()).toContain('Feature flags')
    expect(wrapper.text()).toContain('Settings ready')
  })

  it('switches to project creation scenario', async () => {
    const wrapper = mount(PlaygroundPage)

    await findButtonByText(wrapper, 'Project creation').trigger('click')

    expect(wrapper.text()).toContain('Create and review projects')
    expect(wrapper.text()).toContain('Templates')
    expect(wrapper.text()).toContain('Created projects')
    expect(wrapper.text()).toContain('Component library')
  })
})
