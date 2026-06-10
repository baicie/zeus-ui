# Zeus Web Router Showcase Apps

## Goal

The showcase apps are production-grade component laboratories for Zeus Web.

They are not simple demos. They must verify:

```txt
component behavior
component variants
controlled and uncontrolled usage
events
icons
theme tokens
accessibility
real-world composition
unit tests
e2e tests
```

## Apps

```txt
examples/showcase-shared
examples/react-showcase
examples/vue-showcase
```

## Responsibilities

### React Showcase

React Showcase verifies the registry-first production workflow:

```txt
zweb init
zweb add --all
local generated registry components
@zeus-web/icons/react
@zeus-web/themes/*
```

It should use a router-based app structure.

Recommended router:

```txt
@tanstack/react-router
```

Reasons:

```txt
typed routes
explicit route tree
production-like architecture
good fit for component laboratory pages
```

### Vue Showcase

Vue Showcase verifies the per-component Vue wrapper workflow:

```txt
@zeus-web/<component>/vue
@zeus-web/icons/vue
@zeus-web/themes/*
vue-router
```

Recommended router:

```txt
vue-router
```

## Route shape

Both React and Vue apps must expose the same route structure:

```txt
/
  Overview
/components
  Component index
/components/button
/components/input
/components/checkbox
/components/switch
/components/tabs
/components/dialog
/components/label
/components/textarea
/components/radio-group
/components/select
/components/card
/components/badge
/components/separator
/components/skeleton
/components/alert
/components/collapsible
/components/accordion
/components/tooltip
/components/progress
/components/avatar
/icons
/themes
/playground
```

## Component page contract

Every component page must follow this layout:

```txt
Header
  - component name
  - package name
  - React import
  - Vue import
  - Web Component import
  - registry command

Sections
  1. Basic
  2. Variants
  3. States
  4. Controlled
  5. Uncontrolled
  6. Events
  7. With icons
  8. Theme tokens
  9. Accessibility
  10. Production pattern
```

A component may omit sections that are not meaningful, but every page must include at least:

```txt
basic
states
theme
accessibility
production
```

## Required metadata

The shared package must define:

```txt
component list
route list
icon list
theme list
deferred component list
validation function
```

The metadata must be framework-agnostic.

## Current component scope

```txt
button
input
checkbox
switch
tabs
dialog
label
textarea
radio-group
select
card
badge
separator
skeleton
alert
collapsible
accordion
tooltip
progress
avatar
```

## Deferred scope

Overlay components are deferred from `0.1.0-beta.0`:

```txt
popover
dropdown
toast
```

Follow-up overlay infrastructure:

```txt
@zeus-web/portal
@zeus-web/dismissable-layer
@zeus-web/popper
```

Before any deferred overlay is enabled, it must update all of:

```txt
primitive package
registry item
AI metadata
docs
examples
unit tests
e2e tests
component coverage checks
showcase metadata
```

## Phase 0 acceptance criteria

```txt
examples/showcase-shared exists
shared metadata covers every current registry component
metadata validation passes
root check:showcase-metadata works
site:check includes showcase metadata check
docs/internal/design/showcase-apps.md exists
```

## Later phases

### Phase 1

Create `examples/react-showcase` router shell.

### Phase 2

Create `examples/vue-showcase` router shell.

### Phase 3

Implement P0 component pages:

```txt
button
input
checkbox
switch
tabs
dialog
```

### Phase 4

Implement remaining component pages.

### Phase 5

Add icon and theme pages.

### Phase 6

Add playground composition pages.

### Phase 7

Add unit tests and e2e tests.

### Phase 8

Integrate showcase checks into CI.
