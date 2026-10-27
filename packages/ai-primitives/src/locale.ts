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
  hunkReviewed: string
  addComment: string
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
  formatTime: (iso: string) => string
}

export const EN_LOCALE: AiLocale = {
  composerLabel: 'Message',
  send: 'Send',
  sending: 'Sending…',
  removeAttachment: name => `Remove ${name}`,
  uploading: name => `Uploading ${name}`,
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
  hunkReviewed: 'Reviewed',
  addComment: 'Add comment',
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
  formatTime: iso => iso,
}

export function createLocale(overrides: Partial<AiLocale> = {}): AiLocale {
  return { ...EN_LOCALE, ...overrides }
}
