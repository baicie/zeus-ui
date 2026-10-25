# Data Grid 基准线

U-005 的基准线清单位于 [`baseline-manifest.json`](../../packages/advanced/data-grid/benchmarks/baseline-manifest.json)。它冻结场景规模、数据模式、记录设备和一次可复现的参考运行结果；更新实现时应提交新的日期化 `baselineId`，不要覆盖历史记录。

基准线分为两类：渲染单元格数、可见行列范围等结构预算是 CI 必须保持的约束；首次渲染、滚动帧延迟、FPS、更新耗时和内存变化是同一设备上的趋势数据。后者会受 Node、浏览器模拟环境和机器负载影响，因此不会被写成跨设备的绝对失败阈值。

manifest 为每个场景分别记录 render、scroll 和 update 阶段的 `heapUsedDelta` 与 `rssDelta`。这些有符号差值保留运行时回收带来的负值，也只用于同一设备和 Node 版本之间的趋势比较。

当前基线为 `u005-data-grid-2026-10-24`，采集自提交 `d28d8a0047742d507d69f6f1c629231ddeca133e` 的 `@zeus-web/data-grid@0.1.0`。4 个规模场景的 render、scroll、update 共 12 项实测通过，归一化结果保存在 [`u005-data-grid-2026-10-24-report.json`](../../packages/advanced/data-grid/benchmarks/baselines/u005-data-grid-2026-10-24-report.json)。manifest 的指标直接取自该报告，结构预算仍为最多 600 个渲染单元格。

采集设备为 Apple M1（8 个逻辑核）、Darwin 24.6.0、arm64、Node v26.9.0，视口为 640×480。运行时有 `release:final` 构建和示例测试、短暂的 benchmark 合同测试及系统安全服务并行，开始采样前的 1/5/15 分钟系统负载为 9.889/9.552/8.639。耗时与内存比较需要在相同设备和负载条件下复测；完整环境记录保留在 manifest 中。

原 beta.33 基线已归档为 [`u005-data-grid-2026-10-23.json`](../../packages/advanced/data-grid/benchmarks/baselines/u005-data-grid-2026-10-23.json)。发布新的包版本时应重新采集并更新当前 manifest，同时保留之前的日期化记录和新运行报告。

本地运行：

```sh
pnpm --filter @zeus-web/data-grid check:bench
pnpm data-grid:bench 2>&1 | tee /tmp/data-grid-benchmark.log
pnpm check:data-grid-benchmark-baseline
pnpm report:data-grid-benchmark /tmp/data-grid-benchmark.log /tmp/data-grid-benchmark-report.json
```

CI 会保存原始 JSONL 日志、按场景归一化的 `report.json` 和运行环境信息。比较性能时，应使用同一基准线的设备和 Node 版本，结合报告中的 `kind` 与 `scenario` 查看趋势。
