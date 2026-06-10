import { RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createShowcaseRouter } from '../router'

function renderRoute(initialPath = '/') {
  const router = createShowcaseRouter({ initialPath })

  return render(<RouterProvider router={router} />)
}

describe('react showcase router', () => {
  it('renders the home page', async () => {
    renderRoute('/')

    expect(
      await screen.findByText('Zeus Web component laboratory'),
    ).toBeInTheDocument()
    expect(screen.getByText('React router showcase')).toBeInTheDocument()
  })

  it('renders the component index page', async () => {
    renderRoute('/components')

    expect(await screen.findByText('Component routes')).toBeInTheDocument()
    expect(screen.getAllByText('Button')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Input')[0]).toBeInTheDocument()
  })

  it('renders a component detail page from metadata', async () => {
    renderRoute('/components/button')

    expect(
      await screen.findByRole('heading', { name: /Button capability page/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('@zeus-web/button/react')).toBeInTheDocument()
  })

  it('renders icons and themes routes', async () => {
    renderRoute('/icons')
    expect(
      await screen.findByRole('heading', { name: 'Icons' }),
    ).toBeInTheDocument()

    renderRoute('/themes')
    expect(
      await screen.findByRole('heading', { name: 'Themes' }),
    ).toBeInTheDocument()
  })

  it('navigates from sidebar to a component page', async () => {
    const user = userEvent.setup()

    renderRoute('/')

    await user.click(await screen.findByRole('link', { name: /Button/i }))

    expect(
      await screen.findByRole('heading', { name: /Button capability page/i }),
    ).toBeInTheDocument()
  })

  it('searches component from topbar using enter', async () => {
    const user = userEvent.setup()

    renderRoute('/')

    const input = await screen.findByLabelText('Search components')

    await user.clear(input)
    await user.type(input, 'input{Enter}')

    expect(
      await screen.findByRole('heading', { name: /Input capability page/i }),
    ).toBeInTheDocument()
  })
})
