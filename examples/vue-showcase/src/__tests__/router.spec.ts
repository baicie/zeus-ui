import { flushPromises, mount } from '@vue/test-utils'

import App from '../App.vue'
import { createShowcaseRouter } from '../router'

async function renderRoute(initialPath = '/') {
  const router = createShowcaseRouter({ initialPath })

  await router.isReady()

  return mount(App, {
    global: {
      plugins: [router],
    },
  })
}

describe('vue showcase router', () => {
  it('renders the home page', async () => {
    const wrapper = await renderRoute('/')

    expect(wrapper.text()).toContain('Zeus Web component laboratory')
    expect(wrapper.text()).toContain('Vue router showcase')
  })

  it('renders the component index page', async () => {
    const wrapper = await renderRoute('/components')

    expect(wrapper.text()).toContain('Component routes')
    expect(wrapper.text()).toContain('Button')
    expect(wrapper.text()).toContain('Input')
  })

  it('renders a component detail page from metadata', async () => {
    const wrapper = await renderRoute('/components/button')

    expect(wrapper.text()).toContain('Button')
    expect(wrapper.text()).toContain('@/components/ui/button')
    expect(wrapper.text()).toContain('@/components/ui/button.vue')
  })

  it('renders icons and themes routes', async () => {
    const icons = await renderRoute('/icons')
    expect(icons.text()).toContain('Icons')

    const themes = await renderRoute('/themes')
    expect(themes.text()).toContain('Themes')
  })

  it('navigates from sidebar to a component page', async () => {
    const wrapper = await renderRoute('/')

    const links = wrapper.findAll('a')
    const buttonLink = links.find(link => link.text().includes('Button'))

    expect(buttonLink).toBeTruthy()

    await buttonLink!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('@/components/ui/button')
  })

  it('searches component from topbar using enter', async () => {
    const wrapper = await renderRoute('/')

    const input = wrapper.get('input[aria-label="Search components"]')

    await input.setValue('input')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain('@/components/ui/input')
  })
})
