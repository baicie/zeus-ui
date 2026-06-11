# Zeus Web Showcase Roadmap

This document tracks the implementation status of the React and Vue showcase applications.

## Status

| Phase    | Status | Scope                                                                                                 |
| -------- | ------ | ----------------------------------------------------------------------------------------------------- |
| Phase 0  | Done   | Shared metadata, component inventory and validation baseline                                          |
| Phase 1  | Done   | React showcase router shell                                                                           |
| Phase 2  | Done   | Vue showcase router shell                                                                             |
| Phase 3  | Done   | Shared page templates and scaffold components                                                         |
| Phase 4  | Done   | P0 component pages: button, input, checkbox, switch, tabs, dialog                                     |
| Phase 5  | Done   | Form component pages: label, textarea, radio-group, select                                            |
| Phase 6  | Done   | Visual and feedback pages: card, badge, separator, skeleton, alert, progress, avatar                  |
| Phase 7  | Done   | Disclosure and overlay pages: collapsible, accordion, tooltip                                         |
| Phase 8  | Done   | CI hardening, build dependency orchestration, route smoke tests and roadmap                           |
| Phase 9  | Done   | Icons page with grid, search, category filters, copy snippets and previews                            |
| Phase 10 | Done   | Themes page with theme switcher, light/dark mode, radius, motion, token palette and component preview |

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

## Engineering guarantees

The showcase has four layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Icons page tests validate search, filtering, preview controls and import copy actions.

## Commands

```bash
pnpm check:showcase-metadata
pnpm check:showcase-implementation
pnpm showcase:test
pnpm showcase:build
pnpm site:check
pnpm site:build
```

## Next work

Future phases should continue with foundation quality and production-like examples:

- Add Playwright smoke tests for React and Vue showcase.
- Add visual snapshots for the most important component states.
- Replace demo-only CSS with exported component theme styles where appropriate.
- Reduce route smoke runtime if it becomes slow.
- Generate this roadmap from `examples/showcase-shared/src/implemented.ts`.
