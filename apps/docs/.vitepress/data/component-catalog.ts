import type { DocsLocale } from './docs-i18n'
import { defaultDocsLocale, getDocsLocale } from './docs-i18n'

export type ComponentPackageGroup = 'primitives' | 'advanced'

export const componentCategoryIds = [
  'general',
  'layout',
  'navigation',
  'data-entry',
  'data-display',
  'feedback',
  'advanced',
] as const

export type ComponentCategory = (typeof componentCategoryIds)[number]

export interface ComponentCategoryDefinition {
  id: ComponentCategory
  label: string
  description: string
}

interface ComponentIdentityDefinition {
  name: string
  packageName: `@zeus-web/${string}`
  packageGroup: ComponentPackageGroup
  category: ComponentCategory
}

export const componentIdentities = [
  {
    name: 'button',
    packageName: '@zeus-web/button',
    packageGroup: 'primitives',
    category: 'general',
  },
  {
    name: 'separator',
    packageName: '@zeus-web/separator',
    packageGroup: 'primitives',
    category: 'layout',
  },
  {
    name: 'tabs',
    packageName: '@zeus-web/tabs',
    packageGroup: 'primitives',
    category: 'navigation',
  },
  {
    name: 'label',
    packageName: '@zeus-web/label',
    packageGroup: 'primitives',
    category: 'data-entry',
  },
  {
    name: 'input',
    packageName: '@zeus-web/input',
    packageGroup: 'primitives',
    category: 'data-entry',
  },
  {
    name: 'textarea',
    packageName: '@zeus-web/textarea',
    packageGroup: 'primitives',
    category: 'data-entry',
  },
  {
    name: 'checkbox',
    packageName: '@zeus-web/checkbox',
    packageGroup: 'primitives',
    category: 'data-entry',
  },
  {
    name: 'radio-group',
    packageName: '@zeus-web/radio-group',
    packageGroup: 'primitives',
    category: 'data-entry',
  },
  {
    name: 'select',
    packageName: '@zeus-web/select',
    packageGroup: 'primitives',
    category: 'data-entry',
  },
  {
    name: 'switch',
    packageName: '@zeus-web/switch',
    packageGroup: 'primitives',
    category: 'data-entry',
  },
  {
    name: 'avatar',
    packageName: '@zeus-web/avatar',
    packageGroup: 'primitives',
    category: 'data-display',
  },
  {
    name: 'badge',
    packageName: '@zeus-web/badge',
    packageGroup: 'primitives',
    category: 'data-display',
  },
  {
    name: 'card',
    packageName: '@zeus-web/card',
    packageGroup: 'primitives',
    category: 'data-display',
  },
  {
    name: 'accordion',
    packageName: '@zeus-web/accordion',
    packageGroup: 'primitives',
    category: 'data-display',
  },
  {
    name: 'collapsible',
    packageName: '@zeus-web/collapsible',
    packageGroup: 'primitives',
    category: 'data-display',
  },
  {
    name: 'tooltip',
    packageName: '@zeus-web/tooltip',
    packageGroup: 'primitives',
    category: 'data-display',
  },
  {
    name: 'alert',
    packageName: '@zeus-web/alert',
    packageGroup: 'primitives',
    category: 'feedback',
  },
  {
    name: 'dialog',
    packageName: '@zeus-web/dialog',
    packageGroup: 'primitives',
    category: 'feedback',
  },
  {
    name: 'progress',
    packageName: '@zeus-web/progress',
    packageGroup: 'primitives',
    category: 'feedback',
  },
  {
    name: 'skeleton',
    packageName: '@zeus-web/skeleton',
    packageGroup: 'primitives',
    category: 'feedback',
  },
  {
    name: 'agent-console',
    packageName: '@zeus-web/agent-console',
    packageGroup: 'advanced',
    category: 'advanced',
  },
  {
    name: 'chat',
    packageName: '@zeus-web/chat',
    packageGroup: 'advanced',
    category: 'advanced',
  },
  {
    name: 'data-grid',
    packageName: '@zeus-web/data-grid',
    packageGroup: 'advanced',
    category: 'advanced',
  },
  {
    name: 'revogrid-adapter',
    packageName: '@zeus-web/revogrid-adapter',
    packageGroup: 'advanced',
    category: 'advanced',
  },
  {
    name: 'virtual',
    packageName: '@zeus-web/virtual',
    packageGroup: 'advanced',
    category: 'advanced',
  },
] as const satisfies readonly ComponentIdentityDefinition[]

export type ComponentName = (typeof componentIdentities)[number]['name']

export interface ComponentIdentity {
  name: ComponentName
  packageName: `@zeus-web/${string}`
  packageGroup: ComponentPackageGroup
  category: ComponentCategory
}

interface LocalizedCopy {
  title: string
  description: string
}

const categoryCopyByLocale = {
  en: {
    general: {
      title: 'General',
      description: 'Essential actions and common interface foundations.',
    },
    layout: {
      title: 'Layout',
      description: 'Structure and separate content within an interface.',
    },
    navigation: {
      title: 'Navigation',
      description: 'Help users move between views and content sections.',
    },
    'data-entry': {
      title: 'Data Entry',
      description: 'Collect, select and edit values from users.',
    },
    'data-display': {
      title: 'Data Display',
      description:
        'Present structured content, identity and supporting details.',
    },
    feedback: {
      title: 'Feedback',
      description: 'Communicate status, progress and important outcomes.',
    },
    advanced: {
      title: 'Advanced',
      description: 'High-volume and application-level interaction foundations.',
    },
  },
  zh: {
    general: {
      title: '通用',
      description: '用于核心操作与常见界面场景的基础组件。',
    },
    layout: {
      title: '布局',
      description: '用于组织界面结构和分隔内容。',
    },
    navigation: {
      title: '导航',
      description: '帮助用户在视图和内容区域之间切换。',
    },
    'data-entry': {
      title: '数据录入',
      description: '用于采集、选择和编辑用户输入。',
    },
    'data-display': {
      title: '数据展示',
      description: '用于展示结构化内容、身份信息和辅助详情。',
    },
    feedback: {
      title: '反馈',
      description: '用于传达状态、进度和重要结果。',
    },
    advanced: {
      title: '高级组件',
      description: '面向大数据量和应用级交互场景的高级基础能力。',
    },
  },
} as const satisfies Record<
  DocsLocale,
  Record<ComponentCategory, LocalizedCopy>
>

const componentCopyByLocale = {
  en: {
    button: {
      title: 'Button',
      description: 'Actions, variants, sizes and disabled states.',
    },
    separator: {
      title: 'Separator',
      description: 'Visual and semantic content separation.',
    },
    tabs: {
      title: 'Tabs',
      description: 'Keyboard-accessible tab lists and panels.',
    },
    label: {
      title: 'Label',
      description: 'Accessible labels for form controls.',
    },
    input: {
      title: 'Input',
      description: 'Text entry, placeholders and validation states.',
    },
    textarea: {
      title: 'Textarea',
      description: 'Multi-line text input and validation states.',
    },
    checkbox: {
      title: 'Checkbox',
      description: 'Boolean and indeterminate selection states.',
    },
    'radio-group': {
      title: 'Radio Group',
      description: 'Single-choice groups with keyboard navigation.',
    },
    select: {
      title: 'Select',
      description: 'Accessible popup selection with keyboard typeahead.',
    },
    switch: {
      title: 'Switch',
      description: 'On and off controls for application settings.',
    },
    avatar: {
      title: 'Avatar',
      description: 'User images with accessible fallback content.',
    },
    badge: {
      title: 'Badge',
      description: 'Compact labels for states and categories.',
    },
    card: {
      title: 'Card',
      description: 'Structured surfaces for grouped content.',
    },
    accordion: {
      title: 'Accordion',
      description: 'Grouped disclosure sections and keyboard control.',
    },
    collapsible: {
      title: 'Collapsible',
      description: 'Expandable regions for progressive disclosure.',
    },
    tooltip: {
      title: 'Tooltip',
      description: 'Contextual help on pointer hover and keyboard focus.',
    },
    alert: {
      title: 'Alert',
      description: 'Inline contextual feedback and status messages.',
    },
    dialog: {
      title: 'Dialog',
      description: 'Modal content, focus management and dismissal.',
    },
    progress: {
      title: 'Progress',
      description: 'Progress indicators for known completion values.',
    },
    skeleton: {
      title: 'Skeleton',
      description: 'Loading placeholders for common layouts.',
    },
    'agent-console': {
      title: 'Agent Console',
      description:
        'Messages, tool calls, artifacts and diagnostics for agents.',
    },
    chat: {
      title: 'Chat',
      description: 'Composable chat threads, messages and input.',
    },
    'data-grid': {
      title: 'Data Grid',
      description: 'Two-axis virtualization for high-volume tabular data.',
    },
    'revogrid-adapter': {
      title: 'RevoGrid Adapter',
      description: 'RevoGrid-compatible mapping for Zeus grid models.',
    },
    virtual: {
      title: 'Virtual List',
      description: 'Low-level virtual scrolling for high-volume lists.',
    },
  },
  zh: {
    button: {
      title: '按钮',
      description: '支持多种样式、尺寸与禁用状态的操作按钮。',
    },
    separator: {
      title: '分隔线',
      description: '在视觉和语义上分隔内容。',
    },
    tabs: {
      title: '标签页',
      description: '支持键盘访问的标签列表与内容面板。',
    },
    label: {
      title: '标签',
      description: '为表单控件提供无障碍标签。',
    },
    input: {
      title: '输入框',
      description: '支持文本输入、占位提示与校验状态。',
    },
    textarea: {
      title: '文本域',
      description: '支持多行文本输入与校验状态。',
    },
    checkbox: {
      title: '复选框',
      description: '支持布尔值和不确定状态的选择控件。',
    },
    'radio-group': {
      title: '单选框组',
      description: '支持键盘导航的单项选择控件组。',
    },
    select: {
      title: '选择器',
      description: '支持键盘预输入与无障碍语义的自绘下拉选择器。',
    },
    switch: {
      title: '开关',
      description: '用于应用设置的开启与关闭控件。',
    },
    avatar: {
      title: '头像',
      description: '支持无障碍后备内容的用户头像。',
    },
    badge: {
      title: '徽标',
      description: '用于状态和分类的紧凑标签。',
    },
    card: {
      title: '卡片',
      description: '用于组织成组内容的结构化容器。',
    },
    accordion: {
      title: '手风琴',
      description: '支持键盘操作的分组展开内容。',
    },
    collapsible: {
      title: '折叠面板',
      description: '用于渐进式展示内容的可展开区域。',
    },
    tooltip: {
      title: '文字提示',
      description: '在指针悬停或键盘聚焦时提供上下文帮助。',
    },
    alert: {
      title: '警告提示',
      description: '用于展示上下文反馈和状态消息。',
    },
    dialog: {
      title: '对话框',
      description: '支持焦点管理和关闭操作的模态内容。',
    },
    progress: {
      title: '进度条',
      description: '展示已知完成比例的进度状态。',
    },
    skeleton: {
      title: '骨架屏',
      description: '为常见布局提供加载占位。',
    },
    'agent-console': {
      title: '智能体控制台',
      description: '展示智能体消息、工具调用、产物和诊断信息。',
    },
    chat: {
      title: '聊天',
      description: '可组合的聊天线程、消息和输入能力。',
    },
    'data-grid': {
      title: '数据表格',
      description: '面向海量表格数据的双轴虚拟化组件。',
    },
    'revogrid-adapter': {
      title: 'RevoGrid 适配器',
      description: '将 Zeus 网格模型映射为 RevoGrid 兼容接口。',
    },
    virtual: {
      title: '虚拟列表',
      description: '面向海量列表的底层虚拟滚动能力。',
    },
  },
} as const satisfies Record<DocsLocale, Record<ComponentName, LocalizedCopy>>

export interface ComponentCatalogItem extends ComponentIdentity {
  title: string
  route: string
  description: string
}

export function localizeDocsPath(
  path: string,
  locale: DocsLocale = defaultDocsLocale,
): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    return path
  }

  let canonicalPath = path
  if (canonicalPath === '/zh') {
    canonicalPath = '/'
  } else if (canonicalPath.startsWith('/zh/')) {
    canonicalPath = canonicalPath.slice('/zh'.length)
  }

  const localeDefinition = getDocsLocale(locale)
  if (localeDefinition.pathPrefix === '') {
    return canonicalPath
  }

  if (canonicalPath === '/') {
    return `${localeDefinition.pathPrefix}/`
  }

  return `${localeDefinition.pathPrefix}${canonicalPath}`
}

export function getComponentCategories(
  locale: DocsLocale = defaultDocsLocale,
): readonly ComponentCategoryDefinition[] {
  const copy = categoryCopyByLocale[locale]
  return componentCategoryIds.map(id => ({
    id,
    label: copy[id].title,
    description: copy[id].description,
  }))
}

export function getComponentCatalog(
  locale: DocsLocale = defaultDocsLocale,
): readonly ComponentCatalogItem[] {
  const copy = componentCopyByLocale[locale]
  return componentIdentities.map(component => ({
    name: component.name,
    packageName: component.packageName,
    packageGroup: component.packageGroup,
    category: component.category,
    title: copy[component.name].title,
    route: localizeDocsPath(`/components/${component.name}`, locale),
    description: copy[component.name].description,
  }))
}

export const componentCategories = getComponentCategories()

export const componentCatalog = getComponentCatalog()

export function findComponentCatalogItem(
  name: string,
  locale: DocsLocale = defaultDocsLocale,
): ComponentCatalogItem | undefined {
  return getComponentCatalog(locale).find(component => component.name === name)
}
