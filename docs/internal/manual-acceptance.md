# PR-24 人工验收脚本：200% 缩放与 RTL

这两项依赖真实排版与绘制，jsdom 无法给出有效结论，因此**在本仓库的自动化测试中标记为 NOT_RUN**（原因：仓库未安装 Playwright 浏览器，且本机沙箱不能监听本地端口）。下面是可复现的手工步骤，任何人在有浏览器的环境里按步骤执行即可。

自动化已覆盖的部分（不需要在这里重复）：

- 结构 / 属性反射 / 事件名与 payload：`e2e/contract/cross-host-contract.spec.ts`
- 键盘脚本与 ARIA 连线：`e2e/contract/a11y-keyboard.spec.ts`
- 样式隔离：`node --import tsx scripts/checks/build/check-ui-tarball-baseline.ts`

## 0. 准备

```bash
pnpm install
pnpm build
pnpm --filter @zeus-web/docs dev
```

打开文档站，逐个访问下列路由：

| 路由                    | 重点组件                       |
| ----------------------- | ------------------------------ |
| `/components/input`     | Input、FormField               |
| `/components/select`    | Select（listbox、typeahead）   |
| `/components/dialog`    | Dialog（焦点陷阱、Escape）     |
| `/components/popover`   | Popover（placement）           |
| `/components/data-grid` | DataGrid（虚拟滚动、列宽拖拽） |

## 1. 200% 缩放

Chrome：`Cmd/Ctrl` + `+` 四次（或 Settings → Appearance → Page zoom 设为 200%）。Chrome DevTools 的 Rendering 面板里也提供 Page zoom，效果相同。

Firefox：`Cmd/Ctrl` + `+` 四次，或 View → Zoom → Zoom In。

对每个路由检查：

1. **无横向滚动条**（除非 DataGrid 自身需要，DataGrid 的横向滚动应发生在网格内部，而不是整页）。
2. **文字不截断**：Input / Select 的占位符和值完整可见；FormField 的 label 与错误信息不重叠。
3. **焦点环不被裁剪**：Tab 到按钮、输入框、Select trigger，焦点环四边完整；特别注意 Dialog 内第一个与最后一个可聚焦元素。
4. **Dialog 不溢出视口**：内容超出时 Dialog 内部滚动，关闭按钮始终可见。
5. **DataGrid**：表头与行高按倍率放大，单元格文字不重叠；列宽拖拽手柄仍可命中（指针目标 ≥ 24×24 CSS px）。
6. **Tooltip / Popover**：200% 下不超出视口，箭头仍指向触发元素。

通过标准：以上 6 项全部满足；任何遮挡、裁剪、重叠都记为缺陷。

## 2. RTL

在文档站任意页面打开 DevTools Console：

```js
document.documentElement.dir = 'rtl'
```

（或在 `<html>` 上加 `dir="rtl"` 后刷新。）

对每个路由检查：

1. **文本对齐**：Input、Select、FormField 的 label 与值在右侧起始，`text-align: start` 生效。
2. **图标方向**：Select 展开指示器在 RTL 下位置镜像；Accordion 箭头镜像；但**字形类边框不镜像**（箭头尖端仍朝下）。
3. **进度条方向**：切到 indeterminate 状态，动画从右向左推进；确定态进度从右端填充。
4. **Tooltip**：带 `translate` 的定位在 RTL 下方向相反，tip 不偏离触发元素。
5. **内边距**：Input 的前缀/后缀（`prefix` / `suffix` slot）左右互换，不与文本重叠。
6. **Dialog / Popover**：关闭按钮在视觉上的阅读方向末端（左侧），遮罩与内容居中不变。
7. **DataGrid**：列顺序不反转（数据列保持逻辑顺序），但文本对齐跟随 `dir`；水平滚动条初始位置在右端。

已知缺口（PR-24 记录，不在本次修复范围）：`popover` / `dropdown-menu` 的 placement 使用物理坐标（`left` / `right`），RTL 下不会把 `bottom-start` 的锚点换到右侧。执行时预期这一项不通过，记录为已知问题。

## 3. 记录格式

验收结果写到 `docs/acceptance/<date>/report.md`，每项一行：

```
| 路由 | 检查项 | 环境（浏览器 / 缩放 / dir） | 结果 | 备注 |
```

结果只写 PASS / FAIL / SKIP，FAIL 必须附截图文件名。
