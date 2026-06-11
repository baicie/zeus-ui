import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { semanticTokens } from '@zeus-web/example-showcase-shared'

import { ThemesPage } from '../routes/ThemesPage'

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

describe('react ThemesPage', () => {
  it('renders theme variants and token metadata', () => {
    render(<ThemesPage />)

    expect(screen.getByRole('heading', { name: 'Themes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Default/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Slate/ })).toBeInTheDocument()
    expect(
      screen.getByText(`${semanticTokens.length} semantic tokens`),
    ).toBeInTheDocument()
    expect(screen.getByText('Component preview')).toBeInTheDocument()
    expect(screen.getByText('Semantic token palette')).toBeInTheDocument()
    expect(screen.getByText('hsl(var(--background))')).toBeInTheDocument()
  })

  it('switches theme, mode, radius and motion controls', async () => {
    const user = userEvent.setup()

    render(<ThemesPage />)

    await user.click(screen.getByRole('button', { name: /Slate/ }))
    await user.selectOptions(screen.getByLabelText('Theme mode'), 'dark')
    await user.selectOptions(screen.getByLabelText('Radius preset'), 'xl')
    await user.selectOptions(
      screen.getByLabelText('Motion preset'),
      'expressive',
    )

    expect(screen.getByLabelText('Theme mode')).toHaveValue('dark')
    expect(screen.getByLabelText('Radius preset')).toHaveValue('xl')
    expect(screen.getByLabelText('Motion preset')).toHaveValue('expressive')
    expect(
      screen.getByText("import '@zeus-web/themes/slate.css'"),
    ).toBeInTheDocument()
  })

  it('switches snippets and copies the selected snippet', async () => {
    const user = userEvent.setup()
    const writeText = mockClipboard()

    render(<ThemesPage />)

    await user.click(screen.getByRole('button', { name: 'HTML usage' }))
    await user.click(screen.getByRole('button', { name: 'Copy snippet' }))

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('data-theme="default"'),
    )
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })
})
