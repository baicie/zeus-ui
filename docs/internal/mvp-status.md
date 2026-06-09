# Zeus Web MVP Status

## Current target

The current MVP target is `0.1.0-beta.0`.

This beta focuses on:

```
headless primitives
multi-framework outputs
styled registry components
CLI workflows
theme tokens
icons
AI metadata
docs and examples
release readiness
```

## Completed scope

### Packages

```
@zeus-web/ai
@zeus-web/cli
@zeus-web/icons
@zeus-web/registry
@zeus-web/themes
@zeus-web/* primitive packages
```

### CLI

```
zweb init
zweb add
zweb list
zweb diff
zweb update
zweb doctor
zweb theme
zweb icon
zweb ai
```

### Registry components

```
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

The following overlay components are intentionally deferred from `0.1.0-beta.0`:

```
popover
dropdown
toast
```

Reason:

```
Overlay components require a stable positioning, portal, focus management,
dismissable layer, escape-key handling, outside-click handling, and stacking
strategy. These should be implemented as a focused follow-up phase instead of
being rushed into the first beta.
```

## Beta acceptance checklist

Before publishing the beta, run:

```bash
pnpm format-check
pnpm lint
pnpm test
pnpm check
pnpm build
pnpm check:exports
pnpm check:build-output
pnpm site:check
pnpm release:verify --allow-zero
```

## Component coverage contract

The MVP must keep these sources aligned:

```
packages/primitives/*
packages/registry/registry.json
packages/ai/src/metadata.ts
```

Run:

```bash
pnpm check:component-coverage
```

The check enforces:

```
registry item -> primitive package
registry item -> AI metadata
AI metadata -> registry item
AI metadata -> primitive package
registry dependency -> @zeus-web/<component>
```
