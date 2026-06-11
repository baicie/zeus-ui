import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PlaygroundPage } from '../routes/PlaygroundPage'

describe('react PlaygroundPage', () => {
  it('renders playground scenarios', () => {
    render(<PlaygroundPage />)

    expect(
      screen.getByRole('heading', {
        name: 'Production composition playground',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Admin dashboard/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Settings form/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Project creation/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('@zeus-web/alert')).toBeInTheDocument()
  })

  it('renders admin dashboard scenario with initial state', () => {
    render(<PlaygroundPage />)

    expect(screen.getAllByText('68%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('production rollout').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Promote').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Roll back').length).toBeGreaterThan(0)
    expect(
      screen.getByText(
        'No events yet. Interact with controls to record state changes.',
      ),
    ).toBeInTheDocument()
  })

  it('switches to settings form scenario', async () => {
    const user = userEvent.setup()

    render(<PlaygroundPage />)

    await user.click(screen.getByRole('button', { name: /Settings form/ }))

    expect(
      screen.getByRole('heading', { name: 'Workspace configuration' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Organization name').length).toBeGreaterThan(0)
    expect(screen.getByText('Feature flags')).toBeInTheDocument()
    expect(screen.getByText('Settings ready')).toBeInTheDocument()
  })

  it('switches to project creation scenario', async () => {
    const user = userEvent.setup()

    render(<PlaygroundPage />)

    await user.click(screen.getByRole('button', { name: /Project creation/ }))

    expect(
      screen.getByRole('heading', { name: 'Create and review projects' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Templates').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Created projects').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Component library').length).toBeGreaterThan(0)
  })
})
