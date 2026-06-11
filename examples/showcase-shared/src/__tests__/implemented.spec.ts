import {
  getImplementedShowcaseComponents,
  getImplementedShowcasePackageNames,
  implementedShowcaseComponentNames,
  isImplementedShowcaseComponent,
} from '../implemented'

describe('implemented showcase components', () => {
  it('has unique component names', () => {
    expect(new Set(implementedShowcaseComponentNames).size).toBe(
      implementedShowcaseComponentNames.length,
    )
  })

  it('resolves implemented components and package names', () => {
    const components = getImplementedShowcaseComponents()
    const packageNames = getImplementedShowcasePackageNames()

    expect(components.length).toBe(implementedShowcaseComponentNames.length)
    expect(packageNames.length).toBe(implementedShowcaseComponentNames.length)
    expect(packageNames.every(name => name.startsWith('@zeus-web/'))).toBe(true)
  })

  it('recognizes implemented names', () => {
    expect(isImplementedShowcaseComponent('button')).toBe(true)
    expect(isImplementedShowcaseComponent('not-a-component')).toBe(false)
  })
})
