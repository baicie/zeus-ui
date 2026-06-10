import { mount } from '@vue/test-utils'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import ComponentPageScaffold from '../app/demo/ComponentPageScaffold.vue'
import EventLog from '../app/demo/EventLog.vue'
import PropTable from '../app/demo/PropTable.vue'
import StateMatrix from '../app/demo/StateMatrix.vue'
import ThemeTokenPreview from '../app/demo/ThemeTokenPreview.vue'

describe('vue showcase demo components', () => {
  it('renders component page scaffold from metadata', () => {
    const button = showcaseComponents.find(
      component => component.name === 'button',
    )

    expect(button).toBeTruthy()

    const wrapper = mount(ComponentPageScaffold, {
      props: {
        component: button!,
      },
    })

    expect(wrapper.text()).toContain('Button')
    expect(wrapper.text()).toContain('@zeus-web/button')
    expect(wrapper.text()).toContain('Install and imports')
    expect(wrapper.text()).toContain('Planned sections')
    expect(wrapper.text()).toContain('Production patterns')
  })

  it('renders event log empty state', () => {
    const wrapper = mount(EventLog, {
      props: {
        events: [],
      },
    })

    expect(wrapper.text()).toContain('No custom events planned.')
  })

  it('renders event log rows', () => {
    const wrapper = mount(EventLog, {
      props: {
        events: [
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Value changed.',
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('value-change')
    expect(wrapper.text()).toContain('Value changed.')
    expect(wrapper.text()).toContain('React: onValueChange')
  })

  it('renders prop table rows', () => {
    const wrapper = mount(PropTable, {
      props: {
        rows: [
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Disables interaction.',
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('disabled')
    expect(wrapper.text()).toContain('boolean')
    expect(wrapper.text()).toContain('Disables interaction.')
  })

  it('renders state matrix and theme token preview', () => {
    const stateMatrix = mount(StateMatrix, {
      props: {
        states: ['default', 'disabled'],
      },
    })

    const tokenPreview = mount(ThemeTokenPreview, {
      props: {
        tokens: ['primary', 'ring'],
      },
    })

    expect(stateMatrix.text()).toContain('default')
    expect(stateMatrix.text()).toContain('disabled')
    expect(tokenPreview.text()).toContain('primary')
    expect(tokenPreview.text()).toContain('ring')
  })
})
