# Zeus Web Advanced Components

`packages/advanced/*` contains product-level, high-complexity Zeus Web components.

Advanced components are different from `packages/primitives/*`:

- `packages/primitives/*` contains small headless behavior primitives such as button, input, dialog, switch and tabs.
- `packages/advanced/*` contains high-performance or product-level components such as virtual scrolling, AI chat, data grid and agent console.

Advanced components must remain **headless-first**. They own structure, behavior, state, events, methods, accessibility and performance contracts. They must not own the final product visual design.

Styled product output should be layered on top:

- `packages/registry` provides React / Vue source templates for `zweb add <component>`.
- `packages/ui` provides native styled Web Component entries such as `@zeus-web/ui/chat`.
- `packages/ai` documents AI metadata and usage rules for code generation.

## Planned packages

```txt
packages/advanced/
  virtual/        @zeus-web/virtual
  chat/           @zeus-web/chat
  revogrid/       @zeus-web/revogrid
  data-grid/      @zeus-web/data-grid
  agent-console/  @zeus-web/agent-console
```

## Component package rules

Every advanced package should provide the same output model as primitive packages:

```txt
@zeus-web/<advanced>
@zeus-web/<advanced>/wc
@zeus-web/<advanced>/wc/auto
@zeus-web/<advanced>/react
@zeus-web/<advanced>/vue
@zeus-web/<advanced>/custom-elements.json
@zeus-web/<advanced>/zeus.components.json
```

Advanced package internals should be split into two layers:

```txt
src/core/
  Framework-agnostic TypeScript engines.
  No React, Vue or DOM ownership unless the feature is explicitly browser-only.

src/components/
  Zeus defineElement Web Components.
  These adapt the core engine to Web Component props, events, slots and methods.
```

## Performance rules

Advanced components should follow these rules:

1. Web Components are the primary runtime target.
2. React and Vue wrappers must stay thin.
3. Object and array inputs use properties, not reflected attributes.
4. High-frequency updates are batched with `requestAnimationFrame` or an equivalent scheduler.
5. Large DOM surfaces render only visible viewport content plus overscan.
6. Heavy features such as markdown, syntax highlighting, export and custom renderers should be lazy-loaded.
7. Native, React and Vue showcases must validate the same behavior.

## Roadmap

The detailed design and roadmap live in:

```txt
docs/design/zeus-ui-advanced-components.md
```
