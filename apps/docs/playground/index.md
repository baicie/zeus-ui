# Interactive Playground

This playground renders the real Zeus Web Web Component entries inside the VitePress docs app.

It validates:

```txt
1. @zeus-web/<component>/wc imports.
2. Button, Input, Checkbox, Switch, Tabs and Dialog rendering.
3. Custom events emitted by primitives.
4. Theme and density controls in a docs environment.
```

<ZeusPlayground />

## Notes

The docs playground intentionally uses Web Components instead of React wrappers because VitePress is a Vue application.

React usage is validated separately by:

```bash
pnpm --filter @zeus-web/example-react-vite build
pnpm --filter @zeus-web/example-next-app build
```
