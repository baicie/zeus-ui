import { render, screen } from '@testing-library/react'

import { p0ReactDemoNames, p0ReactDemoPages } from '../demos/p0'

const expectedP0Names = [
  'button',
  'checkbox',
  'dialog',
  'input',
  'switch',
  'tabs',
]

describe('react P0 showcase demos', () => {
  it('registers the six P0 demo pages', () => {
    expect([...p0ReactDemoNames].sort()).toEqual(expectedP0Names)
  })

  it.each(expectedP0Names)('renders %s demo page', name => {
    const DemoPage = p0ReactDemoPages[name]

    expect(DemoPage).toBeTruthy()

    render(<DemoPage />)

    expect(
      screen.getByRole('heading', {
        name: new RegExp(`${name} capability page`, 'i'),
      }),
    ).toBeInTheDocument()
  })
})
