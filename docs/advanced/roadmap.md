# Zeus Web Advanced Roadmap

## Completed Advanced Route

```txt
Phase 0  Advanced workspace / contract
Phase 1  Virtual foundation
Phase 2  Chat headless
Phase 3  Chat product layer
Phase 4  Chat virtual thread integration
Phase 5  DataGrid Lite
Phase 6  DataGrid product layer
Phase 7  DataGrid column resize + keyboard navigation
Phase 8  DataGrid controlled state hardening
Phase 9  DataGrid DOM runtime tests
Phase 10 DataGrid runtime hardening + accessibility
Phase 11 RevoGrid adapter / interop validation
Phase 12 RevoGrid adapter runtime harness
Phase 13 RevoGrid adapter product layer
Phase 14 Agent Console foundation
Phase 15 Agent Console product layer
Phase 16 Agent Console runtime harness
Phase 17 Agent provider adapter contract
Phase 18 Final hardening / release contract
```

## Boundary

Advanced packages are UI/runtime foundations.

They must not include:

```txt
API keys
real LLM provider SDKs
network transport
provider fetch logic
server credentials
```

Provider integrations should be added as explicit opt-in adapters outside product templates.

## Advanced Packages

```txt
@zeus-web/virtual
@zeus-web/chat
@zeus-web/data-grid
@zeus-web/revogrid-adapter
@zeus-web/agent-console
```

## Package Responsibilities

### `@zeus-web/virtual`

Shared virtualization foundation for advanced components.

### `@zeus-web/chat`

Headless chat primitives and product-layer chat templates.

### `@zeus-web/data-grid`

Lightweight DataGrid foundation with virtualization, selection, sorting, resize, keyboard navigation, controlled state and accessibility hardening.

### `@zeus-web/revogrid-adapter`

Interop bridge that maps Zeus DataGrid rows, columns, sorting and selection into a RevoGrid-compatible custom element target.

It does not bundle or register RevoGrid.

### `@zeus-web/agent-console`

Headless Agent Console foundation for messages, tool calls, artifacts, diagnostics and local status state.

It does not connect to real LLM providers.

## Release Checklist

```bash
pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm check:product-contract
pnpm check:advanced-final-contract
pnpm release:plan
```

## Future Work

Future provider integrations must be opt-in packages or app-level adapters.

They should not be added to registry templates by default.
