/**
 * User-facing strings (01-ARCHITECTURE §14 "Localization"). Every primitive
 * takes its text from an `AiLocale`; the host supplies translations and its
 * own date / number formatting. Defaults are English.
 */

import type {
  ApprovalRisk,
  ApprovalScope,
  ApprovalStatus,
  ChangeSetStatus,
  ExecutionStatus,
  StepStatus,
  ToolInvocationStatus,
} from '@zeus-web/ai-core'

export interface AiLocale {
  composerLabel: string
  send: string
  sending: string
  removeAttachment: (name: string) => string
  uploading: (name: string) => string
  attachmentsLabel: string
  composerBlocked: Readonly<Record<string, string>>
  jumpToLatest: (unread: number) => string
  messageFrom: (author: string) => string
  copy: string
  copied: string
  regenerate: string
  edit: string
  previousBranch: string
  nextBranch: string
  branchPosition: (index: number, total: number) => string
  executionStatus: Readonly<Record<ExecutionStatus, string>>
  executionPending: Readonly<Record<string, string>>
  executionAction: Readonly<Record<string, string>>
  stepStatus: Readonly<Record<StepStatus, string>>
  toolStatus: Readonly<Record<ToolInvocationStatus, string>>
  showDetails: string
  hideDetails: string
  approvalTitle: string
  approvalFieldAction: string
  approvalFieldTarget: string
  approvalFieldScope: string
  approvalFieldRisk: string
  approvalFieldExpires: string
  approvalFieldDetails: string
  approvalStatus: Readonly<Record<ApprovalStatus, string>>
  approvalScope: Readonly<Record<ApprovalScope, string>>
  approvalRisk: Readonly<Record<ApprovalRisk, string>>
  approve: string
  reject: string
  expiresAt: (when: string) => string
  confirmPhrase: (phrase: string) => string
  changeSetStatus: Readonly<Record<ChangeSetStatus, string>>
  changeSetAction: Readonly<Record<string, string>>
  fileTreeLabel: string
  diffLabel: (path: string) => string
  diffTruncated: string
  hunkReviewed: string
  addComment: string
  submitComment: string
  commentOutdated: string
  testSummary: (passed: number, failed: number, skipped: number) => string
  runSwitcherLabel: string
  unread: (count: number) => string
  pendingApprovals: (count: number) => string
  citationsLabel: string
  sourceUnavailable: string
  artifactsLabel: string
  previewBlocked: string
  previewLoading: string
  previewFailed: string
  contextPickerLabel: string
  noSuggestions: string
  workspaceLabel: string
  conversationListLabel: string
  stepsLabel: string
  generatingResponse: string
  artifactPreviewLabel: string
  formatTime: (iso: string) => string
}

export const EN_LOCALE: AiLocale = {
  composerLabel: 'Message',
  send: 'Send',
  sending: 'Sending…',
  removeAttachment: name => `Remove ${name}`,
  uploading: name => `Uploading ${name}`,
  attachmentsLabel: 'Attachments',
  composerBlocked: {
    empty: 'Type a message to send',
    composing: 'Finish the input method composition first',
    uploading: 'Wait for attachments to finish uploading',
    'upload-failed': 'Remove or retry the failed attachment',
    submitting: 'Sending…',
  },
  jumpToLatest: unread =>
    unread > 0 ? `Jump to latest (${unread} new)` : 'Jump to latest',
  messageFrom: author => `Message from ${author}`,
  copy: 'Copy',
  copied: 'Copied',
  regenerate: 'Regenerate',
  edit: 'Edit',
  previousBranch: 'Previous version',
  nextBranch: 'Next version',
  branchPosition: (index, total) => `Version ${index + 1} of ${total}`,
  executionStatus: {
    queued: 'Queued',
    running: 'Running',
    'awaiting-approval': 'Waiting for your approval',
    paused: 'Paused',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  },
  executionPending: {
    cancel: 'Stop requested',
    pause: 'Pause requested',
    resume: 'Resume requested',
    retry: 'Retry requested',
  },
  executionAction: {
    cancel: 'Stop',
    pause: 'Pause',
    resume: 'Resume',
    retry: 'Retry',
  },
  stepStatus: {
    pending: 'Pending',
    running: 'Running',
    completed: 'Done',
    failed: 'Failed',
    cancelled: 'Cancelled',
  },
  toolStatus: {
    requested: 'Requested',
    running: 'Running',
    succeeded: 'Succeeded',
    failed: 'Failed',
    cancelled: 'Cancelled',
  },
  showDetails: 'Show details',
  hideDetails: 'Hide details',
  approvalTitle: 'Approval required',
  approvalFieldAction: 'Action',
  approvalFieldTarget: 'Target',
  approvalFieldScope: 'Scope',
  approvalFieldRisk: 'Risk',
  approvalFieldExpires: 'Expires',
  approvalFieldDetails: 'Details',
  approvalStatus: {
    pending: 'Waiting for decision',
    submitted: 'Decision sent, waiting for confirmation',
    approved: 'Approved',
    rejected: 'Rejected',
    expired: 'Expired',
    revoked: 'Revoked',
  },
  approvalScope: {
    once: 'This one time only',
    session: 'For this session',
    workspace: 'For this whole workspace',
  },
  approvalRisk: { low: 'Low risk', medium: 'Medium risk', high: 'High risk' },
  approve: 'Approve',
  reject: 'Reject',
  expiresAt: when => `Expires ${when}`,
  confirmPhrase: phrase => `Type "${phrase}" to confirm`,
  changeSetStatus: {
    draft: 'Draft',
    ready: 'Ready to apply',
    applying: 'Applying…',
    applied: 'Applied',
    rejected: 'Discarded',
    conflicted: 'Conflicts with the current base',
  },
  changeSetAction: {
    apply: 'Apply changes',
    discard: 'Discard',
    rebase: 'Rebase onto current base',
  },
  fileTreeLabel: 'Changed files',
  diffLabel: path => `Changes in ${path}`,
  diffTruncated: 'Diff truncated; open the full file to see the rest.',
  hunkReviewed: 'Reviewed',
  addComment: 'Add comment',
  submitComment: 'Submit',
  commentOutdated: 'This comment may be outdated: the code changed',
  testSummary: (passed, failed, skipped) =>
    `${passed} passed, ${failed} failed, ${skipped} skipped`,
  runSwitcherLabel: 'Runs',
  unread: count => `${count} new`,
  pendingApprovals: count => `${count} awaiting approval`,
  citationsLabel: 'Sources',
  sourceUnavailable: 'Source unavailable',
  artifactsLabel: 'Artifacts',
  previewBlocked:
    'Preview not available for this file type; download it instead',
  previewLoading: 'Loading preview…',
  previewFailed: 'Preview failed to load',
  contextPickerLabel: 'Add context',
  noSuggestions: 'No matches',
  workspaceLabel: 'Workspace',
  conversationListLabel: 'Conversations',
  stepsLabel: 'Steps',
  generatingResponse: 'Generating response',
  artifactPreviewLabel: 'Artifact preview',
  formatTime: iso => iso,
}

/**
 * Simplified Chinese. Same shape as {@link EN_LOCALE}; only user-facing copy is
 * translated. Model names, provider ids, error codes and payloads never live
 * here, and `formatTime` stays a pass-through so hosts keep control of date
 * formatting in both languages.
 */
export const ZH_CN_LOCALE: AiLocale = {
  composerLabel: '消息',
  send: '发送',
  sending: '发送中…',
  removeAttachment: name => `移除 ${name}`,
  uploading: name => `正在上传 ${name}`,
  attachmentsLabel: '附件',
  composerBlocked: {
    empty: '输入消息后再发送',
    composing: '请先完成输入法组合',
    uploading: '请等待附件上传完成',
    'upload-failed': '移除或重试失败的附件',
    submitting: '发送中…',
  },
  jumpToLatest: unread =>
    unread > 0 ? `跳到最新（${unread} 条新消息）` : '跳到最新',
  messageFrom: author => `来自 ${author} 的消息`,
  copy: '复制',
  copied: '已复制',
  regenerate: '重新生成',
  edit: '编辑',
  previousBranch: '上一版本',
  nextBranch: '下一版本',
  branchPosition: (index, total) => `第 ${index + 1} 版，共 ${total} 版`,
  executionStatus: {
    queued: '排队中',
    running: '运行中',
    'awaiting-approval': '等待你的批准',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  },
  executionPending: {
    cancel: '已请求停止',
    pause: '已请求暂停',
    resume: '已请求继续',
    retry: '已请求重试',
  },
  executionAction: {
    cancel: '停止',
    pause: '暂停',
    resume: '继续',
    retry: '重试',
  },
  stepStatus: {
    pending: '待处理',
    running: '运行中',
    completed: '完成',
    failed: '失败',
    cancelled: '已取消',
  },
  toolStatus: {
    requested: '已请求',
    running: '运行中',
    succeeded: '成功',
    failed: '失败',
    cancelled: '已取消',
  },
  showDetails: '显示详情',
  hideDetails: '隐藏详情',
  approvalTitle: '需要批准',
  approvalFieldAction: '操作',
  approvalFieldTarget: '目标',
  approvalFieldScope: '范围',
  approvalFieldRisk: '风险',
  approvalFieldExpires: '过期时间',
  approvalFieldDetails: '详情',
  approvalStatus: {
    pending: '等待决定',
    submitted: '决定已发送，等待确认',
    approved: '已批准',
    rejected: '已拒绝',
    expired: '已过期',
    revoked: '已撤销',
  },
  approvalScope: {
    once: '仅这一次',
    session: '本次会话内',
    workspace: '整个工作区',
  },
  approvalRisk: { low: '低风险', medium: '中风险', high: '高风险' },
  approve: '批准',
  reject: '拒绝',
  expiresAt: when => `过期时间 ${when}`,
  confirmPhrase: phrase => `输入“${phrase}”以确认`,
  changeSetStatus: {
    draft: '草稿',
    ready: '可应用',
    applying: '应用中…',
    applied: '已应用',
    rejected: '已丢弃',
    conflicted: '与当前基线冲突',
  },
  changeSetAction: {
    apply: '应用更改',
    discard: '丢弃',
    rebase: '变基到当前基线',
  },
  fileTreeLabel: '更改的文件',
  diffLabel: path => `${path} 的更改`,
  diffTruncated: 'diff 已截断；打开完整文件查看其余内容。',
  hunkReviewed: '已审阅',
  addComment: '添加评论',
  submitComment: '提交',
  commentOutdated: '该评论可能已过时：代码已变更',
  testSummary: (passed, failed, skipped) =>
    `${passed} 通过，${failed} 失败，${skipped} 跳过`,
  runSwitcherLabel: '运行',
  unread: count => `${count} 条新消息`,
  pendingApprovals: count => `${count} 项等待批准`,
  citationsLabel: '来源',
  sourceUnavailable: '来源不可用',
  artifactsLabel: '产物',
  previewBlocked: '此文件类型无法预览，请下载后查看',
  previewLoading: '正在加载预览…',
  previewFailed: '预览加载失败',
  contextPickerLabel: '添加上下文',
  noSuggestions: '没有匹配项',
  workspaceLabel: '工作区',
  conversationListLabel: '会话',
  stepsLabel: '步骤',
  generatingResponse: '正在生成回复',
  artifactPreviewLabel: '产物预览',
  formatTime: iso => iso,
}

export function createLocale(overrides: Partial<AiLocale> = {}): AiLocale {
  return { ...EN_LOCALE, ...overrides }
}
