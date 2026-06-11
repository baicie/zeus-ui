import { RouterProvider } from '@tanstack/react-router'
import { act, render } from '@testing-library/react'

import { createShowcaseRouter } from '../router'

export async function renderReactShowcaseRoute(initialPath: string) {
  const router = createShowcaseRouter({
    initialPath,
  })

  const result = render(<RouterProvider router={router} />)

  await act(async () => {
    await router.load()
  })

  return {
    router,
    ...result,
  }
}
