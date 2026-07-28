import type { ComputedRef } from 'vue'

import type { DocsLocale } from '../../data/docs-i18n'

import { useData } from 'vitepress'
import { computed } from 'vue'

import { resolveDocsLocale } from '../../data/docs-i18n'

export interface DocsLocaleState {
  locale: ComputedRef<DocsLocale>
}

export function useDocsLocale(): DocsLocaleState {
  const { lang } = useData()
  const locale = computed(() => resolveDocsLocale(lang.value))

  return {
    locale,
  }
}

export function useLocalizedMessages<T>(
  messages: Record<DocsLocale, T>,
): ComputedRef<T> {
  const { locale } = useDocsLocale()

  return computed(() => messages[locale.value])
}
