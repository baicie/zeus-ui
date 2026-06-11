import { flushPromises, mount } from '@vue/test-utils'

import App from '../App.vue'
import { createShowcaseRouter } from '../router'

export async function mountVueShowcaseRoute(initialPath: string) {
  const router = createShowcaseRouter({
    initialPath,
  })

  const wrapper = mount(App, {
    global: {
      plugins: [router],
    },
  })

  await router.isReady()
  await router.push(initialPath)
  await flushPromises()

  return {
    router,
    wrapper,
  }
}
