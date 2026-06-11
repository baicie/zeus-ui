import { mount } from '@vue/test-utils'

import PlaygroundPage from '../routes/PlaygroundPage.vue'

describe('vue PlaygroundPage', () => {
  it('renders playground scenarios', () => {
    const wrapper = mount(PlaygroundPage)

    expect(wrapper.text()).toContain('Production composition playground')
    expect(wrapper.text()).toContain('Admin dashboard')
    expect(wrapper.text()).toContain('Settings form')
    expect(wrapper.text()).toContain('Project creation')
    expect(wrapper.text()).toContain('@zeus-web/alert')
  })

  it('switches to settings form scenario', async () => {
    const wrapper = mount(PlaygroundPage)

    const button = wrapper
      .findAll('button')
      .find(item => item.text().includes('Settings form'))

    expect(button).toBeDefined()

    await button?.trigger('click')

    expect(wrapper.text()).toContain('Workspace configuration')
    expect(wrapper.text()).toContain('Organization name')
    expect(wrapper.text()).toContain('Feature flags')
  })

  it('switches to project creation scenario', async () => {
    const wrapper = mount(PlaygroundPage)

    const button = wrapper
      .findAll('button')
      .find(item => item.text().includes('Project creation'))

    expect(button).toBeDefined()

    await button?.trigger('click')

    expect(wrapper.text()).toContain('Create and review projects')
    expect(wrapper.text()).toContain('Templates')
    expect(wrapper.text()).toContain('Created projects')
    expect(wrapper.text()).toContain(
      'Internal admin dashboard with forms, tables and alerts.',
    )
  })
})
