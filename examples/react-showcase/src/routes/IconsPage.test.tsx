import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { IconsPage } from './IconsPage'

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText,
    },
  })

  return writeText
}

describe('react IconsPage', () => {
  it('renders recommended icons with real svg previews', () => {
    const { container } = render(<IconsPage />)

    expect(screen.getByRole('heading', { name: 'Icons' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Check' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Menu' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(
      container.querySelectorAll('.showcase-icon-preview svg').length,
    ).toBeGreaterThan(0)
  })

  it('filters icons by search query', async () => {
    const user = userEvent.setup()

    render(<IconsPage />)

    await user.type(screen.getByLabelText('Search icons'), 'settings')

    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Menu' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Check' }),
    ).not.toBeInTheDocument()
  })

  it('filters icons by category', async () => {
    const user = userEvent.setup()

    render(<IconsPage />)

    await user.click(screen.getByRole('button', { name: 'navigation' }))

    expect(screen.getByRole('heading', { name: 'Menu' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Chevron down' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Settings' }),
    ).not.toBeInTheDocument()
  })

  it('copies React, Vue, Web Component and raw SVG snippets', async () => {
    const user = userEvent.setup()
    const writeText = mockClipboard()

    render(<IconsPage />)

    await user.click(screen.getByLabelText('Copy REACT import for Check'))
    expect(writeText).toHaveBeenLastCalledWith(
      "import { CheckIcon } from '@zeus-web/icons/react'",
    )
    expect(screen.getByText('Copied REACT')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Copy VUE import for Check'))
    expect(writeText).toHaveBeenLastCalledWith(
      `<script setup lang="ts">
import { CheckIcon } from '@zeus-web/icons/vue'
<\/script>`,
    )

    await user.click(screen.getByLabelText('Copy WC import for Check'))
    expect(writeText).toHaveBeenLastCalledWith(
      `import '@zeus-web/icons/wc'

<zw-icon-check></zw-icon-check>`,
    )

    await user.click(screen.getByLabelText('Copy raw svg import for Check'))
    expect(writeText).toHaveBeenLastCalledWith(
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
