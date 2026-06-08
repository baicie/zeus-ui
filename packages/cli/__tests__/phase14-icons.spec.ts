import { iconNames, searchIcons } from '@zeus-web/icons'

describe('@zeus-web/cli phase 14 icon workflow', () => {
  it('can read icon names from icons package', () => {
    expect(iconNames).toContain('check')
    expect(iconNames).toContain('x')
    expect(iconNames).toContain('search')
  })

  it('can search icon metadata', () => {
    expect(searchIcons('success').map(icon => icon.name)).toContain('check')
    expect(searchIcons('warning').map(icon => icon.name)).toContain(
      'alert-triangle',
    )
  })
})
