# Web Component Instance Benchmark

This benchmark measures the instance-density cost of generated Zeus Web
Components in a real headless Chromium process.

## Run

```bash
pnpm web-c:bench
```

For a fast infrastructure check:

```bash
ZEUS_WEB_C_BENCH_PROFILE=smoke pnpm web-c:bench
```

Override the number of samples with `ZEUS_WEB_C_BENCH_SAMPLES`. The full
profile defaults to three samples and reports the median.

## Matrix

| Scenario                 | Full logical instance counts |
| ------------------------ | ---------------------------- |
| Native `button` baseline | 100, 1,000, 5,000            |
| Native `zw-button`       | 100, 1,000, 5,000            |
| React `Button` wrapper   | 100, 1,000, 5,000            |
| Vue native `button`      | 100, 1,000, 5,000            |
| Vue native `zw-button`   | 100, 1,000, 5,000            |
| Vue `Button` wrapper     | 100, 1,000, 5,000            |
| Native Accordion items   | 100, 500, 1,000              |

One Accordion item creates three independent custom elements: item, trigger,
and content. The Accordion scenario therefore reaches 3,001 custom elements at
1,000 logical items, including the root.

## Measurements

- Warm mount and forced layout duration.
- Batched property update duration.
- Disconnect, reconnect, and final disposal duration.
- V8 heap delta after mount and retained heap after disposal, with CDP garbage
  collection before each heap sample.
- Custom element, native button, and total element counts.
- Page errors, failed requests, and custom elements left after disposal.
- Same-page mount, update, and disposal churn for 1,000 instances over five
  rounds. This compares native, React, Vue-native, and Vue-wrapper paths.

The command writes its machine-readable report to
`temp/web-c-instance-benchmark-results.json`.

## Scope

The page is built in production mode before Chromium starts. Each sample uses a
fresh browser context, warms one instance before measuring, and excludes module
registration and network startup from mount timings.

The benchmark intentionally does not load a Zeus theme. It isolates component
runtime, framework wrapper, DOM construction, lifecycle, and unstyled layout
costs. Product pages with complex CSS must be profiled separately. Time and heap
values are observations, not fixed CI budgets; only lifecycle and DOM structure
contracts are asserted.

## Reference Run

The following medians were recorded on 2026-08-01 with headless Chromium
149.0.7827.55. They are reference observations from one development machine,
not portable performance budgets.

| Scenario               | Count |    Mount |  Update | Mounted heap | Retained after disposal |
| ---------------------- | ----: | -------: | ------: | -----------: | ----------------------: |
| Native `button`        | 1,000 |   5.1 ms |  1.7 ms |      0.10 MB |                 0.09 MB |
| Native `zw-button`     | 1,000 |  30.0 ms |  3.7 ms |      7.25 MB |                 0.32 MB |
| React `Button` wrapper | 1,000 |  68.7 ms | 35.0 ms |     11.18 MB |                 0.81 MB |
| Vue native `button`    | 1,000 |   6.2 ms |  3.1 ms |      0.38 MB |                 0.44 MB |
| Vue native `zw-button` | 1,000 |  32.1 ms |  5.1 ms |      7.52 MB |                 4.06 MB |
| Vue `Button` wrapper   | 1,000 |  59.8 ms | 21.6 ms |     15.21 MB |                10.90 MB |
| Native `button`        | 5,000 |  21.8 ms |  8.2 ms |      0.19 MB |                 0.09 MB |
| Native `zw-button`     | 5,000 | 134.3 ms | 16.1 ms |     34.67 MB |                 0.36 MB |
| React `Button` wrapper | 5,000 | 309.7 ms | 76.8 ms |     48.93 MB |                 0.93 MB |
| Vue native `button`    | 5,000 |  25.2 ms | 11.5 ms |      1.16 MB |                 1.24 MB |
| Vue native `zw-button` | 5,000 | 139.4 ms | 18.9 ms |     35.54 MB |                18.22 MB |
| Vue `Button` wrapper   | 5,000 | 264.5 ms | 89.6 ms |     72.32 MB |                50.38 MB |
| Native Accordion items | 1,000 |  63.7 ms |  6.6 ms |     11.15 MB |                 0.37 MB |

The five-round churn test reported the following retained-heap medians after
forced garbage collection:

| Scenario               |  Round 1 |  Round 5 | Growth after round 1 |
| ---------------------- | -------: | -------: | -------------------: |
| Native `zw-button`     |  0.32 MB |  0.38 MB |              0.06 MB |
| React `Button` wrapper |  0.81 MB |  1.06 MB |              0.24 MB |
| Vue native `button`    |  0.44 MB |  1.36 MB |              0.92 MB |
| Vue native `zw-button` |  4.00 MB | 18.10 MB |             14.10 MB |
| Vue `Button` wrapper   | 10.85 MB | 50.71 MB |             39.86 MB |

## Interpretation

- The native custom-element path is controlled at 1,000 instances, but mounting
  or reconnecting 5,000 instances is already a long task. The 5,000-button case
  creates 25,001 total elements.
- Framework wrappers add a separate component and VNode cost. Use direct custom
  elements or ordinary DOM in dense, frequently updated views when wrapper
  ergonomics do not justify that cost.
- Accordion scale must be judged by actual custom-element count. A logical
  1,000-item Accordion creates 3,001 custom elements and mounts in 63.7 ms in
  this reference run.
- Native and React churn approach a plateau. All three Vue paths grow between
  rounds, including the ordinary-button baseline, while custom elements and the
  generated wrapper amplify the retained tree size. This is a leak-risk signal
  for repeated `createApp` and `unmount` cycles, not proof that the wrapper alone
  leaks or that a long-lived Vue app grows the same way. A heap-snapshot retainer
  analysis is required before changing the wrapper runtime.
- Prefer coarse custom-element boundaries with ordinary DOM inside. Virtualize
  large lists and grids, and set budgets using actual custom-element and total
  DOM counts rather than logical component counts.
