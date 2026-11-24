/**
 * Types for `assert-verify-workflow-is-read-only.mjs`.
 *
 * The module ships as plain `.mjs` so the workflow can run it with `node`
 * without a TypeScript loader. This declaration is only so the tests can
 * import it under `strict` without becoming `any`.
 */

export interface WorkflowStep {
  name?: string
  run?: unknown
  env?: Record<string, unknown>
}

export interface WorkflowJob {
  permissions?: Record<string, unknown>
  steps?: WorkflowStep[]
}

export interface Workflow {
  permissions?: Record<string, unknown>
  jobs?: Record<string, WorkflowJob>
}

export declare const FORBIDDEN_COMMAND: RegExp
export declare const FORBIDDEN_SECRETS: string[]

export declare function stripShellComments(script: string): string
export declare function findPublishOffences(workflow: Workflow): string[]
export declare function findPermissionOffences(workflow: Workflow): string[]
export declare function checkVerifyWorkflow(file: string): string[]
