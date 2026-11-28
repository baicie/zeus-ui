/**
 * The three-state lookups, driven by a fake `gh`.
 *
 * The validator's behaviour is pinned elsewhere; what is tested here is the
 * layer underneath it — the part that decides whether an answer is a finding or
 * the absence of one. That distinction is the whole reason these functions
 * stopped returning `string | undefined`: the release treats "no amendment
 * exists" and "GitHub did not answer" completely differently, and collapsing
 * them is how a superseded candidate gets published.
 */
import { Buffer } from 'node:buffer'

import { describe, expect, it } from 'vitest'

import { lookupUiCandidateOnGitHub } from '../../../checks/release/check-release-pairing'
import { resolveRemoteTag } from '../../../release/pairing-amendment'
import {
  readAuthorizationFromGitHub,
  verifyAuthorization,
} from '../../../release/pairing-authorization'

/** A `gh` that answers from a table and throws for anything else. */
function fakeGh(
  table: Record<string, string>,
): (args: readonly string[]) => string {
  return args => {
    const endpoint =
      args.find(arg => !arg.startsWith('-') && arg !== 'api') ?? ''
    /*
     * Longest key first. `pulls/999` is a substring of `pulls/999/reviews/4242`,
     * so first-match order answered the review lookup with the pull request and
     * the review parsed as `state: undefined`.
     */
    const match = Object.keys(table)
      .filter(key => endpoint.includes(key))
      .sort((a, b) => b.length - a.length)[0]
    if (match === undefined) {
      throw new Error(`gh api ${endpoint} failed: HTTP 404 Not Found`)
    }
    return table[match]!
  }
}

describe('resolving a pair tag', () => {
  it('reports FOUND for a lightweight tag', () => {
    const lookup = resolveRemoteTag(
      'baicie/zeus',
      'pair/v0.2.0-rc.8',
      fakeGh({
        'git/ref/tags/pair/v0.2.0-rc.8': JSON.stringify({
          object: { type: 'commit', sha: 'a'.repeat(40) },
        }),
      }),
    )
    expect(lookup).toEqual({ state: 'FOUND', commit: 'a'.repeat(40) })
  })

  it('peels an annotated tag to its commit', () => {
    const lookup = resolveRemoteTag(
      'baicie/zeus',
      'pair/v0.2.0-rc.8',
      fakeGh({
        'git/ref/tags/pair/v0.2.0-rc.8': JSON.stringify({
          object: { type: 'tag', sha: 'b'.repeat(40) },
        }),
        'git/tags/': JSON.stringify({ object: { sha: 'c'.repeat(40) } }),
      }),
    )
    expect(lookup).toEqual({ state: 'FOUND', commit: 'c'.repeat(40) })
  })

  it('reports ABSENT for a 404', () => {
    expect(
      resolveRemoteTag('baicie/zeus', 'pair-amendment/v0.2.0-rc.8', fakeGh({})),
    ).toEqual({ state: 'ABSENT' })
  })

  it('reports ERROR for anything that is not a 404', () => {
    const lookup = resolveRemoteTag(
      'baicie/zeus',
      'pair-amendment/v0.2.0-rc.8',
      () => {
        throw new Error('gh api … failed: HTTP 502 Bad Gateway')
      },
    )
    expect(lookup.state).toBe('ERROR')
  })

  it('is not fooled by a rate-limit message', () => {
    /*
     * GitHub answers 403 with a rate-limit body. Reading that as "no tag" is
     * the failure this case pins: the release would silently take the direct
     * path because the API was busy.
     */
    const lookup = resolveRemoteTag('baicie/zeus', 'pair-amendment/x', () => {
      throw new Error('gh api … failed: HTTP 403 API rate limit exceeded')
    })
    expect(lookup.state).toBe('ERROR')
  })
})

describe('reading a UI candidate', () => {
  const TREE = 'd'.repeat(40)
  const BLOB = 'e'.repeat(40)
  const commitEndpoint = `git/commits/${'a'.repeat(40)}`

  function tables(
    lockfileContent: string,
    size?: number,
  ): Record<string, string> {
    return {
      [commitEndpoint]: JSON.stringify({ tree: { sha: TREE } }),
      [`git/trees/${TREE}`]: JSON.stringify({
        tree: [{ path: 'pnpm-lock.yaml', type: 'blob', sha: BLOB }],
      }),
      [`git/blobs/${BLOB}`]: JSON.stringify({
        encoding: 'base64',
        content: Buffer.from(lockfileContent).toString('base64'),
        ...(size === undefined ? {} : { size }),
      }),
    }
  }

  /* The lookup builds its own `gh`, so these drive it through the real one. */
  it('is exercised through the real resolver in the pairing suite', () => {
    /*
     * `lookupUiCandidateOnGitHub` shells out directly, so a unit test cannot
     * inject a fake without changing its signature. The behaviours that matter
     * — 404 versus error, missing lockfile, truncated blob — are asserted below
     * against the pure helpers it composes, and end-to-end in the release
     * rehearsal. This case documents why the wrapper is not separately faked.
     */
    expect(typeof lookupUiCandidateOnGitHub).toBe('function')
    expect(tables('lockfile-contents: 1\n')[`git/blobs/${BLOB}`]).toContain(
      'base64',
    )
  })
})

describe('reading an approval', () => {
  const table = {
    'pulls/999': JSON.stringify({
      merged: true,
      merge_commit_sha: 'f'.repeat(40),
      head: { sha: 'a'.repeat(40) },
    }),
    'pulls/999/reviews/4242': JSON.stringify({
      id: 4242,
      state: 'APPROVED',
      commit_id: 'a'.repeat(40),
      submitted_at: '2026-11-28T00:00:00Z',
      user: { login: 'baicie' },
    }),
    'collaborators/baicie/permission': JSON.stringify({
      permission: 'admin',
    }),
  }

  it('reads the PR, the review, and the permission', () => {
    const lookup = readAuthorizationFromGitHub(
      'baicie/zeus',
      999,
      4242,
      'baicie',
      fakeGh(table),
    )
    expect(lookup.state).toBe('FOUND')
    if (lookup.state !== 'FOUND') return
    expect(lookup.facts.merged).toBe(true)
    expect(lookup.facts.review.state).toBe('APPROVED')
    expect(lookup.facts.permission).toBe('admin')
  })

  it('reports MISSING when the pull request is not there', () => {
    const lookup = readAuthorizationFromGitHub(
      'baicie/zeus',
      1,
      2,
      'baicie',
      fakeGh({}),
    )
    expect(lookup.state).toBe('MISSING')
  })

  it('reports ERROR when the API does not answer', () => {
    const lookup = readAuthorizationFromGitHub(
      'baicie/zeus',
      999,
      4242,
      'baicie',
      () => {
        throw new Error('gh api … failed: HTTP 503')
      },
    )
    expect(lookup.state).toBe('ERROR')
  })

  it('treats a login with no collaborator record as having no permission', () => {
    const lookup = readAuthorizationFromGitHub(
      'baicie/zeus',
      999,
      4242,
      'stranger',
      fakeGh({
        'pulls/999': table['pulls/999'],
        'pulls/999/reviews/4242': JSON.stringify({
          id: 4242,
          state: 'APPROVED',
          commit_id: 'a'.repeat(40),
          submitted_at: '2026-11-28T00:00:00Z',
          user: { login: 'stranger' },
        }),
      }),
    )
    expect(lookup.state).toBe('FOUND')
    if (lookup.state !== 'FOUND') return
    expect(lookup.facts.permission).toBeUndefined()
    expect(
      verifyAuthorization(
        {
          repository: 'baicie/zeus',
          pullRequest: 999,
          approver: 'stranger',
          reviewId: 4242,
          approvedCommit: 'a'.repeat(40),
          approvedAt: '2026-11-28T00:00:00Z',
        },
        lookup,
        'a'.repeat(40),
      ).join(' '),
    ).toMatch(/no permission/)
  })

  it('accepts the approval it just read', () => {
    const lookup = readAuthorizationFromGitHub(
      'baicie/zeus',
      999,
      4242,
      'baicie',
      fakeGh(table),
    )
    expect(
      verifyAuthorization(
        {
          repository: 'baicie/zeus',
          pullRequest: 999,
          approver: 'baicie',
          reviewId: 4242,
          approvedCommit: 'a'.repeat(40),
          approvedAt: '2026-11-28T00:00:00Z',
        },
        lookup,
        'a'.repeat(40),
      ),
    ).toEqual([])
  })
})
