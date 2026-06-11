/* eslint-disable no-restricted-globals */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { IconsPage } from '../routes/IconsPage'
import { mockClipboard } from '../test-utils/custom-events'

describe('react IconsPage', () => {
  it('renders recommended icons with real svg previews', () => {
    render(<IconsPage />)

    expect(screen.getByRole('heading', { name: 'Icons' })).toBeInTheDocument()
    expect(screen.getByText('Check')).toBeInTheDocument()
    expect(screen.getByText('Menu')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(
      document.querySelectorAll('.showcase-icon-preview svg').length,
    ).toBeGreaterThan(0)
  })

  it('filters icons by search query', async () => {
    const user = userEvent.setup()

    render(<IconsPage />)

    await user.type(screen.getByLabelText('Search icons'), 'settings')

    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.queryByText('Menu')).not.toBeInTheDocument()
    expect(screen.queryByText('Check')).not.toBeInTheDocument()
  })

  it('filters icons by category', async () => {
    const user = userEvent.setup()

    render(<IconsPage />)

    await user.click(screen.getByRole('button', { name: 'navigation' }))

    expect(screen.getByText('Menu')).toBeInTheDocument()
    expect(screen.getByText('Chevron down')).toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('copies React, Vue, Web Component and raw SVG snippets', async () => {
    const user = userEvent.setup()
    const writeText = mockClipboard()

    render(<IconsPage />)

    await user.click(
      screen.getByRole('button', {
        name: 'Copy REACT import for Check',
      }),
    )
    expect(writeText).toHaveBeenCalledWith(
      "import { CheckIcon } from '@zeus-web/icons/react'",
    )

    await user.click(
      screen.getByRole('button', { name: 'Copy VUE import for Check' }),
    )
    expect(writeText).toHaveBeenCalledWith(
      `<script setup lang="ts">
import { CheckIcon } from '@zeus-web/icons/vue'
<\/script>`,
    )
    expect(screen.getByText('Copied VUE')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Copy WC import for Check' }),
    )
    expect(writeText).toHaveBeenCalledWith(
      `import '@zeus-web/icons/wc'

<zw-icon-check></zw-icon-check>`,
    )

    await user.click(
      screen.getByRole('button', { name: 'Copy raw svg import for Check' }),
    )
    expect(writeText).toHaveBeenCalledWith(
      "import CheckIconSvg from '@zeus-web/icons/svg/check.svg?raw'",
    )
  })

  it('updates preview size and currentColor tone controls', async () => {
    const user = userEvent.setup()

    render(<IconsPage />)

    await user.selectOptions(screen.getByLabelText('Icon preview size'), '32')
    await user.selectOptions(
      screen.getByLabelText('Icon preview color'),
      'primary',
    )

    expect(screen.getByLabelText('Icon preview size')).toHaveValue('32')
    expect(screen.getByLabelText('Icon preview color')).toHaveValue('primary')
  })
})
