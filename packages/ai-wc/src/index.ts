/**
 * `@zeus-web/ai-wc` — Web Component adapter for Zeus AI Headless V2
 * (AI2-503).
 *
 * Importing this module defines nothing and touches no DOM global: call the
 * `defineAi*()` function of each element you use (on-demand registration),
 * or import `@zeus-web/ai-wc/define` on the client to register them all.
 * Controllers, sessions and data are DOM properties; elements render into
 * their light DOM and release every subscription on disconnect.
 */

import {
  defineAiApprovalPrompt,
  defineAiExecutionStatus,
  defineAiRunSwitcher,
  defineAiStepList,
} from './agent'
import {
  defineAiArtifactPreview,
  defineAiCitationList,
  defineAiComposer,
  defineAiConversationList,
  defineAiMessageTimeline,
} from './chat'
import {
  defineAiChangesetActions,
  defineAiDiffViewer,
  defineAiFileChangeTree,
  defineAiTestReport,
  defineAiWorkspacePicker,
} from './coding'

export * from './agent'
export * from './chat'
export * from './coding'
export * from './element'
export * from './patch'

/** Register every `zw-ai-*` element (client only). */
export function defineAiElements(registry?: CustomElementRegistry): void {
  defineAiComposer(registry)
  defineAiMessageTimeline(registry)
  defineAiCitationList(registry)
  defineAiArtifactPreview(registry)
  defineAiConversationList(registry)
  defineAiExecutionStatus(registry)
  defineAiStepList(registry)
  defineAiApprovalPrompt(registry)
  defineAiRunSwitcher(registry)
  defineAiWorkspacePicker(registry)
  defineAiFileChangeTree(registry)
  defineAiDiffViewer(registry)
  defineAiTestReport(registry)
  defineAiChangesetActions(registry)
}
