import { render, screen } from '@testing-library/react'

import { reactShowcaseDemoNames } from '../demos'
import { reactVisualDemoNames, reactVisualDemoPages } from '../demos/visual'

const expectedVisualNames = [
  'alert',
  'avatar',
  'badge',
  'card',
  'progress',
  'separator',
  'skeleton',
]

describe('react visual showcase demos', () => {
  it('registers visual demo pages', () => {
    expect([...reactVisualDemoNames].sort()).toEqual(expectedVisualNames)
  })

  it('merges visual demos into the global showcase demo registry', () => {
    expect(reactShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedVisualNames),
    )
  })

  it.each(expectedVisualNames)('renders %s demo page', name => {
    const DemoPage = reactVisualDemoPages[name]

    expect(DemoPage).toBeTruthy()

    render(<DemoPage />)

    expect(
      screen.getByRole('heading', {
        name: new RegExp(`${name} capability page`, 'i'),
      }),
    ).toBeInTheDocument()
  })
})
