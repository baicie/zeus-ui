import type { DocsLocale } from '../../apps/docs/.vitepress/data/docs-i18n'

export interface ComponentDocsMessages {
  generated: string
  primitiveOnly: string
  playground: string
  dataGridPlaygroundDescription: string[]
  source: string
  sourceDescription: string
  install: string
  add: string
  imports: string
  styledRegistryComponent: string
  notAvailableYet: string
  primitiveReactWrapper: string
  webComponentEntry: string
  props: string
  events: string
  slots: string
  styling: string
  usesTailwind: string
  yes: string
  no: string
  themeTokens: string
  internalSelectors: string
  registry: string
  registryAvailable: string
  registryUnavailable: string
  registryUnavailableDescription: (
    componentName: string,
    primitivePackage: string,
  ) => string
  registryUnavailableAction: string
  addCommand: string
  type: string
  dependencies: string
  registryDependencies: string
  files: string
  aiUsageRules: string
  do: string
  doNot: string
  examples: string
  noPublicProps: string
  noPublicEvents: string
  noSlots: string
  noExamples: string
  noPublicMembers: string
  noUsageExamples: string
  valuesLabel: string
  propTableHeaders: [string, string, string, string]
  eventTableHeaders: [string, string, string, string]
  slotTableHeaders: [string, string]
  whenToUse: string
  whenNotToUse: string
  componentFamily: string
  methods: string
  aiUsageHints: string
  componentsTitle: string
  componentsDescription: (count: number) => string
  recommendedWorkflow: string
  currentRegistryComponents: string
  registryIndexDescription: string
  installMissingRegistry: string
  installPrimitiveInstead: string
}

export interface AdvancedDocsExampleTranslation {
  title: string
  description: string
}

export interface AdvancedDocsTranslation {
  summary: string
  whenToUse: string[]
  doNotUseFor: string[]
  examples: AdvancedDocsExampleTranslation[]
  promptHints: string[]
}

const englishMessages: ComponentDocsMessages = {
  generated: 'Generated',
  primitiveOnly: 'primitive-only',
  playground: 'Playground',
  dataGridPlaygroundDescription: [
    'Explore two-axis virtualization across datasets with up to 100,000 rows and',
    '1,000 columns.',
  ],
  source: 'Source',
  sourceDescription:
    'Choose the framework entry that matches your application.',
  install: 'Install',
  add: 'Add',
  imports: 'Imports',
  styledRegistryComponent: 'Styled registry component:',
  notAvailableYet: 'Not available yet.',
  primitiveReactWrapper: 'Primitive React wrapper:',
  webComponentEntry: 'Web Component entry:',
  props: 'Props',
  events: 'Events',
  slots: 'Slots',
  styling: 'Styling',
  usesTailwind: 'Uses Tailwind',
  yes: 'yes',
  no: 'no',
  themeTokens: 'Theme tokens:',
  internalSelectors: 'Internal selectors:',
  registry: 'Registry',
  registryAvailable: 'Registry source: available.',
  registryUnavailable: 'Registry source: not available yet.',
  registryUnavailableDescription: (componentName, primitivePackage) =>
    `The \`${componentName}\` primitive is available through \`${primitivePackage}\`, but it is not currently installable through the CLI registry.`,
  registryUnavailableAction:
    'Use the primitive package directly until a registry template is added.',
  addCommand: 'Add command',
  type: 'Type',
  dependencies: 'Dependencies:',
  registryDependencies: 'Registry dependencies:',
  files: 'Files:',
  aiUsageRules: 'AI usage rules',
  do: 'Do:',
  doNot: 'Do not:',
  examples: 'Examples',
  noPublicProps: 'No public props documented.',
  noPublicEvents: 'No public events documented.',
  noSlots: 'No slots documented.',
  noExamples: 'No examples documented.',
  noPublicMembers: 'No public members documented.',
  noUsageExamples: 'No usage examples documented.',
  valuesLabel: 'Values',
  propTableHeaders: ['Prop', 'Type', 'Default', 'Description'],
  eventTableHeaders: ['Event', 'React prop', 'Detail', 'Description'],
  slotTableHeaders: ['Slot', 'Description'],
  whenToUse: 'When to use',
  whenNotToUse: 'When not to use',
  componentFamily: 'Component family',
  methods: 'Methods',
  aiUsageHints: 'AI usage hints',
  componentsTitle: 'Components',
  componentsDescription: count =>
    `Browse all ${count} public component packages by capability. Each component has one canonical page with a live preview, framework-specific source, installation guidance and API details.`,
  recommendedWorkflow: 'Recommended workflow',
  currentRegistryComponents: 'Current registry components',
  registryIndexDescription:
    'Registry availability applies to copyable primitive source. Advanced components are installed from their package.',
  installMissingRegistry:
    'This component does not have a registry template yet.',
  installPrimitiveInstead: 'Install the primitive package instead:',
}

const chineseMessages: ComponentDocsMessages = {
  generated: '自动生成',
  primitiveOnly: '仅基础组件',
  playground: '交互演示',
  dataGridPlaygroundDescription: [
    '体验二维虚拟化在大型数据集中的表现，最多支持 100,000 行和',
    '1,000 列。',
  ],
  source: '源码',
  sourceDescription: '请选择与你的应用框架匹配的入口。',
  install: '安装',
  add: '添加',
  imports: '导入',
  styledRegistryComponent: '样式化 Registry 组件：',
  notAvailableYet: '暂不可用。',
  primitiveReactWrapper: '基础组件 React 包装器：',
  webComponentEntry: 'Web Component 入口：',
  props: '属性',
  events: '事件',
  slots: '插槽',
  styling: '样式',
  usesTailwind: '使用 Tailwind',
  yes: '是',
  no: '否',
  themeTokens: '主题变量：',
  internalSelectors: '内部选择器：',
  registry: 'Registry',
  registryAvailable: 'Registry 源码：可用。',
  registryUnavailable: 'Registry 源码：暂不可用。',
  registryUnavailableDescription: (componentName, primitivePackage) =>
    `\`${componentName}\` 基础组件可通过 \`${primitivePackage}\` 使用，但目前还不能通过 CLI Registry 安装。`,
  registryUnavailableAction: '在 Registry 模板加入之前，请直接使用基础组件包。',
  addCommand: '添加命令',
  type: '类型',
  dependencies: '依赖：',
  registryDependencies: 'Registry 依赖：',
  files: '文件：',
  aiUsageRules: 'AI 使用规则',
  do: '建议：',
  doNot: '避免：',
  examples: '示例',
  noPublicProps: '暂无公开属性。',
  noPublicEvents: '暂无公开事件。',
  noSlots: '暂无插槽。',
  noExamples: '暂无示例。',
  noPublicMembers: '暂无公开成员。',
  noUsageExamples: '暂无使用示例。',
  valuesLabel: '可选值',
  propTableHeaders: ['属性', '类型', '默认值', '说明'],
  eventTableHeaders: ['事件', 'React 属性', '详情', '说明'],
  slotTableHeaders: ['插槽', '说明'],
  whenToUse: '何时使用',
  whenNotToUse: '何时不应使用',
  componentFamily: '组件族',
  methods: '方法',
  aiUsageHints: 'AI 使用提示',
  componentsTitle: '组件',
  componentsDescription: count =>
    `按能力浏览全部 ${count} 个公开组件包。每个组件都有唯一的规范页面，包含实时预览、不同框架的源码、安装指南和 API 详情。`,
  recommendedWorkflow: '推荐工作流',
  currentRegistryComponents: '当前 Registry 组件',
  registryIndexDescription:
    'Registry 可用性仅表示可复制的基础组件源码；高级组件通过各自的软件包安装。',
  installMissingRegistry: '此组件暂时没有 Registry 模板。',
  installPrimitiveInstead: '请改为安装基础组件包：',
}

const chineseMetadataText: Record<string, string> = {
  'Styled button component built on the zw-button primitive.':
    '基于 zw-button 基础组件构建的样式化按钮。',
  'Visual style variant.': '视觉样式变体。',
  'Button size.': '按钮尺寸。',
  'Disables user interaction.': '禁用用户交互。',
  'Marks the button as loading and prevents press handling.':
    '将按钮标记为加载中并阻止按压处理。',
  'Accessible label for icon-only buttons.': '仅图标按钮的无障碍标签。',
  'Emitted when the button is clicked and not disabled.':
    '按钮未禁用且被点击时触发。',
  'Button label content.': '按钮标签内容。',
  'Content before the label.': '标签之前的内容。',
  'Content after the label.': '标签之后的内容。',
  'Use Button for actions.': '使用 Button 表示操作。',
  'Use variant="outline" for secondary actions.':
    '次要操作使用 variant="outline"。',
  'Use size="icon" only for icon-only buttons.':
    '仅在纯图标按钮中使用 size="icon"。',
  'Do not add asChild; the current registry Button does not implement asChild.':
    '不要添加 asChild；当前 Registry Button 尚未实现该能力。',
  'Do not attach click handlers to internal button selectors manually.':
    '不要手动给内部按钮选择器绑定点击处理器。',
  'React styled usage': 'React 样式化用法',
  'Styled text input component built on the zw-input primitive.':
    '基于 zw-input 基础组件构建的样式化文本输入框。',
  'Controlled input value.': '受控输入值。',
  'Initial uncontrolled value.': '非受控模式的初始值。',
  'Native input type.': '原生输入类型。',
  'Placeholder text.': '占位文本。',
  'Disables input interaction.': '禁用输入交互。',
  'Native input id attribute.': '原生输入框的 id 属性。',
  'Native input autocomplete attribute.': '原生输入框的 autocomplete 属性。',
  'Accessible label for unlabeled inputs.': '无可见标签输入框的无障碍标签。',
  'ID reference for additional accessible description.':
    '额外无障碍说明的 ID 引用。',
  'ID reference for accessible error message.': '无障碍错误消息的 ID 引用。',
  'Emitted when the input value changes.': '输入值变化时触发。',
  'Content before the native input.': '原生输入框之前的内容。',
  'Content after the native input.': '原生输入框之后的内容。',
  'Use Input for text-like form fields.': '文本类表单字段使用 Input。',
  'Use onValueChange when the user wants Zeus custom events.':
    '需要 Zeus 自定义事件时使用 onValueChange。',
  'Do not style only the host for placeholder or disabled states.':
    '不要只在宿主元素上设置占位符或禁用状态样式。',
  'Do not assume the native input is the custom element itself.':
    '不要假定原生 input 就是自定义元素本身。',
  'Styled checkbox component built on the zw-checkbox primitive.':
    '基于 zw-checkbox 基础组件构建的样式化复选框。',
  'Controlled checked state.': '受控选中状态。',
  'Initial checked state.': '初始选中状态。',
  'Mixed state.': '混合状态。',
  'Checkbox size.': '复选框尺寸。',
  'Marks the checkbox as required.': '将复选框标记为必填。',
  'Accessible label for unlabeled checkboxes.':
    '无可见标签复选框的无障碍标签。',
  'Emitted when checked state changes.': '选中状态变化时触发。',
  'Emitted when focus state changes.': '焦点状态变化时触发。',
  'Label content.': '标签内容。',
  'Custom indicator content.': '自定义指示器内容。',
  'Use Checkbox for boolean form choices.': '布尔表单选项使用 Checkbox。',
  'Use indeterminate for mixed state.': '混合状态使用 indeterminate。',
  'Do not render a separate native input next to Checkbox.':
    '不要在 Checkbox 旁额外渲染原生 input。',
  'Do not manually manage aria-checked when using the primitive props.':
    '使用基础组件属性时不要手动管理 aria-checked。',
  'Styled switch component built on the zw-switch primitive.':
    '基于 zw-switch 基础组件构建的样式化开关。',
  'Switch size.': '开关尺寸。',
  'Marks the switch as required.': '将开关标记为必填。',
  'Accessible label for unlabeled switches.': '无可见标签开关的无障碍标签。',
  'Use Switch for on/off settings.': '开启或关闭设置使用 Switch。',
  'Use Checkbox instead when the field is part of a multi-select list.':
    '字段属于多选列表时应改用 Checkbox。',
  'Do not use Switch for submitting an immediate destructive action.':
    '不要用 Switch 提交立即执行的破坏性操作。',
  'Styled tabs component family built on zw-tabs primitives.':
    '基于 zw-tabs 基础组件构建的样式化标签页组件族。',
  'Controlled active tab value.': '受控的当前标签值。',
  'Initial active tab value.': '初始活动标签值。',
  'Tabs orientation.': '标签页方向。',
  'Disables all triggers.': '禁用所有触发器。',
  'Emitted when active tab changes.': '活动标签变化时触发。',
  'Tabs child components.': '标签页子组件。',
  'Use Tabs, TabsList, TabsTrigger and TabsContent together.':
    '请组合使用 Tabs、TabsList、TabsTrigger 和 TabsContent。',
  'Keep trigger value and content value aligned.':
    '保持触发器与内容的 value 一致。',
  'Do not use TabsContent without matching TabsTrigger value.':
    '不要使用没有对应 TabsTrigger value 的 TabsContent。',
  'Styled dialog component family built on zw-dialog primitives.':
    '基于 zw-dialog 基础组件构建的样式化对话框组件族。',
  'Controlled open state.': '受控打开状态。',
  'Initial open state.': '初始打开状态。',
  'Whether the dialog is modal.': '对话框是否为模态。',
  'Emitted when open state changes.': '打开状态变化时触发。',
  'Dialog child components.': '对话框子组件。',
  'Use Dialog, DialogTrigger and DialogContent together.':
    '请组合使用 Dialog、DialogTrigger 和 DialogContent。',
  'Use DialogTitle for accessible titles.': '使用 DialogTitle 提供无障碍标题。',
  'Use DialogDescription when extra accessible context is available.':
    '有额外无障碍上下文时使用 DialogDescription。',
  'Rely on the primitive for Escape close, focus return, and modal focus trapping.':
    '依赖基础组件处理 Escape 关闭、焦点返回和模态焦点锁定。',
  'Do not create a second overlay unless the registry provides one.':
    '除非 Registry 已提供，否则不要创建第二个遮罩层。',
  'Do not remove DialogTitle when the dialog needs an accessible name.':
    '对话框需要无障碍名称时不要移除 DialogTitle。',
  'Do not manually wire aria-labelledby or aria-describedby when using the provided title and description primitives.':
    '使用提供的标题和描述基础组件时，不要手动连接 aria-labelledby 或 aria-describedby。',
  'Styled label component built on the zw-label primitive.':
    '基于 zw-label 基础组件构建的样式化标签。',
  'ID of the associated form control.': '关联表单控件的 ID。',
  'Shows a required indicator.': '显示必填指示器。',
  'Marks the label as disabled.': '将标签标记为禁用。',
  'Visually hides the label while keeping it accessible.':
    '在保持无障碍可访问的同时从视觉上隐藏标签。',
  'Use Label with form controls.': '将 Label 与表单控件搭配使用。',
  'Use for to associate labels with control ids.':
    '使用 for 将标签与控件 ID 关联。',
  'Do not use Label as a generic text wrapper.':
    '不要把 Label 当作通用文本容器。',
  'Styled textarea component built on the zw-textarea primitive.':
    '基于 zw-textarea 基础组件构建的样式化文本域。',
  'Controlled textarea value.': '受控文本域值。',
  'Native rows attribute.': '原生 rows 属性。',
  'Accessible label for unlabeled textareas.': '无可见标签文本域的无障碍标签。',
  'Emitted when the textarea value changes.': '文本域值变化时触发。',
  'Validation or help message.': '校验或帮助消息。',
  'Use Textarea for multi-line text input.': '多行文本输入使用 Textarea。',
  'Do not use Input for multi-line content.': '不要用 Input 输入多行内容。',
  'Styled radio group component built on zw-radio-group primitives.':
    '基于 zw-radio-group 基础组件构建的样式化单选组。',
  'Controlled selected value.': '受控选中值。',
  'Initial selected value.': '初始选中值。',
  'Native radio group name.': '原生单选组名称。',
  'Layout orientation.': '布局方向。',
  'Marks the group as required.': '将单选组标记为必填。',
  'Emitted when selected value changes.': '选中值变化时触发。',
  'RadioGroupItem children.': 'RadioGroupItem 子组件。',
  'Use RadioGroup for one-of-many choices.': '多选一场景使用 RadioGroup。',
  'Keep RadioGroupItem values unique.': '保持 RadioGroupItem 的值唯一。',
  'Do not use Checkbox when only one option can be selected.':
    '只能选择一个选项时不要使用 Checkbox。',
  'Accessible custom select with a combobox trigger and listbox popup.':
    '带组合框触发器和列表框浮层的无障碍自绘选择器。',
  'Base ID used to derive the internal trigger ID; the listbox keeps its generated ID.':
    '用于派生内部触发器 ID 的基础 ID；列表框继续使用自动生成的 ID。',
  'Current selected value.': '当前选中值。',
  'Current selected values in multiple mode. Pass as a JavaScript property.':
    '多选模式下的当前选中值；请通过 JavaScript property 传入。',
  'Initial selected values in multiple mode. Pass as a JavaScript property.':
    '多选模式下的初始选中值；请通过 JavaScript property 传入。',
  'Text shown when no option is selected.': '未选择选项时显示的文本。',
  'Select control size.': '选择器控件尺寸。',
  'Enables multiple selection.': '启用多选。',
  'Marks the select as required for form validation.':
    '将选择器标记为表单必填项。',
  'Marks the select as invalid.': '将选择器标记为无效。',
  'Form field name used during submission.': '表单提交时使用的字段名称。',
  'Accessible label for unlabeled selects.': '无可见标签选择器的无障碍标签。',
  'ID reference for the visible select label.': '可见选择器标签的 ID 引用。',
  'ID reference for the accessible error message.':
    '无障碍错误消息的 ID 引用。',
  'Emitted when focus enters or leaves the select trigger.':
    '焦点进入或离开选择器触发器时触发。',
  'Option children used as the select data source.':
    '作为选择器数据源的 option 子元素。',
  'Use Select for single or multiple choice lists with keyboard navigation.':
    '需要键盘导航的单选或多选列表使用 Select。',
  'Use placeholder when the field has no initial selection.':
    '字段没有初始选中项时使用 placeholder。',
  'Set values and defaultValues as JavaScript properties, not HTML attributes.':
    'values 和 defaultValues 应通过 JavaScript property 设置，不要写成 HTML attribute。',
  'Do not use Select for free-form text entry or remote autocomplete.':
    '不要用 Select 处理自由文本输入或远程自动补全。',
  'Styled card component family built on zw-card primitives.':
    '基于 zw-card 基础组件构建的样式化卡片组件族。',
  'Card child components.': '卡片子组件。',
  'Use Card for grouped content containers.': '使用 Card 组织相关内容。',
  'Use CardHeader + CardTitle for titles.':
    '使用 CardHeader 和 CardTitle 展示标题。',
  'Use CardContent for the main body.': '主要内容使用 CardContent。',
  'Use CardFooter for actions.': '操作区域使用 CardFooter。',
  'Do not use Card inside another Card.': '不要在 Card 内嵌套另一个 Card。',
  'Do not place interactive elements in CardDescription.':
    '不要在 CardDescription 中放置交互元素。',
  'Styled badge component built on the zw-badge primitive.':
    '基于 zw-badge 基础组件构建的样式化徽标。',
  'Badge size.': '徽标尺寸。',
  'Badge content.': '徽标内容。',
  'Use Badge for status labels and counts.': '使用 Badge 展示状态与计数。',
  'Do not use Badge as a clickable button.': '不要把 Badge 当作可点击按钮。',
  'Styled separator component built on the zw-separator primitive.':
    '基于 zw-separator 基础组件构建的样式化分隔线。',
  'Visual orientation.': '视觉方向。',
  'Use Separator to divide sections.': '使用 Separator 分隔内容区域。',
  'Do not use Separator for decorative spacing.':
    '不要用 Separator 充当装饰性间距。',
  'Styled skeleton component built on the zw-skeleton primitive.':
    '基于 zw-skeleton 基础组件构建的样式化骨架屏。',
  'Shape variant.': '形状变体。',
  'Enables loading animation.': '启用加载动画。',
  'Use Skeleton for loading placeholders.': '使用 Skeleton 展示加载占位内容。',
  'Do not show Skeleton for content that loads instantly.':
    '内容可立即加载时不要展示 Skeleton。',
  'Styled alert component family built on zw-alert primitives.':
    '基于 zw-alert 基础组件构建的样式化警告提示组件族。',
  'ARIA live region mode.': 'ARIA 实时区域模式。',
  'Alert content.': '警告提示内容。',
  'Use Alert for system messages.': '使用 Alert 展示系统消息。',
  'Use AlertTitle for the heading.': '标题使用 AlertTitle。',
  'Use AlertDescription for the detail.': '详细说明使用 AlertDescription。',
  'Do not use Alert for persistent banners outside the page content.':
    '不要将 Alert 用作页面内容之外的持久横幅。',
  'Styled collapsible component family built on zw-collapsible primitives.':
    '基于 zw-collapsible 基础组件构建的样式化折叠面板组件族。',
  'Disables trigger interaction.': '禁用触发器交互。',
  'Trigger and content children.': '触发器和内容子组件。',
  'Use Collapsible for simple show/hide content.':
    '简单的内容显示与隐藏使用 Collapsible。',
  'Use CollapsibleTrigger and CollapsibleContent together.':
    '请组合使用 CollapsibleTrigger 和 CollapsibleContent。',
  'Do not use Collapsible when multiple related sections should coordinate; use Accordion instead.':
    '多个相关区域需要协同时不要使用 Collapsible，应改用 Accordion。',
  'Styled accordion component family built on zw-accordion primitives.':
    '基于 zw-accordion 基础组件构建的样式化手风琴组件族。',
  'Accordion selection mode.': '手风琴选择模式。',
  'Allows closing the active item in single mode.':
    '允许在单选模式下关闭活动项。',
  'Emitted when open item values change.': '打开项的值变化时触发。',
  'AccordionItem children.': 'AccordionItem 子组件。',
  'Use Accordion for grouped expandable sections.':
    '成组的可展开区域使用 Accordion。',
  'Keep AccordionItem values unique.': '保持 AccordionItem 的值唯一。',
  'Do not use Accordion as a tab replacement.': '不要用 Accordion 替代标签页。',
  'Do not omit AccordionItem value.': '不要省略 AccordionItem 的 value。',
  'Styled tooltip component family built on zw-tooltip primitives.':
    '基于 zw-tooltip 基础组件构建的样式化文字提示组件族。',
  'Delay in milliseconds before opening.': '打开前的延迟毫秒数。',
  'Tooltip trigger and content.': '文字提示的触发器和内容。',
  'Use Tooltip for short supplemental information.':
    '使用 Tooltip 展示简短的补充信息。',
  'Keep tooltip content concise.': '保持提示内容简洁。',
  'Do not put interactive controls inside TooltipContent.':
    '不要在 TooltipContent 中放置交互控件。',
  'Do not rely on Tooltip for essential information.':
    '不要依赖 Tooltip 传达必要信息。',
  'Styled progress component built on the zw-progress primitive.':
    '基于 zw-progress 基础组件构建的样式化进度条。',
  'Current progress value.': '当前进度值。',
  'Maximum progress value.': '最大进度值。',
  'Whether progress is indeterminate.': '进度是否为不确定状态。',
  'Accessible progress label.': '进度条的无障碍标签。',
  'Optional content.': '可选内容。',
  'Use Progress to represent task completion.':
    '使用 Progress 表示任务完成度。',
  'Do not use Progress as a generic loading spinner.':
    '不要把 Progress 当作通用加载指示器。',
  'Styled avatar component family built on zw-avatar primitives.':
    '基于 zw-avatar 基础组件构建的样式化头像组件族。',
  'Avatar size.': '头像尺寸。',
  'Avatar shape.': '头像形状。',
  'Emitted when avatar image loads.': '头像图片加载成功时触发。',
  'Emitted when avatar image fails to load.': '头像图片加载失败时触发。',
  'AvatarImage and AvatarFallback children.':
    'AvatarImage 和 AvatarFallback 子组件。',
  'Use AvatarImage with meaningful alt text.':
    '为 AvatarImage 提供有意义的替代文本。',
  'Always provide AvatarFallback.': '始终提供 AvatarFallback。',
  'Do not use Avatar for decorative icons.': '不要用 Avatar 展示装饰性图标。',
  'Do not omit fallback content.': '不要省略回退内容。',
}

const englishAdvancedDocs: Record<string, AdvancedDocsTranslation> = {
  chat: {
    summary:
      'Use @zeus-web/chat to build headless ChatGPT-style chat interfaces with Web Components and thin React/Vue wrappers.',
    whenToUse: [
      'Build AI chat, agent console or conversational assistant UIs.',
      'Reuse the same chat behavior protocol across native Web Component, React and Vue.',
      'Keep product styling free while reusing structure, events, methods and accessibility semantics.',
    ],
    doNotUseFor: [
      'Do not treat it as a model request library.',
      'Do not embed provider request logic inside the components.',
      'Do not put credentials, secrets or tokens in component props.',
      'Do not depend on Markdown parsing, syntax highlighting or file-upload transport in this phase.',
    ],
    examples: [
      {
        title: 'Native Web Component usage',
        description:
          'Use the auto entry and compose chat, thread, message and composer with plain DOM.',
      },
      {
        title: 'React wrapper usage',
        description:
          'Use the generated React wrapper when the host application is React.',
      },
    ],
    promptHints: [
      'Compose zw-chat, zw-chat-thread, zw-chat-message and zw-chat-composer when generating a chat interface.',
      'Use zw-chat-code-block for code; do not put a syntax-highlighting library in the chat root.',
      'Use the matching zw-chat-artifact slot for an artifact or canvas area.',
      'Use zw-chat-tool-call to display tool calls.',
      'Keep business request logic in the application layer.',
    ],
  },
  virtual: {
    summary:
      'Use @zeus-web/virtual as a headless, one-axis virtualization foundation for large lists and higher-level Zeus Web components.',
    whenToUse: [
      'Render large activity feeds, logs, timelines or other one-dimensional collections without mounting every item.',
      'Build a higher-level advanced component that needs reusable range calculation, size measurement and scroll alignment.',
      'Support vertical or horizontal virtual scrolling with explicit overscan and imperative navigation.',
    ],
    doNotUseFor: [
      'Do not treat this package as a model request library.',
      'Do not expect zw-virtual-list to render item content; the application owns the item renderer.',
      'Do not use it for small collections where rendering every item is simpler and inexpensive.',
      'Do not use the one-axis list as a substitute for @zeus-web/data-grid when rows and columns both need virtualization.',
      'Do not put network requests, credentials or provider-specific transport inside the virtualizer.',
    ],
    examples: [
      {
        title: 'Core virtualizer usage',
        description:
          'Use the framework-independent engine when building a higher-level component.',
      },
      {
        title: 'Native Web Component usage',
        description:
          'Listen for range changes and render only the items supplied by the headless list.',
      },
      {
        title: 'React wrapper usage',
        description:
          'Use the generated wrapper and keep visible items in application state.',
      },
    ],
    promptHints: [
      'zw-virtual-list is headless and does not render item nodes; handle range-change or call getItems() to obtain the current virtual items.',
      'Render only the returned items and position each item from its start and size values.',
      'Give the viewport a bounded size and overflow so the component can measure a useful visible range.',
      'Use scrollToIndex with start, center or end alignment for imperative navigation.',
      'Use createVirtualizer directly when implementing a higher-level Zeus Web component.',
      'Keep business request logic in the application layer.',
    ],
  },
  'data-grid': {
    summary:
      'Use @zeus-web/data-grid to build headless data grids with two-axis virtualization, column and row models, selection and sorting.',
    whenToUse: [
      'Display structured tabular data.',
      'Use a lightweight Data Grid instead of a full AG Grid-scale table system.',
      'Reuse one Data Grid behavior protocol across native Web Component, React and Vue.',
      'Use two-axis virtual scrolling, single-column sorting and single or multiple selection.',
    ],
    doNotUseFor: [
      'Do not treat it as a server-side data source.',
      'Do not put real request logic inside the component.',
      'Do not treat it as a model request library.',
      'Do not put authentication data, secrets or tokens in component props.',
      'Do not depend on filters, tree tables, grouping or cell editors in the current phase.',
    ],
    examples: [
      {
        title: 'React package usage',
        description:
          'Use the generated Data Grid wrapper from the advanced package in React applications.',
      },
      {
        title: 'Native Web Component usage',
        description:
          'Use the auto entry when the host application is not React or Vue.',
      },
    ],
    promptHints: [
      'Prefer data-grid over a hand-written complex div table when generating structured data tables.',
      'Enable virtual when rendering many rows.',
      'Set selectionMode="single" or selectionMode="multiple" when rows must be selectable.',
      'Set sortable: true on a column when sorting is required.',
      'Keep business request logic in the application layer.',
      'Do not generate provider, authentication, remote request or server-side data-source logic inside data-grid.',
    ],
  },
  'revogrid-adapter': {
    summary:
      'Use @zeus-web/revogrid-adapter to map Zeus Data Grid rows, columns, sorting and selection state to a <revo-grid> custom element without bundling RevoGrid itself.',
    whenToUse: [
      'Use it when the application has registered a real <revo-grid> implementation and needs to connect a Data Grid model.',
      'Bridge an existing Data Grid data source to a RevoGrid-compatible table component.',
      'Reuse one adapter behavior protocol across native Web Component, React and Vue.',
    ],
    doNotUseFor: [
      'Do not treat it as a model request library.',
      'Do not embed provider request logic inside the component.',
      'Do not put credentials, secrets or tokens in component props.',
      'Do not import the real @revolist/revogrid implementation in adapter templates.',
      'Do not replace the built-in data-grid with RevoGrid for simple cases.',
    ],
    examples: [
      {
        title: 'React package usage',
        description:
          'Use the generated RevoGrid adapter wrapper from the advanced package in React applications.',
      },
      {
        title: 'Native Web Component usage',
        description:
          'Use the auto entry when the host application is not React or Vue.',
      },
    ],
    promptHints: [
      'Use revogrid-adapter when generating a table that bridges to RevoGrid, and leave <revo-grid> registration to the application.',
      'Use the Data Grid model for columns, rows, sorting and selection to keep adapter behavior consistent.',
      'Continue to use data-grid for lightweight cases.',
      'Keep business request logic in the application layer.',
      'Do not import the real @revolist/revogrid implementation in revogrid-adapter templates.',
    ],
  },
  'agent-console': {
    summary:
      'Headless agent console foundation for messages, tool calls, artifacts, diagnostics and local status state.',
    whenToUse: [
      'Use it when building an AI assistant console UI.',
      'Use it when a local state model is needed for messages, tool calls, artifacts and diagnostics.',
      'Use it before adding a real provider adapter.',
    ],
    doNotUseFor: [
      'Do not treat it as a model request library.',
      'Do not use it as a direct OpenAI, Anthropic or DeepSeek client.',
      'Do not use it when only a basic chat transcript is needed.',
      'Do not put API keys or network transport inside templates.',
    ],
    examples: [
      {
        title: 'React package usage',
        description:
          'Use the generated Agent Console wrapper from the advanced package.',
      },
    ],
    promptHints: [
      'Keep business request logic in the application layer.',
      'Generate local UI only.',
      'Do not add fetch, WebSocket, EventSource or provider SDK usage.',
      'Use appendMessage, startToolCall and addArtifact methods for local state transitions.',
    ],
  },
}

const chineseAdvancedDocs: Record<string, AdvancedDocsTranslation> = {
  chat: {
    summary:
      '使用 @zeus-web/chat 构建无样式约束的 ChatGPT 风格聊天界面，并复用 Web Component 及轻量 React/Vue 包装器。',
    whenToUse: [
      '构建 AI 聊天、智能体控制台或对话式助手界面。',
      '在原生 Web Component、React 和 Vue 中复用同一套聊天行为协议。',
      '在保持产品样式自由的同时复用结构、事件、方法和无障碍语义。',
    ],
    doNotUseFor: [
      '不要把它当作模型请求库。',
      '不要在组件内部嵌入服务提供方请求逻辑。',
      '不要把凭据、密钥或令牌放进组件属性。',
      '当前阶段不要依赖 Markdown 解析、代码高亮或文件上传传输层。',
    ],
    examples: [
      {
        title: '原生 Web Component 用法',
        description:
          '使用自动注册入口，并通过普通 DOM 组合聊天、会话、消息和输入区域。',
      },
      {
        title: 'React 包装器用法',
        description: '宿主应用使用 React 时，请使用生成的 React 包装器。',
      },
    ],
    promptHints: [
      '生成聊天界面时组合使用 zw-chat、zw-chat-thread、zw-chat-message 和 zw-chat-composer。',
      '代码内容使用 zw-chat-code-block；不要把代码高亮库放进聊天根组件。',
      '产物或画布区域使用 zw-chat-artifact 的对应插槽。',
      '使用 zw-chat-tool-call 展示工具调用。',
      '业务请求逻辑应保留在应用层。',
    ],
  },
  virtual: {
    summary:
      '使用 @zeus-web/virtual 为大型列表和更高层 Zeus Web 组件提供无样式约束的单轴虚拟化基础。',
    whenToUse: [
      '渲染大型动态流、日志、时间线或其他一维集合，而无需挂载全部项目。',
      '构建需要复用范围计算、尺寸测量和滚动对齐能力的高级组件。',
      '通过明确的预渲染范围和命令式导航支持纵向或横向虚拟滚动。',
    ],
    doNotUseFor: [
      '不要把此软件包当作模型请求库。',
      '不要期待 zw-virtual-list 渲染项目内容；项目渲染器由应用负责。',
      '小型集合直接渲染全部项目更简单且开销很低，不需要使用它。',
      '行列均需虚拟化时，不要用单轴列表替代 @zeus-web/data-grid。',
      '不要在虚拟化器内部加入网络请求、凭据或服务提供方专用传输。',
    ],
    examples: [
      {
        title: '核心虚拟化器用法',
        description: '构建更高层组件时使用与框架无关的核心引擎。',
      },
      {
        title: '原生 Web Component 用法',
        description: '监听范围变化，仅渲染无样式列表提供的项目。',
      },
      {
        title: 'React 包装器用法',
        description: '使用生成的包装器，并在应用状态中保存可见项目。',
      },
    ],
    promptHints: [
      'zw-virtual-list 不渲染项目节点；处理 range-change 或调用 getItems() 获取当前虚拟项目。',
      '仅渲染返回的项目，并使用每项的 start 和 size 值进行定位。',
      '为视口设置有限尺寸和 overflow，使组件可以测量有效的可见范围。',
      '命令式导航使用 scrollToIndex，并选择 start、center 或 end 对齐。',
      '实现更高层 Zeus Web 组件时可直接使用 createVirtualizer。',
      '业务请求逻辑应保留在应用层。',
    ],
  },
  'data-grid': {
    summary:
      '使用 @zeus-web/data-grid 构建无样式约束的数据网格，提供二维虚拟化、行列模型、选择和排序。',
    whenToUse: [
      '展示结构化表格数据。',
      '需要轻量 Data Grid，而不是 AG Grid 级完整表格系统。',
      '在原生 Web Component、React 和 Vue 中复用同一套 Data Grid 行为协议。',
      '使用二维虚拟滚动、单列排序以及单选或多选。',
    ],
    doNotUseFor: [
      '不要把它当作服务端数据源。',
      '不要在组件内部编写真正的请求逻辑。',
      '不要把它当作模型请求库。',
      '不要把鉴权信息、密钥或令牌放进组件属性。',
      '当前阶段不要依赖过滤器、树表、分组或单元格编辑器。',
    ],
    examples: [
      {
        title: 'React 软件包用法',
        description: '在 React 应用中使用高级组件包生成的 Data Grid 包装器。',
      },
      {
        title: '原生 Web Component 用法',
        description: '宿主应用不使用 React 或 Vue 时，请使用自动注册入口。',
      },
    ],
    promptHints: [
      '生成结构化数据表格时优先使用 data-grid，而不是手写复杂的 div 表格。',
      '渲染大量行时启用 virtual。',
      '需要选择行时设置 selectionMode="single" 或 selectionMode="multiple"。',
      '需要排序时在列上设置 sortable: true。',
      '业务请求逻辑应保留在应用层。',
      '不要在 data-grid 中生成服务提供方、鉴权、远程请求或服务端数据源逻辑。',
    ],
  },
  'revogrid-adapter': {
    summary:
      '使用 @zeus-web/revogrid-adapter 将 Zeus Data Grid 的行、列、排序和选择状态映射到 <revo-grid> 自定义元素，同时不捆绑 RevoGrid 本身。',
    whenToUse: [
      '应用已注册真正的 <revo-grid> 实现，并需要接入 Data Grid 模型。',
      '将现有 Data Grid 数据源桥接到 RevoGrid 兼容的表格组件。',
      '在原生 Web Component、React 和 Vue 中复用同一套适配器行为协议。',
    ],
    doNotUseFor: [
      '不要把它当作模型请求库。',
      '不要在组件内部嵌入服务提供方请求逻辑。',
      '不要把凭据、密钥或令牌放进组件属性。',
      '不要在适配器模板中导入真正的 @revolist/revogrid 实现。',
      '简单场景不要用 RevoGrid 替代内置 data-grid。',
    ],
    examples: [
      {
        title: 'React 软件包用法',
        description:
          '在 React 应用中使用高级组件包生成的 RevoGrid 适配器包装器。',
      },
      {
        title: '原生 Web Component 用法',
        description: '宿主应用不使用 React 或 Vue 时，请使用自动注册入口。',
      },
    ],
    promptHints: [
      '生成需要桥接 RevoGrid 的表格时使用 revogrid-adapter，并由应用负责注册 <revo-grid>。',
      '通过 Data Grid 模型管理列、行、排序和选择，以保持适配器行为一致。',
      '轻量场景继续使用 data-grid。',
      '业务请求逻辑应保留在应用层。',
      '不要在 revogrid-adapter 模板中导入真正的 @revolist/revogrid 实现。',
    ],
  },
  'agent-console': {
    summary:
      '面向消息、工具调用、产物、诊断和本地状态的无样式智能体控制台基础。',
    whenToUse: [
      '构建 AI 助手控制台界面。',
      '需要管理消息、工具调用、产物和诊断的本地状态模型。',
      '在接入真正的服务提供方适配器之前使用。',
    ],
    doNotUseFor: [
      '不要把它当作模型请求库。',
      '不要把它当作 OpenAI、Anthropic 或 DeepSeek 的直接客户端。',
      '仅需要基础聊天记录时不要使用它。',
      '不要把 API 密钥或网络传输放入模板。',
    ],
    examples: [
      {
        title: 'React 软件包用法',
        description: '使用高级组件包生成的 Agent Console 包装器。',
      },
    ],
    promptHints: [
      '业务请求逻辑应保留在应用层。',
      '只生成本地界面。',
      '不要添加 fetch、WebSocket、EventSource 或服务提供方 SDK。',
      '使用 appendMessage、startToolCall 和 addArtifact 方法处理本地状态转换。',
    ],
  },
}

const chineseRecommendedWorkflow: Record<string, string> = {
  'Run `zweb init` before adding registry-backed styled components.':
    '添加由 Registry 支持的样式化组件之前，先运行 `zweb init`。',
  'Run `zweb add button input` to copy currently available registry source into the user project.':
    '运行 `zweb add button input`，将当前可用的 Registry 源码复制到项目中。',
  'Import styled components from the copied local path, usually `@/components/ui/<component>`.':
    '从复制后的本地路径导入样式化组件，通常是 `@/components/ui/<component>`。',
  'Use `@zeus-web/ui` for package-owned styled native Web Components.':
    '需要软件包提供的样式化原生 Web Components 时，使用 `@zeus-web/ui`。',
  'Use per-component packages such as `@zeus-web/button/react` when building advanced primitive-based design systems.':
    '构建基于基础组件的高级设计系统时，使用 `@zeus-web/button/react` 等单组件软件包。',
}

export function getComponentDocsMessages(
  locale: DocsLocale,
): ComponentDocsMessages {
  return locale === 'zh' ? chineseMessages : englishMessages
}

export function translatePrimitiveDocsText(
  text: string,
  locale: DocsLocale,
): string {
  if (locale === 'en') return text

  const translated = chineseMetadataText[text]

  if (!translated) {
    throw new Error(`Missing Chinese primitive documentation for "${text}".`)
  }

  return translated
}

export function translateRecommendedWorkflow(
  text: string,
  locale: DocsLocale,
): string {
  if (locale === 'en') return text

  const translated = chineseRecommendedWorkflow[text]

  if (!translated) {
    throw new Error(
      `Missing Chinese recommended workflow documentation for "${text}".`,
    )
  }

  return translated
}

export function getAdvancedDocsTranslation(
  componentName: string,
  locale: DocsLocale,
): AdvancedDocsTranslation {
  const translations =
    locale === 'zh' ? chineseAdvancedDocs : englishAdvancedDocs
  const translated = translations[componentName]

  if (!translated) {
    throw new Error(
      `Missing ${locale} advanced component documentation for "${componentName}".`,
    )
  }

  return translated
}

export function normalizeAdvancedExampleCode(code: string): string {
  return code
    .replace('emptyText="暂无消息"', 'emptyText="No messages"')
    .replace('placeholder="输入消息..."', 'placeholder="Type a message..."')
}
