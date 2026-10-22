import { RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'

import { createShowcaseRouter } from '../router'

export async function renderReactShowcaseRoute(initialPath: string) {
  const router = createShowcaseRouter({
    initialPath,
  })

  const result = render(<RouterProvider router={router} />)

  await router.load()

  return {
    router,
    ...result,
  }
}
