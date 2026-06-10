import { RouterProvider } from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { implementedShowcaseComponentNames } from '@zeus-web/example-showcase-shared'

import { createShowcaseRouter } from '../router'

function renderRoute(initialPath: string) {
  const router = createShowcaseRouter({ initialPath })

  return render(<RouterProvider router={router} />)
}

describe('react showcase implemented route smoke', () => {
  afterEach(() => {
    cleanup()
  })

  it.each(implementedShowcaseComponentNames)(
    'renders implemented component route: %s',
    async componentName => {
      renderRoute(`/components/${componentName}`)

      expect(
        await screen.findByRole('heading', {
          name: /capability page/i,
        }),
      ).toBeInTheDocument()
    },
  )
})
