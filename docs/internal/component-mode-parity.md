# 真实组件的 eager / lazy 一致性验收

`pnpm check:component-mode-parity` 将同一份 Button、Input、Dialog（含子组件）和
DataGrid 源码分别构建为 `side-effect` 与 `lazy` 输出。两个模式使用相同的 Analyzer
Manifest，在独立浏览器页面中运行同一程序；每个模式先断言正确行为，再比较全部观察值。

```sh
pnpm showcase:e2e:deps
pnpm exec playwright install chromium firefox webkit
pnpm check:component-mode-parity
```

默认覆盖 Chromium、Firefox、WebKit。只验证指定引擎时显式传入
`--browsers chromium`；本机使用系统 Chrome 时增加 `--chromium-channel chrome`，
报告会记录该 channel。Showcase CI 在安装三种引擎、构建依赖后运行三引擎双模式
验收，失败时也保留 `temp/component-mode-parity/report.json`。

| 阶段         | 必须证明的行为                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------ |
| upgrade      | 升级前 property 优先于旧 attribute；Boolean / Number 转换与反射；函数、对象及 slot 节点 identity |
| updates      | 属性增删与 property 更新；四组件的渲染状态及事件次数、detail                                     |
| runtime-move | 公共 `mountFor` keyed 重排保留四个组件控件 identity、输入值、选择状态与投影，不发用户事件        |
| imperative   | Dialog 的 show / close 依次发正确状态，未伪造 nativeEvent                                        |
| move         | 原生 DOM 移动后四组件的状态与事件、slot 次数一致；此路径允许完整断开和重新挂载                   |
| dispose      | 移出的旧控件不再发 host 事件，四组件的旧绑定停止更新                                             |
| reconnect    | 重连创建新控件，保留断开期间的 property 更新，事件处理器与 slot 没有丢失或重复                   |

报告记录 UI commit、四份组件源码 SHA-256、框架及 bundler 版本、Manifest SHA-256、
各引擎与模式的全部阶段观察。已销毁内部 DOM 的静态属性另存 `diagnostics`；两模式
必须证明 live 状态一致，销毁完成后旧绑定与旧事件处理器停止，不要求被丢弃的内部 DOM
保留特定静态值。缺少模式、阶段未跑完、任意运行或资源关闭失败，以及两个
模式观察值不同，都会使命令失败。

全程（包括构建、浏览器和清理）默认限时十分钟，可通过 `--timeout-ms` 调整。
资源关闭最多等待五秒；超时会终止本脚本启动的浏览器或关闭预览连接，写入失败报告并
以非零状态退出。

这是仓库真实源码的双适配器验收。它不能替代发布后的 npm 完整性、provenance、隔离
消费者及跨框架 Golden 验收；使用本地候选 runtime 的诊断结果必须另外标注来源。
