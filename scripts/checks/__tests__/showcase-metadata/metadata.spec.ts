import {
  componentRoutes,
  deferredComponents,
  showcaseComponents,
  showcaseIcons,
  showcaseRoutes,
  showcaseThemes,
  validateShowcaseMetadata,
} from '../../../../examples/showcase-shared/src'

describe('showcase shared metadata', () => {
  it('passes metadata validation', () => {
    const result = validateShowcaseMetadata()

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('contains one route for every showcase component', () => {
    expect(componentRoutes).toHaveLength(showcaseComponents.length)

    for (const component of showcaseComponents) {
      expect(componentRoutes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: component.routePath,
            componentName: component.name,
          }),
        ]),
      )
    }
  })

  it('keeps deferred components out of component routes', () => {
    const routePaths = showcaseRoutes.map(route => route.path)
    const componentNames = showcaseComponents.map(component => component.name)

    for (const deferred of deferredComponents) {
      expect(componentNames).not.toContain(deferred)
      expect(routePaths).not.toContain(`/components/${deferred}`)
    }
  })

  it('declares enough icons for icon showcase', () => {
    expect(showcaseIcons.length).toBeGreaterThanOrEqual(20)
    expect(showcaseIcons.map(icon => icon.name)).toEqual(
      expect.arrayContaining(['check', 'x', 'search', 'settings', 'user']),
    )
  })

  it('declares current theme variants', () => {
    expect(showcaseThemes.map(theme => theme.name)).toEqual([
      'default',
      'slate',
      'zinc',
      'neutral',
      'stone',
    ])
  })
})
