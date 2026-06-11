import { render, screen } from '@testing-library/react'

import { reactShowcaseDemoNames } from '../demos'
import {
  reactDisclosureDemoNames,
  reactDisclosureDemoPages,
} from '../demos/disclosure'

const expectedDisclosureNames = ['accordion', 'collapsible', 'tooltip']

describe('react disclosure showcase demos', () => {
  it('registers disclosure demo pages', () => {
    expect([...reactDisclosureDemoNames].sort()).toEqual(
      expectedDisclosureNames,
    )
  })

  it('merges disclosure demos into the global showcase demo registry', () => {
    expect(reactShowcaseDemoNames).toEqual(
      expect.arrayContaining(expectedDisclosureNames),
    )
  })

  it.each(expectedDisclosureNames)('renders %s demo page', name => {
    const DemoPage = reactDisclosureDemoPages[name]

    expect(DemoPage).toBeTruthy()

    render(<DemoPage />)

    expect(
      screen.getByRole('heading', {
        name: new RegExp(`${name} capability page`, 'i'),
      }),
    ).toBeInTheDocument()
  })
})
