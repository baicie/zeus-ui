import { render, screen } from '@testing-library/react'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import { ComponentPageScaffold } from '../app/demo/ComponentPageScaffold'
import { EventLog } from '../app/demo/EventLog'
import { PropTable } from '../app/demo/PropTable'
import { StateMatrix } from '../app/demo/StateMatrix'
import { ThemeTokenPreview } from '../app/demo/ThemeTokenPreview'

describe('react showcase demo components', () => {
  it('renders component page scaffold from metadata', () => {
    const button = showcaseComponents.find(
      component => component.name === 'button',
    )

    expect(button).toBeTruthy()

    render(<ComponentPageScaffold component={button!} />)

    expect(screen.getByText('Button')).toBeInTheDocument()
    expect(screen.getAllByText('@zeus-web/button')).toHaveLength(2)
    expect(screen.getByText('Install and imports')).toBeInTheDocument()
    expect(screen.getByText('Planned sections')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Production patterns', level: 2 }),
    ).toBeInTheDocument()
  })

  it('renders event log empty state', () => {
    render(<EventLog events={[]} />)

    expect(screen.getByText('No custom events planned.')).toBeInTheDocument()
  })

  it('renders event log rows', () => {
    render(
      <EventLog
        events={[
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Value changed.',
          },
        ]}
      />,
    )

    expect(screen.getByText('value-change')).toBeInTheDocument()
    expect(screen.getByText('Value changed.')).toBeInTheDocument()
    expect(screen.getByText(/React: onValueChange/)).toBeInTheDocument()
  })

  it('renders prop table rows', () => {
    render(
      <PropTable
        rows={[
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Disables interaction.',
          },
        ]}
      />,
    )

    expect(screen.getByText('disabled')).toBeInTheDocument()
    expect(screen.getByText('boolean')).toBeInTheDocument()
    expect(screen.getByText('Disables interaction.')).toBeInTheDocument()
  })

  it('renders state matrix and theme token preview', () => {
    render(
      <>
        <StateMatrix states={['default', 'disabled']} />
        <ThemeTokenPreview tokens={['primary', 'ring']} />
      </>,
    )

    expect(screen.getAllByText('default')).toHaveLength(2)
    expect(screen.getAllByText('disabled')).toHaveLength(2)
    expect(screen.getAllByText('primary')).toHaveLength(1)
    expect(screen.getAllByText('ring')).toHaveLength(1)
  })
})
