import { flushPromises, mount } from '@vue/test-utils'
import { implementedShowcaseComponentNames } from '@zeus-web/example-showcase-shared'

import App from '../App.vue'
import { createShowcaseRouter } from '../router'

async function renderRoute(initialPath: string) {
  const router = createShowcaseRouter({ initialPath })

  await router.isReady()

  const wrapper = mount(App, {
    global: {
      plugins: [router],
    },
  })

  await flushPromises()

  return wrapper
}

describe('vue showcase implemented route smoke', () => {
  it.each(implementedShowcaseComponentNames)(
    'renders implemented component route: %s',
    async componentName => {
      const wrapper = await renderRoute(`/components/${componentName}`)

      expect(wrapper.text()).toContain('capability page')
    },
  )
})
