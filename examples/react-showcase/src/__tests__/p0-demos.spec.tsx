import { render, screen } from '@testing-library/react'

import { p0ReactDemoNames, p0ReactDemoPages } from '../demos/p0'

describe('react P0 showcase demos', () => {
  it('registers the six P0 demo pages', () => {
    expect(p0ReactDemoNames.sort()).toEqual([
      'button',
      'checkbox',
      'dialog',
      'input',
      'switch',
      'tabs',
    ])
  })

  it.each(p0ReactDemoNames)('renders %s demo page', name => {
    const DemoPage = p0ReactDemoPages[name]

    render(<DemoPage />)

    expect(
      screen.getByRole('heading', {
        name: new RegExp(`${name} capability page`, 'i'),
      }),
    ).toBeInTheDocument()
  })
})
