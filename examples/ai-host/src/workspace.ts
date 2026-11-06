import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface WorkspaceRoot {
  readonly id: string
  readonly root: string
  /** Replay/demo only; live workspaces must require an independent approver. */
  readonly allowSelfApproval?: boolean
}

export interface WorkspaceActor {
  readonly userId: string
  readonly role?: string
}

export interface PendingApproval {
  readonly id: string
  readonly executionId: string
  readonly revision: number
  readonly title: string
  readonly summary: string
  readonly workspaceId: string
  readonly requestedBy: string
  readonly createdAt: string
  readonly resolvedBy?: string
  readonly resolvedAt?: string
  readonly files: readonly {
    readonly path: string
    readonly content: string
    readonly previous: string
  }[]
  readonly status: 'pending' | 'approved' | 'rejected' | 'expired'
}

export interface ApprovalOutcome {
  readonly ok: boolean
  readonly code?: string
  readonly message?: string
  readonly status?: 'applied' | 'rejected'
}

export interface ProtectedWorkspace {
  readonly id: string
  readonly displayName: string
  propose: (
    files: readonly { path: string; content: string }[],
    requestedBy?: string,
  ) => PendingApproval
  approve: (
    id: string,
    revision: number,
    approved: boolean,
    approver?: WorkspaceActor,
  ) => Promise<ApprovalOutcome>
  resolve: (
    id: string,
    revision: number,
    decision: 'approved' | 'rejected',
    approver?: WorkspaceActor,
  ) => Promise<ApprovalOutcome>
  pending: () => readonly PendingApproval[]
  snapshot: () => Promise<readonly { path: string; digest: string }[]>
}

const MAX_FILE_BYTES = 128 * 1024
const MAX_FILES = 16
const APPROVAL_FILE = '.zeus-approvals.json'
const MAX_APPROVAL_RECORDS = 1_000

export function createProtectedWorkspace(
  options: WorkspaceRoot,
): ProtectedWorkspace {
  const root = path.resolve(options.root)
  mkdirSync(root, { recursive: true })
  const approvalFile = path.join(root, APPROVAL_FILE)
  const approvals = loadApprovals(approvalFile)
  const allowSelfApproval = options.allowSelfApproval === true

  function safePath(relative: string): string {
    if (
      relative.length === 0 ||
      path.isAbsolute(relative) ||
      relative.includes('\0') ||
      relative.split('/').includes('..')
    ) {
      throw Object.assign(new Error('ZEUS_AI_WORKSPACE_PATH'), {
        code: 'ZEUS_AI_WORKSPACE_PATH',
      })
    }
    const absolute = path.resolve(root, relative)
    if (!absolute.startsWith(`${root}${path.sep}`)) {
      throw Object.assign(new Error('ZEUS_AI_WORKSPACE_ESCAPE'), {
        code: 'ZEUS_AI_WORKSPACE_ESCAPE',
      })
    }
    return absolute
  }

  function persist(): void {
    const values = [...approvals.values()]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(-MAX_APPROVAL_RECORDS)
    const temporary = `${approvalFile}.tmp`
    writeFileSync(temporary, `${JSON.stringify(values, null, 2)}\n`, {
      mode: 0o600,
    })
    renameSync(temporary, approvalFile)
  }

  return {
    id: options.id,
    displayName: path.basename(root),
    propose(files, requestedBy = 'unknown') {
      if (files.length === 0 || files.length > MAX_FILES) {
        throw new Error('ZEUS_AI_WORKSPACE_BATCH')
      }
      for (const file of files) {
        safePath(file.path)
        if (Buffer.byteLength(file.content) > MAX_FILE_BYTES) {
          throw new Error('ZEUS_AI_WORKSPACE_FILE_SIZE')
        }
      }
      const id = `approval-${randomUUID()}`
      const approval: PendingApproval = {
        id,
        executionId: `execution-${randomUUID()}`,
        revision: 1,
        title: 'Apply workspace changes',
        summary: `Write ${files.length} file(s) under ${options.id}`,
        workspaceId: options.id,
        requestedBy,
        createdAt: new Date().toISOString(),
        files: files.map(file => {
          let previous = ''
          try {
            previous = readFileSync(safePath(file.path), 'utf8')
          } catch {
            previous = ''
          }
          return { ...file, previous }
        }),
        status: 'pending',
      }
      approvals.set(id, approval)
      persist()
      return approval
    },
    async approve(id, revision, approved, approver) {
      return this.resolve(
        id,
        revision,
        approved ? 'approved' : 'rejected',
        approver,
      )
    },
    async resolve(id, revision, decision, approver) {
      const approval = approvals.get(id)
      if (!approval) {
        return {
          ok: false,
          code: 'ZEUS_AI_APPROVAL_NOT_FOUND',
          message: 'Approval does not exist.',
        }
      }
      if (approval.status !== 'pending') {
        return {
          ok: false,
          code: 'ZEUS_AI_APPROVAL_RESOLVED',
          message: 'Approval is no longer pending.',
        }
      }
      if (approval.revision !== revision) {
        return {
          ok: false,
          code: 'ZEUS_AI_APPROVAL_STALE',
          message: 'Approval revision is stale.',
        }
      }
      if (!approver || approver.userId.length === 0) {
        return {
          ok: false,
          code: 'ZEUS_AI_APPROVAL_IDENTITY',
          message: 'An authenticated approver is required.',
        }
      }
      if (!allowSelfApproval && approver.userId === approval.requestedBy) {
        return {
          ok: false,
          code: 'ZEUS_AI_APPROVAL_SELF',
          message: 'The proposer cannot approve their own changeset.',
        }
      }
      if (decision === 'rejected') {
        approvals.set(id, {
          ...approval,
          status: 'rejected',
          revision: revision + 1,
          resolvedBy: approver.userId,
          resolvedAt: new Date().toISOString(),
        })
        persist()
        return { ok: true, status: 'rejected' }
      }
      const staged: Array<{ absolute: string; content: string }> = []
      for (const file of approval.files) {
        staged.push({ absolute: safePath(file.path), content: file.content })
      }
      await Promise.all(
        staged.map(async file => {
          await fs.mkdir(path.dirname(file.absolute), { recursive: true })
          await fs.writeFile(file.absolute, file.content, 'utf8')
        }),
      )
      approvals.set(id, {
        ...approval,
        status: 'approved',
        revision: revision + 1,
        resolvedBy: approver.userId,
        resolvedAt: new Date().toISOString(),
      })
      persist()
      return { ok: true, status: 'applied' }
    },
    pending() {
      return [...approvals.values()].filter(item => item.status === 'pending')
    },
    async snapshot() {
      const result: Array<{ path: string; digest: string }> = []
      async function walk(directory: string, prefix: string): Promise<void> {
        for (const entry of await fs.readdir(directory, {
          withFileTypes: true,
        })) {
          if (entry.name.startsWith('.')) continue
          const relative = prefix ? `${prefix}/${entry.name}` : entry.name
          const absolute = path.join(directory, entry.name)
          if (entry.isDirectory()) {
            await walk(absolute, relative)
          } else if (entry.isFile()) {
            const content = await fs.readFile(absolute)
            result.push({
              path: relative,
              digest: createHash('sha256').update(content).digest('hex'),
            })
          }
        }
      }
      await walk(root, '')
      return result.sort((left, right) => left.path.localeCompare(right.path))
    },
  }
}

function loadApprovals(file: string): Map<string, PendingApproval> {
  const approvals = new Map<string, PendingApproval>()
  if (!existsSync(file)) return approvals
  try {
    const value = JSON.parse(readFileSync(file, 'utf8')) as unknown
    if (!Array.isArray(value)) return approvals
    for (const entry of value) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as PendingApproval).id === 'string' &&
        typeof (entry as PendingApproval).revision === 'number' &&
        Array.isArray((entry as PendingApproval).files)
      ) {
        approvals.set((entry as PendingApproval).id, entry as PendingApproval)
      }
    }
  } catch {
    throw new Error('ZEUS_AI_APPROVAL_CORRUPT')
  }
  return approvals
}
