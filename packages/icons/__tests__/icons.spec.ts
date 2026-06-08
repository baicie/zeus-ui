import {
  iconMetadata,
  iconNames,
  iconSources,
  isIconName,
  searchIcons,
} from '../src'

describe('@zeus-web/icons', () => {
  it('exports icon names', () => {
    expect(iconNames.length).toBeGreaterThanOrEqual(20)
    expect(iconNames).toContain('check')
    expect(iconNames).toContain('x')
    expect(iconNames).toContain('search')
    expect(iconNames).toContain('chevron-down')
  })

  it('keeps icon names unique', () => {
    expect(new Set(iconNames).size).toBe(iconNames.length)
  })

  it('keeps metadata aligned with icon sources', () => {
    for (const icon of iconSources) {
      expect(iconMetadata[icon.name]).toBeDefined()
      expect(iconMetadata[icon.name].name).toBe(icon.name)
    }
  })

  it('uses currentColor and viewBox for all icons', () => {
    for (const icon of iconSources) {
      expect(icon.svg).toContain('viewBox="0 0 24 24"')
      expect(icon.svg).toContain('currentColor')
    }
  })

  it('checks icon name guard', () => {
    expect(isIconName('check')).toBe(true)
    expect(isIconName('unknown')).toBe(false)
  })

  it('searches icons by name, title, and tags', () => {
    expect(searchIcons('check').map(icon => icon.name)).toContain('check')
    expect(searchIcons('warning').map(icon => icon.name)).toContain(
      'alert-triangle',
    )
    expect(searchIcons('theme').map(icon => icon.name)).toEqual(
      expect.arrayContaining(['sun', 'moon']),
    )
  })
})
