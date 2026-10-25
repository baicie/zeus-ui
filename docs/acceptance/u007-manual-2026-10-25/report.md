# U-007 手工关键路径验收（2026-10-25）

执行者：Codex agent。通过 macOS 的 ChatGPT in-app browser 实际逐步按键、点击并观察页面、可访问树和可见焦点。未启用 VoiceOver；本记录的范围是关键路径交互、可见状态和焦点，不构成完整的读屏软件验收。

原始走查基于 `7b6c5f9` 的文档站生产产物；发现默认布尔状态缺陷后，基于修复提交 `eda5e029a023910a9a445767254dd771272d476c` 重新构建文档站，在全新浏览器页面复核 Checkbox、Switch 与 Dialog。其余六类组件源码在这两个提交间未改变。

服务：`apps/docs/.vitepress/dist` 静态产物，`http://localhost:5413/components/<name>.html#playground`。修复复核页面带 `?check=eda5e02`。操作在页面控件内完成；网格从可聚焦单元格开始导航。

| 路径        | 实际操作                                     | 观察结果                                                                                                                               |
| ----------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Input       | 输入演示邮箱，Tab 到无效输入，再 Tab         | 当前值同步；输入具可访问名称，Invalid email 的 `aria-invalid=true`；禁用项被跳过                                                       |
| Textarea    | 在 Release notes 中输入换行和文字            | 多行内容可见，计数字段从 34 更新为 58 / 160                                                                                            |
| Checkbox    | 初始观察，Space 取消选中，Tab                | 修复后初始选中与 Notifications: enabled 一致；取消后为 disabled；mixed 状态为 2，禁用项不进入 Tab 顺序                                 |
| Switch      | 初始观察，Space 关闭，再 Tab 两次            | 修复后初始 on 与选中状态一致；关闭后显示 off；焦点经过 Compact mode 并跳过禁用项                                                       |
| Radio Group | 在 Balanced 上按 Right                       | Performance 被选中，状态文字同步，焦点移动到 Performance                                                                               |
| Dialog      | Enter 打开，Shift+Tab、Tab、Escape           | 初始焦点在 Cancel；反向循环到 Create project、正向返回 Cancel；Escape 关闭并回到触发按钮，焦点环可见                                   |
| Tabs        | 在 Overview 按 Right、End、Home              | 分别选中 Activity、Settings、Overview；对应面板可见且焦点跟随，Activity 焦点环可见                                                     |
| Select      | Enter 展开，Down、Enter 选择 Production，Tab | 下拉关闭，显示 Production 与 Deploy to: Production 一致；Tab 移到后续 Source 链接                                                      |
| Data Grid   | 从第一行 Record 单元格按 Right、Down         | 焦点与 active descendant 均为 `zg-cell-row-2-column-2`，row-key=row-2、column=column-2；ARIA 行号 3（含表头）、总行数 10001、总列数 20 |

初轮检查确实发现了 Checkbox/Switch 视觉关闭而文字开启的问题。根因是受控 `checked/open` 的隐式 `false` 遮蔽默认值。修复同时覆盖 Checkbox、Switch、Dialog、Collapsible、Tooltip，新增的构建产物回归验证默认 attribute/property、显式 false 优先以及关闭再开启。不能以仅修改状态文字替代这项修复。

本目录保留相关可访问树摘录、网格导航 JSON 和原始截图。自动化 axe / 键盘 gate 仍由 CI 继续执行；手工记录是对真实操作的补充。此次修复提交的本地 `check`、全包 `build`、`site:check` 结果均为成功，日志归档于本机 `/tmp/zeus-ui-initial-state-site-eda5e02-20261025.log`。最终稳定版发布后的消费者与供应链验收另行记录。
