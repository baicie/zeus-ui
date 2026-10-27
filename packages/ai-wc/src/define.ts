/**
 * Client entry: registers every `zw-ai-*` element as a side effect. Do not
 * import it during SSR; import `defineAi*()` from the main entry instead
 * when you want on-demand registration.
 */

import { defineAiElements } from './index'

defineAiElements()
