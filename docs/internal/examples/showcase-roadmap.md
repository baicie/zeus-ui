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

The showcase has six layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Foundation page tests validate icons, themes and playground interaction behavior.
5. Shared unit tests validate metadata helpers, icon snippets, theme helpers and playground fixtures.
6. Vitest-powered Playwright E2E tests validate React and Vue showcase routes and critical browser interactions.

## Commands

```bash
pnpm check:showcase-metadata
pnpm check:showcase-implementation
pnpm showcase:test
pnpm showcase:build
pnpm showcase:e2e
pnpm showcase:e2e:ui
pnpm showcase:e2e:headed
pnpm site:check
pnpm site:build
```

## Next work

Future phases should continue with CI and release quality:

- Phase 14: Add CI workflow jobs for showcase unit tests, build and e2e.
- Add visual snapshots for the most important component states.
- Replace demo-only CSS with exported component theme styles where appropriate.
- Generate this roadmap from `examples/showcase-shared/src/implemented.ts`.
