import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VirtualListPage } from '../pages/VirtualListPage'

vi.mock('../components/DemoCard', () => ({
  DemoCard: ({
    title,
    description,
    children,
  }: {
    title: string
    description: string
    children: React.ReactNode
  }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </section>
  ),
}))

vi.mock('../components/StatusNote', () => ({
  StatusNote: ({ children }: { children: string }) => (
    <p role="status">{children}</p>
  ),
}))

describe('virtual list page', () => {
  afterEach(() => {
    cleanup()
  })

  it('does not crash when range-change detail is malformed', () => {
    const { container } = render(<VirtualListPage />)

    const virtual = container.querySelector('zw-virtual-list')

    expect(virtual).toBeTruthy()

    fireEvent(
      virtual as Element,
      new CustomEvent('range-change', {
        detail: {
          items: undefined,
        },
      }),
    )

    expect(screen.getByRole('status').textContent).toContain('DOM rows: 0')
  })

  it('renders only normalized virtual items', () => {
    const { container } = render(<VirtualListPage />)

    const virtual = container.querySelector('zw-virtual-list')

    fireEvent(
      virtual as Element,
      new CustomEvent('range-change', {
        detail: {
          items: [
            {
              index: 0,
              key: '0',
              start: 0,
              size: 52,
              end: 52,
            },
            {
              broken: true,
            },
          ],
        },
      }),
    )

    expect(container.querySelectorAll('.virtual-row')).toHaveLength(1)
    expect(screen.getByText('Activity 1')).toBeTruthy()
  })
})
