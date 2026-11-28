/**
 * Who approved a pairing amendment, checked against GitHub rather than trusted.
 *
 * ## The problem this closes
 *
 * An amendment is the weakest of the three pairing modes: it says a published
 * Core release ships with a UI candidate its own tag does not name. The record
 * of that decision therefore has to be a decision — someone with authority read
 * the candidate and the evidence and approved it.
 *
 * The first version recorded `decisionReference: "baicie/zeus#419 + #171"` and
 * `approvedBy`-shaped intent, and checked only that the string was non-empty.
 * Every part of that is writable by the script that writes the amendment:
 *
 * - `#419` and `#171` are the protocol implementation PRs. They approve a
 *   mechanism, not a candidate, and they were merged before the candidate
 *   existed. Citing them as authority for a specific replacement is a category
 *   error that the old check could not see.
 * - A script sets the timestamp, so `approvedAt` records when the file was
 *   generated, not when a human agreed.
 *
 * ## What is required instead
 *
 * The amendment names a pull request and one approving review on it. This
 * module asks GitHub:
 *
 * 1. does that PR exist in that repository, and is it **merged**? (An open PR
 *    approves an intention; a merged one put the bytes on `main`, which is what
 *    the tag will point at.)
 * 2. does the review still exist with that id, and is its state `APPROVED`?
 * 3. did the reviewer have write or admin permission at approval time?
 * 4. is the commit the review approved the same commit the amendment was cut
 *    from? A review submitted against an earlier revision approved different
 *    bytes.
 * 5. is the review's own timestamp the one the amendment records?
 *
 * A script can write a PR number into JSON. It cannot write a review into
 * GitHub's database under someone else's login.
 *
 * ## What this deliberately does not do
 *
 * It does not decide who is a maintainer by a hardcoded list. Permission level
 * is the repository's own answer, so revoking someone's access revokes their
 * ability to authorise a future amendment without editing this file.
 */
import { execFileSync } from 'node:child_process'

export interface AuthorizationClaim {
  readonly repository: string
  readonly pullRequest: number
  readonly approver: string
  readonly reviewId: number
  readonly approvedCommit: string
  readonly approvedAt: string
}

export interface AuthorizationFacts {
  readonly merged: boolean
  readonly mergeCommitSha?: string
  /** The PR's head at the time of this reading. */
  readonly headSha?: string
  readonly review: {
    readonly id: number
    readonly login: string
    readonly state: string
    readonly commitId?: string
    readonly submittedAt?: string
  }
  /** The reviewer's permission on the repository: `admin`, `write`, ... */
  readonly permission?: string
}

export type AuthorizationLookup =
  | { readonly state: 'FOUND'; readonly facts: AuthorizationFacts }
  | { readonly state: 'MISSING'; readonly message: string }
  | { readonly state: 'ERROR'; readonly message: string }

export type ReadAuthorization = (
  repository: string,
  pullRequest: number,
) => AuthorizationLookup

const WRITE_PERMISSIONS = new Set(['admin', 'maintain', 'write'])

/**
 * Reads a PR, one of its reviews, and the reviewer's permission.
 *
 * Every failure is distinguished: 404 means "this PR or review is not there",
 * which is a refusal the amendment could never satisfy; anything else means the
 * API did not answer, which blocks for a different reason and must not be
 * reported as a missing approval.
 */
export function readAuthorizationFromGitHub(
  repository: string,
  pullRequest: number,
  reviewId: number,
  approver: string,
  gh: (args: readonly string[]) => string = args =>
    execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    }) as string,
): AuthorizationLookup {
  const is404 = (error: unknown): boolean =>
    /HTTP 404|Not Found/i.test(
      error instanceof Error ? error.message : String(error),
    )

  let pull: {
    merged?: boolean
    merge_commit_sha?: string
    head?: { sha?: string }
  }
  try {
    pull = JSON.parse(
      gh(['api', `repos/${repository}/pulls/${pullRequest}`]),
    ) as typeof pull
  } catch (error) {
    return is404(error)
      ? {
          state: 'MISSING',
          message: `${repository}#${pullRequest} does not exist`,
        }
      : {
          state: 'ERROR',
          message: `reading ${repository}#${pullRequest} failed: ${error instanceof Error ? error.message : String(error)}`,
        }
  }

  let review: {
    id?: number
    state?: string
    commit_id?: string
    submitted_at?: string
    user?: { login?: string }
  }
  try {
    review = JSON.parse(
      gh([
        'api',
        `repos/${repository}/pulls/${pullRequest}/reviews/${reviewId}`,
      ]),
    ) as typeof review
  } catch (error) {
    return is404(error)
      ? {
          state: 'MISSING',
          message: `review ${reviewId} does not exist on ${repository}#${pullRequest}`,
        }
      : {
          state: 'ERROR',
          message: `reading review ${reviewId} failed: ${error instanceof Error ? error.message : String(error)}`,
        }
  }

  let permission: string | undefined
  try {
    const result = JSON.parse(
      gh(['api', `repos/${repository}/collaborators/${approver}/permission`]),
    ) as { permission?: string; role_name?: string }
    permission = result.permission ?? result.role_name
  } catch (error) {
    if (is404(error)) {
      /*
       * No collaborator record means the login never had access — which is
       * itself the finding. Reported as a resolved fact with no permission so
       * the caller refuses on the permission rather than on a lookup error.
       */
      permission = undefined
    } else {
      return {
        state: 'ERROR',
        message: `reading ${approver}'s permission on ${repository} failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  return {
    state: 'FOUND',
    facts: {
      merged: pull.merged === true,
      ...(typeof pull.merge_commit_sha === 'string'
        ? { mergeCommitSha: pull.merge_commit_sha }
        : {}),
      ...(pull.head?.sha ? { headSha: pull.head.sha } : {}),
      review: {
        id: typeof review.id === 'number' ? review.id : reviewId,
        login: review.user?.login ?? '',
        state: review.state ?? '',
        ...(review.commit_id ? { commitId: review.commit_id } : {}),
        ...(review.submitted_at ? { submittedAt: review.submitted_at } : {}),
      },
      ...(permission ? { permission } : {}),
    },
  }
}

/**
 * Compares a claim with what GitHub says.
 *
 * Returns the reasons it does not hold. Empty means the approval is real, is
 * for these exact bytes, and was given by someone with authority.
 */
export function authorizationProblems(claim: AuthorizationClaim): string[] {
  /*
   * Structural sanity only; the substantive checks need the lookup below. Split
   * so a caller that cannot reach GitHub still refuses a claim that is
   * internally impossible (a review id of zero, a commit that is not a SHA).
   */
  const problems: string[] = []
  if (!Number.isInteger(claim.pullRequest) || claim.pullRequest <= 0) {
    problems.push('authorization.pullRequest must be a pull request number')
  }
  if (!Number.isInteger(claim.reviewId) || claim.reviewId <= 0) {
    problems.push('authorization.reviewId must be a review id')
  }
  if (!/^[0-9a-f]{40}$/i.test(claim.approvedCommit)) {
    problems.push('authorization.approvedCommit must be a full commit SHA')
  }
  return problems
}

/**
 * Whether an approval applies to the bytes being released.
 *
 * `amendmentCommit` is the commit the protected tag points at — the commit
 * whose tree carries the amendment file. A review that approved an earlier
 * revision of the PR approved a different amendment.
 */
export function verifyAuthorization(
  claim: AuthorizationClaim,
  lookup: AuthorizationLookup,
  amendmentCommit: string,
): string[] {
  const problems = authorizationProblems(claim)
  if (problems.length > 0) return problems

  if (lookup.state === 'ERROR') {
    return [
      `could not verify the approval ${claim.repository}#${claim.pullRequest}: ${lookup.message}`,
    ]
  }
  if (lookup.state === 'MISSING') {
    return [
      `the approval this amendment cites does not exist: ${lookup.message}`,
    ]
  }

  const { facts } = lookup

  if (!facts.merged) {
    problems.push(
      `${claim.repository}#${claim.pullRequest} is not merged; an approval of an open pull request has not put these bytes anywhere`,
    )
  }

  if (facts.review.state !== 'APPROVED') {
    problems.push(
      `review ${claim.reviewId} on ${claim.repository}#${claim.pullRequest} is ${facts.review.state || '(unknown state)'}, not APPROVED`,
    )
  }

  if (facts.review.login.toLowerCase() !== claim.approver.toLowerCase()) {
    problems.push(
      `review ${claim.reviewId} was submitted by ${facts.review.login || '(nobody)'}, not ${claim.approver}`,
    )
  }

  if (!facts.permission || !WRITE_PERMISSIONS.has(facts.permission)) {
    problems.push(
      `${claim.approver} has ${facts.permission ?? 'no'} permission on ${claim.repository}; an approval needs write access or better`,
    )
  }

  /*
   * The review must be for the commit that carries the amendment. GitHub
   * records the PR head each review was submitted against, so a review given
   * before a later push approved different bytes — the classic "approve, then
   * amend the file" move.
   */
  if (
    facts.review.commitId !== undefined &&
    facts.review.commitId.toLowerCase() !== amendmentCommit.toLowerCase()
  ) {
    problems.push(
      `review ${claim.reviewId} approved ${facts.review.commitId}, but the amendment tag points at ${amendmentCommit}; the approval covers different bytes`,
    )
  }

  if (
    facts.review.commitId !== undefined &&
    claim.approvedCommit.toLowerCase() !== facts.review.commitId.toLowerCase()
  ) {
    problems.push(
      `amendment records approvedCommit ${claim.approvedCommit}, but the review was submitted against ${facts.review.commitId}`,
    )
  }

  /*
   * The timestamp is compared because the amendment claims it. It is not a
   * security property on its own — GitHub's copy is the record — but a
   * mismatch means the file was written by hand from memory rather than read
   * from the API, and that is worth refusing.
   */
  if (
    facts.review.submittedAt !== undefined &&
    claim.approvedAt !== facts.review.submittedAt
  ) {
    problems.push(
      `amendment records approvedAt ${claim.approvedAt}, but GitHub recorded the approval at ${facts.review.submittedAt}`,
    )
  }

  return problems
}
