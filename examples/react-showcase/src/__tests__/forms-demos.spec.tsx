import { render, screen } from '@testing-library/react'

import { reactShowcaseDemoNames } from '../demos'
import { reactFormsDemoNames, reactFormsDemoPages } from '../demos/forms'

const expectedFormNames = ['label', 'radio-group', 'select', 'textarea']

describe('react forms showcase demos', () => {
  it('registers form demo pages', () => {
    expect([...reactFormsDemoNames].sort()).toEqual(expectedFormNames)
  })

  it('merges form demos into the global showcase demo registry', () => {
    expect(reactShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedFormNames),
    )
  })

  it.each(expectedFormNames)('renders %s demo page', name => {
    const DemoPage = reactFormsDemoPages[name]

    expect(DemoPage).toBeTruthy()

    render(<DemoPage />)

    expect(
      screen.getByRole('heading', {
        name: new RegExp(`${name.replace('-', ' ')} capability page`, 'i'),
      }),
    ).toBeInTheDocument()
  })
})
