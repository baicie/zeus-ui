# DataGrid React 18 consumer

This fixture verifies the framework-neutral DataGrid cell renderer adapter with
the real React 18.3.1 and React DOM 18.3.1 packages. It intentionally consumes
the adapter source because the public `cellRenderer` field is not a stable
DataGrid API yet.

Run the isolated checks from the repository root:

```bash
pnpm --filter @zeus-web/example-data-grid-react18-consumer check
pnpm --filter @zeus-web/example-data-grid-react18-consumer test
```

The tests cover keyed updates that preserve DOM focus and identity, row
replacement disposal, clearing, and reconnecting with a fresh React root.
