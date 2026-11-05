import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface WorkspaceRoot {
  readonly id: string
  readonly root: string
}

export interface PendingApproval {
  readonly id: string
  readonly executionId: string
  readonly revision: number
  readonly title: string
  readonly summary: string
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
  ) => PendingApproval
  approve: (
    id: string,
    revision: number,
    approved: boolean,
  ) => Promise<ApprovalOutcome>
  resolve: (
    id: string,
    revision: number,
    decision: 'approved' | 'rejected',
  ) => Promise<ApprovalOutcome>
  pending: () => readonly PendingApproval[]
  snapshot: () => Promise<readonly { path: string; digest: string }[]>
}

const MAX_FILE_BYTES = 128 * 1024
const MAX_FILES = 16

export function createProtectedWorkspace(
  options: WorkspaceRoot,
): ProtectedWorkspace {
  const root = path.resolve(options.root)
  fs.mkdir(root, { recursive: true }).catch(() => undefined)
  const approvals = new Map<string, PendingApproval>()
  let approvalCounter = 0

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

  return {
    id: options.id,
    displayName: path.basename(root),
    propose(files) {
      if (files.length === 0 || files.length > MAX_FILES) {
        throw new Error('ZEUS_AI_WORKSPACE_BATCH')
      }
      for (const file of files) {
        safePath(file.path)
        if (Buffer.byteLength(file.content) > MAX_FILE_BYTES) {
          throw new Error('ZEUS_AI_WORKSPACE_FILE_SIZE')
        }
      }
      const id = `approval-${++approvalCounter}`
      const approval: PendingApproval = {
        id,
        executionId: `execution-${approvalCounter}`,
        revision: 1,
        title: 'Apply workspace changes',
        summary: `Write ${files.length} file(s) under ${options.id}`,
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
      return approval
    },
    async approve(id, revision, approved) {
      return this.resolve(id, revision, approved ? 'approved' : 'rejected')
    },
    async resolve(id, revision, decision) {
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
      if (decision === 'rejected') {
        approvals.set(id, {
          ...approval,
          status: 'rejected',
          revision: revision + 1,
        })
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
      })
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
