# Data Grid 基准线

U-005 的基准线清单位于 [`baseline-manifest.json`](../../packages/advanced/data-grid/benchmarks/baseline-manifest.json)。它冻结场景规模、数据模式、记录设备和一次可复现的参考运行结果；更新实现时应提交新的日期化 `baselineId`，不要覆盖历史记录。

基准线分为两类：渲染单元格数、可见行列范围等结构预算是 CI 必须保持的约束；首次渲染、滚动帧延迟、FPS、更新耗时和内存变化是同一设备上的趋势数据。后者会受 Node、浏览器模拟环境和机器负载影响，因此不会被写成跨设备的绝对失败阈值。

本地运行：

```sh
pnpm --filter @zeus-web/data-grid check:bench
pnpm data-grid:bench 2>&1 | tee /tmp/data-grid-benchmark.log
pnpm check:data-grid-benchmark-baseline
pnpm report:data-grid-benchmark /tmp/data-grid-benchmark.log /tmp/data-grid-benchmark-report.json
```

CI 会保存原始 JSONL 日志、按场景归一化的 `report.json` 和运行环境信息。比较性能时，应使用同一基准线的设备和 Node 版本，结合报告中的 `kind` 与 `scenario` 查看趋势。
