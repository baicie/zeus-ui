# Zeus Web Showcase Roadmap

This document tracks the implementation status of the React and Vue showcase applications.

## Status

| Phase    | Status | Scope                                                                                                            |
| -------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| Phase 0  | Done   | Shared metadata, component inventory and validation baseline                                                     |
| Phase 1  | Done   | React showcase router shell                                                                                      |
| Phase 2  | Done   | Vue showcase router shell                                                                                        |
| Phase 3  | Done   | Shared page templates and scaffold components                                                                    |
| Phase 4  | Done   | P0 component pages: button, input, checkbox, switch, tabs, dialog                                                |
| Phase 5  | Done   | Form component pages: label, textarea, radio-group, select                                                       |
| Phase 6  | Done   | Visual and feedback pages: card, badge, separator, skeleton, alert, progress, avatar                             |
| Phase 7  | Done   | Disclosure and overlay pages: collapsible, accordion, tooltip                                                    |
| Phase 8  | Done   | CI hardening, build dependency orchestration, route smoke tests and roadmap                                      |
| Phase 9  | Done   | Icons page with grid, search, category filters, copy snippets and previews                                       |
| Phase 10 | Done   | Themes page with theme switcher, light/dark mode, radius, motion, token palette and component preview            |
| Phase 11 | Done   | Playground page with admin dashboard, settings form, project creation flow and interaction tests                 |
| Phase 12 | Done   | Unit tests for shared metadata, route smoke, foundation pages, playground interactions and root test-unit wiring |
| Phase 13 | Done   | Vitest-powered Playwright E2E smoke tests for React and Vue showcase routes and foundation interactions          |
| Phase 14 | Done   | CI workflow gates for showcase metadata, unit tests, builds and Vitest-powered Playwright E2E                    |
| Phase 15 | Done   | Product layering contract for primitives, themes, native styled Web-C, registry, CLI and showcase usage          |
| Phase 16 | Done   | Native styled Web-C package with styled button and input entrypoints                                             |
| Phase 17 | Done   | Registry foundation with React and Vue button/input templates                                                    |
| Phase 18 | Done   | CLI init command with zeus-ui.json, project detection, cn utility and styles initialization                      |
| Phase 19 | Done   | CLI add command with registry dependency expansion, framework filtering, file writing and lockfile tracking      |
| Phase 20 | Done   | React and Vue showcase consume registry-installed styled button and input components                             |
| Phase 21 | Done   | Native showcase for @zeus-web/ui styled Web Components without React or Vue                                      |

## Implemented component pages

### P0

- button
- input
- checkbox
- switch
- tabs
- dialog

### Forms

- label
- textarea
- radio-group
- select

### Visual and feedback

- card
- badge
- separator
- skeleton
- alert
- progress
- avatar

### Disclosure and overlay

- collapsible
- accordion
- tooltip

## Implemented foundation pages

### Icons

- icon grid
- search by name, label, category and tags
- category filter
- React import copy
- Vue import copy
- Web Component import copy
- raw SVG import copy
- preview size switch
- currentColor tone preview

### Themes

- theme variant switcher
- light / dark mode preview
- radius preset switcher
- motion preset switcher
- semantic token palette
- scoped component preview
- CSS import / HTML usage / token usage snippets

### Playground

- admin dashboard scenario
- release progress interaction
- environment change event log
- settings form validation
- project creation template selection
- React / Vue parity tests

## Engineering guarantees

The showcase has fourteen layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Foundation page tests validate icons, themes and playground interaction behavior.
5. Shared unit tests validate metadata helpers, icon snippets, theme helpers and playground fixtures.
6. Vitest-powered Playwright E2E tests validate React and Vue showcase routes and critical browser interactions.
7. CI gates run showcase metadata, unit tests, builds and browser E2E as separate jobs.
8. Product layer checks validate Zeus-UI package boundaries and usage entry decisions.
9. Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.
10. Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.
11. CLI init checks validate zeus-ui.json initialization, project detection and base file generation.
12. CLI add checks validate registry dependency expansion, framework-specific template filtering and lockfile tracking.
13. Showcase registry checks validate React and Vue demos consume registry-synced local styled components.
14. Native showcase checks validate @zeus-web/ui can be consumed without React or Vue.

## Commands

```bash
pnpm check:product-layers
pnpm check:ui-package
pnpm check:registry
pnpm check:cli-init
pnpm check:cli-add
pnpm check:showcase-metadata
pnpm check:showcase-implementation
pnpm check:showcase-registry
pnpm check:native-showcase
pnpm --filter @zeus-web/cli test:init
pnpm --filter @zeus-web/cli test:add
pnpm showcase:registry:sync
pnpm showcase:registry:check
pnpm showcase:native
pnpm showcase:native:test
pnpm showcase:native:build
pnpm --filter @zeus-web/ui build
pnpm --filter @zeus-web/ui check
pnpm --filter @zeus-web/ui test
pnpm --filter @zeus-web/registry build
pnpm --filter @zeus-web/registry check
pnpm --filter @zeus-web/registry test
pnpm showcase:test
pnpm showcase:build
pnpm showcase:e2e
pnpm showcase:e2e:ui
pnpm showcase:e2e:headed
pnpm showcase:ci
pnpm site:check
pnpm site:build
```

> `pnpm site:check` intentionally does not run `pnpm showcase:e2e`.
> Browser E2E is wired into CI through `.github/workflows/showcase.yml`.

## Next work

Future phases should rewrite public docs around the final product usage paths:

- Phase 22: Rewrite public docs around CLI, native styled Web-C and advanced primitive usage.
