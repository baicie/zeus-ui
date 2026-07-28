import type { DocsLocale } from '../../data/docs-i18n'

export interface ComponentPlaygroundMessages {
  previewEyebrow: string
  themeLabel: string
  lightTheme: string
  darkTheme: string
  densityLabel: string
  compactDensity: string
  defaultDensity: string
  largeDensity: string
  missingPlayground: (name: string) => string
  loadFailed: (title: string) => string
  loading: (title: string) => string
}

export interface DataGridPlaygroundMessages {
  numberLocale: string
  loadingComponent: string
  measuringViewport: string
  windowRange: (
    rowStart: string,
    rowEnd: string,
    rowCount: string,
    columnStart: string,
    columnEnd: string,
    columnCount: string,
  ) => string
  recordHeader: string
  metricHeader: (index: number) => string
  preparingDataset: string
  gridAriaLabel: string
  datasetReady: (label: string) => string
  datasetFailed: string
  viewportPosition: Record<'first' | 'middle' | 'last', string>
  columnWidthsReset: string
  selectionUpdated: string
  sortUpdated: string
  sortCleared: string
  columnWidthUpdated: string
  activeCellUpdated: string
  activeCellCleared: string
  viewportMoved: string
  componentUnavailable: string
  componentFailed: string
  datasetMetricsLabel: string
  rows: string
  columns: string
  domCells: string
  dataPreparation: string
  controlsLabel: string
  dataset: string
  selectDataset: (label: string) => string
  applyData: string
  rowHeight: string
  rowOverscan: string
  columnOverscan: string
  selection: string
  selectionNone: string
  selectionSingle: string
  selectionMultiple: string
  resizable: string
  keyboard: string
  viewportCommandsLabel: string
  jumpFirst: string
  jumpMiddle: string
  jumpLast: string
  first: string
  middle: string
  last: string
  resetColumnWidths: string
  resetWidths: string
  preparing: (label: string) => string
  window: string
  event: string
}

export const componentPlaygroundMessages = {
  en: {
    previewEyebrow: 'Live Web Component preview',
    themeLabel: 'Theme',
    lightTheme: 'Light',
    darkTheme: 'Dark',
    densityLabel: 'Density',
    compactDensity: 'Compact',
    defaultDensity: 'Default',
    largeDensity: 'Large',
    missingPlayground: name => `No Playground is registered for "${name}".`,
    loadFailed: title => `Unable to load ${title}.`,
    loading: title => `Loading ${title}...`,
  },
  zh: {
    previewEyebrow: 'Web Component 实时预览',
    themeLabel: '主题',
    lightTheme: '浅色',
    darkTheme: '深色',
    densityLabel: '密度',
    compactDensity: '紧凑',
    defaultDensity: '默认',
    largeDensity: '宽松',
    missingPlayground: name => `尚未为“${name}”注册交互演示。`,
    loadFailed: title => `无法加载${title}。`,
    loading: title => `正在加载${title}……`,
  },
} satisfies Record<DocsLocale, ComponentPlaygroundMessages>

export const dataGridPlaygroundMessages = {
  en: {
    numberLocale: 'en-US',
    loadingComponent: 'Loading component',
    measuringViewport: 'Measuring viewport',
    windowRange: (
      rowStart,
      rowEnd,
      rowCount,
      columnStart,
      columnEnd,
      columnCount,
    ) =>
      `Rows ${rowStart}-${rowEnd} of ${rowCount} | Columns ${columnStart}-${columnEnd} of ${columnCount}`,
    recordHeader: 'Record',
    metricHeader: index => `Metric ${index}`,
    preparingDataset: 'Preparing dataset',
    gridAriaLabel: 'High performance data grid playground',
    datasetReady: label => `${label} ready`,
    datasetFailed: 'Dataset failed to load',
    viewportPosition: {
      first: 'First viewport',
      middle: 'Middle viewport',
      last: 'Last viewport',
    },
    columnWidthsReset: 'Column widths reset',
    selectionUpdated: 'Selection updated',
    sortUpdated: 'Sort updated',
    sortCleared: 'Sort cleared',
    columnWidthUpdated: 'Column width updated',
    activeCellUpdated: 'Active cell updated',
    activeCellCleared: 'Active cell cleared',
    viewportMoved: 'Viewport moved',
    componentUnavailable: 'Data Grid element is unavailable.',
    componentFailed: 'Component failed to load',
    datasetMetricsLabel: 'Dataset metrics',
    rows: 'Rows',
    columns: 'Columns',
    domCells: 'DOM cells',
    dataPreparation: 'Data prep',
    controlsLabel: 'Grid controls',
    dataset: 'Dataset',
    selectDataset: label => `Select ${label}`,
    applyData: 'Apply data',
    rowHeight: 'Row height',
    rowOverscan: 'Row overscan',
    columnOverscan: 'Column overscan',
    selection: 'Selection',
    selectionNone: 'None',
    selectionSingle: 'Single',
    selectionMultiple: 'Multiple',
    resizable: 'Resizable',
    keyboard: 'Keyboard',
    viewportCommandsLabel: 'Viewport commands',
    jumpFirst: 'Jump to first row and column',
    jumpMiddle: 'Jump to middle row and column',
    jumpLast: 'Jump to last row and column',
    first: 'First',
    middle: 'Middle',
    last: 'Last',
    resetColumnWidths: 'Reset column widths',
    resetWidths: 'Reset widths',
    preparing: label => `Preparing ${label}`,
    window: 'Window',
    event: 'Event',
  },
  zh: {
    numberLocale: 'zh-CN',
    loadingComponent: '正在加载组件',
    measuringViewport: '正在测量视口',
    windowRange: (
      rowStart,
      rowEnd,
      rowCount,
      columnStart,
      columnEnd,
      columnCount,
    ) =>
      `第 ${rowStart}-${rowEnd} 行，共 ${rowCount} 行 | 第 ${columnStart}-${columnEnd} 列，共 ${columnCount} 列`,
    recordHeader: '记录',
    metricHeader: index => `指标 ${index}`,
    preparingDataset: '正在准备数据集',
    gridAriaLabel: '高性能数据网格交互演示',
    datasetReady: label => `${label} 已就绪`,
    datasetFailed: '数据集加载失败',
    viewportPosition: {
      first: '已跳转到开头',
      middle: '已跳转到中间',
      last: '已跳转到末尾',
    },
    columnWidthsReset: '列宽已重置',
    selectionUpdated: '选择已更新',
    sortUpdated: '排序已更新',
    sortCleared: '排序已清除',
    columnWidthUpdated: '列宽已更新',
    activeCellUpdated: '活动单元格已更新',
    activeCellCleared: '活动单元格已清除',
    viewportMoved: '视口已移动',
    componentUnavailable: '数据网格元素不可用。',
    componentFailed: '组件加载失败',
    datasetMetricsLabel: '数据集指标',
    rows: '行',
    columns: '列',
    domCells: 'DOM 单元格',
    dataPreparation: '数据准备',
    controlsLabel: '网格控制',
    dataset: '数据集',
    selectDataset: label => `选择 ${label}`,
    applyData: '应用数据',
    rowHeight: '行高',
    rowOverscan: '行预渲染',
    columnOverscan: '列预渲染',
    selection: '选择模式',
    selectionNone: '无',
    selectionSingle: '单选',
    selectionMultiple: '多选',
    resizable: '可调整列宽',
    keyboard: '键盘导航',
    viewportCommandsLabel: '视口命令',
    jumpFirst: '跳转到第一行和第一列',
    jumpMiddle: '跳转到中间行和中间列',
    jumpLast: '跳转到最后一行和最后一列',
    first: '开头',
    middle: '中间',
    last: '末尾',
    resetColumnWidths: '重置列宽',
    resetWidths: '重置列宽',
    preparing: label => `正在准备 ${label}`,
    window: '窗口',
    event: '事件',
  },
} satisfies Record<DocsLocale, DataGridPlaygroundMessages>
