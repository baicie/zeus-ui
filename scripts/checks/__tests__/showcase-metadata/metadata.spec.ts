import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  componentRoutes,
  deferredComponents,
  semanticTokens,
  showcaseComponents,
  showcaseIcons,
  showcaseRoutes,
  showcaseThemes,
  validateShowcaseMetadata,
} from '../../../../examples/showcase-shared/src'

interface RegistryItem {
  name: string
  type: string
}

interface Registry {
  items: RegistryItem[]
}

function readRegistryComponentNames(): string[] {
  const registry = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'packages/registry/registry.json'),
      'utf-8',
    ),
  ) as Registry

  return registry.items
    .filter(item => item.type === 'registry:ui')
    .map(item => item.name)
    .sort()
}

describe('showcase shared metadata', () => {
  it('passes metadata validation', () => {
    const result = validateShowcaseMetadata({
      registryComponentNames: readRegistryComponentNames(),
    })

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

  it('uses only declared icons in component icon examples', () => {
    const iconNames = new Set(showcaseIcons.map(icon => icon.name))

    for (const component of showcaseComponents) {
      for (const icon of component.iconExamples) {
        expect(iconNames.has(icon)).toBe(true)
      }
    }
  })

  it('uses only declared semantic tokens in component metadata', () => {
    const tokenNames = new Set(semanticTokens.map(token => String(token)))

    for (const component of showcaseComponents) {
      for (const token of component.themeTokens) {
        expect(tokenNames.has(token)).toBe(true)
      }
    }
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

  it('keeps showcase components aligned with registry components', () => {
    expect(showcaseComponents.map(component => component.name).sort()).toEqual(
      readRegistryComponentNames(),
    )
  })
})
