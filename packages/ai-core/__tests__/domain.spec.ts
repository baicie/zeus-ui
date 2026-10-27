import type { ApprovalStatus, ContentPart, Message } from '../src/domain/types'

import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  APPROVAL_RESOLUTION_SOURCES,
  APPROVAL_TRANSITIONS,
  canResolveApproval,
  canTransitionApproval,
  createApprovalTransitionError,
  isApprovalTerminal,
} from '../src/domain/approval'

import {
  canTransitionExecution,
  EXECUTION_TRANSITIONS,
  isExecutionTerminal,
} from '../src/domain/execution'

describe('approval state machine (AI2-104)', () => {
  it('allows only the declared transitions', () => {
    expect(canTransitionApproval('pending', 'submitted')).toBe(true)
    expect(canTransitionApproval('submitted', 'approved')).toBe(true)
    expect(canTransitionApproval('submitted', 'rejected')).toBe(true)
    expect(canTransitionApproval('approved', 'revoked')).toBe(true)
  })

  it('rejects re-entry into decision states', () => {
    expect(canTransitionApproval('approved', 'pending')).toBe(false)
    expect(canTransitionApproval('approved', 'rejected')).toBe(false)
    expect(canTransitionApproval('rejected', 'approved')).toBe(false)
    expect(canTransitionApproval('expired', 'approved')).toBe(false)
    expect(canTransitionApproval('revoked', 'approved')).toBe(false)
  })

  it('marks rejected, expired and revoked as terminal', () => {
    expect(isApprovalTerminal('rejected')).toBe(true)
    expect(isApprovalTerminal('expired')).toBe(true)
    expect(isApprovalTerminal('revoked')).toBe(true)
    expect(isApprovalTerminal('approved')).toBe(false)
    expect(APPROVAL_TRANSITIONS.approved).toEqual(['revoked'])
  })

  it('builds a typed transition error', () => {
    const error = createApprovalTransitionError('rejected', 'approved')

    expect(error.code).toBe('AI_APPROVAL_ILLEGAL_TRANSITION')
    expect(error.from).toBe('rejected')
    expect(error.to).toBe('approved')
    expect(error.message).toContain('rejected -> approved')
  })

  it('lets the host resolve pending or submitted requests only', () => {
    expect(APPROVAL_RESOLUTION_SOURCES).toEqual(['pending', 'submitted'])
    expect(canResolveApproval('pending', 'approved')).toBe(true)
    expect(canResolveApproval('submitted', 'rejected')).toBe(true)
    expect(canResolveApproval('approved', 'revoked')).toBe(true)
    expect(canResolveApproval('approved', 'rejected')).toBe(false)
    expect(canResolveApproval('rejected', 'approved')).toBe(false)
    expect(canResolveApproval('expired', 'approved')).toBe(false)
  })

  it('keeps the status union exhaustive at the type level', () => {
    expectTypeOf<ApprovalStatus>().toEqualTypeOf<
      'pending' | 'submitted' | 'approved' | 'rejected' | 'expired' | 'revoked'
    >()
  })
})

describe('execution state machine', () => {
  it('never revives a terminal execution', () => {
    expect(canTransitionExecution('queued', 'running')).toBe(true)
    expect(canTransitionExecution('running', 'awaiting-approval')).toBe(true)
    expect(canTransitionExecution('awaiting-approval', 'running')).toBe(true)
    expect(canTransitionExecution('completed', 'running')).toBe(false)
    expect(canTransitionExecution('failed', 'running')).toBe(false)
    expect(canTransitionExecution('cancelled', 'running')).toBe(false)
    expect(isExecutionTerminal('completed')).toBe(true)
    expect(isExecutionTerminal('running')).toBe(false)
    expect(EXECUTION_TRANSITIONS.running).toContain('paused')
  })
})

describe('domain type contracts (AI2-102 / AI2-103)', () => {
  it('keeps message parts a discriminated union', () => {
    const text: ContentPart = {
      id: 'p1',
      kind: 'text',
      revision: 1,
      text: 'hi',
      format: 'markdown',
    }
    const image: ContentPart = {
      id: 'p2',
      kind: 'image',
      asset: { id: 'a1', mimeType: 'image/png' },
    }

    expect(text.kind).toBe('text')
    expect(image.kind).toBe('image')
    expectTypeOf<Message['author']>().toEqualTypeOf<
      'user' | 'assistant' | 'system' | 'tool'
    >()
  })
})
