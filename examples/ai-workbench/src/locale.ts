/* eslint-disable no-restricted-globals */
/**
 * Workbench UI locale: the message catalog, the active language and a tiny
 * subscription so text nodes can be re-rendered in place.
 *
 * This is deliberately not `@zeus-js/i18n`. The workbench only needs a flat
 * catalog and one signal; pulling the framework i18n runtime in here would
 * couple the AI shell to a package it does not control. The rules that matter:
 *
 * - `t()` returns chrome copy only. Conversation content, code, diffs, tool
 *   output, model names, provider ids, URLs and error codes are data and are
 *   rendered verbatim.
 * - Changing the language never touches controllers, sessions or transports:
 *   subscribers only rewrite the text they own.
 */

import type { AiLocale } from '@zeus-web/ai-primitives'
import type { WorkbenchMessageKey } from './locales/en'
import { EN_LOCALE, ZH_CN_LOCALE } from '@zeus-web/ai-primitives'
import { en } from './locales/en'
import { zhCN } from './locales/zh-CN'

export type WorkbenchLanguage = 'en' | 'zh-CN'

export interface WorkbenchLanguageOption {
  readonly id: WorkbenchLanguage
  readonly labelKey: WorkbenchMessageKey
  /** `lang` attribute value so assistive tech switches voice. */
  readonly tag: string
}

export const WORKBENCH_LANGUAGES: readonly WorkbenchLanguageOption[] = [
  { id: 'en', labelKey: 'workbench.languageEnglish', tag: 'en' },
  { id: 'zh-CN', labelKey: 'workbench.languageChinese', tag: 'zh-CN' },
]

const CATALOGS: Record<
  WorkbenchLanguage,
  Record<WorkbenchMessageKey, string>
> = { en, 'zh-CN': zhCN }

const STORAGE_KEY = 'zeus-wb-language'

type Listener = (language: WorkbenchLanguage) => void

const listeners = new Set<Listener>()
let language: WorkbenchLanguage = readStoredLanguage()

function isLanguage(value: unknown): value is WorkbenchLanguage {
  return value === 'en' || value === 'zh-CN'
}

/**
 * The language this page starts in.
 *
 * English is the default, matching `index.html`'s `lang="en"` and the English
 * source catalog. A stored choice always wins, so a visitor who picked
 * 简体中文 keeps it across reloads. Guessing from `navigator.language` was
 * rejected: it would make the first paint depend on the machine, and the
 * acceptance gates assert English chrome against a fixed build.
 */
function readStoredLanguage(): WorkbenchLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    // Storage can be unavailable (private mode); fall through to the default.
  }
  return 'en'
}

function interpolate(
  template: string,
  values: Readonly<Record<string, string | number>> | undefined,
): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    return name in values ? String(values[name]) : match
  })
}

/**
 * Copy for `key` in the active language. Call this at render time, and again
 * from a `subscribeLanguage` callback, so a switch rewrites text in place.
 */
export function t(
  key: WorkbenchMessageKey,
  values?: Readonly<Record<string, string | number>>,
): string {
  return interpolate(CATALOGS[language][key], values)
}

export function getLanguage(): WorkbenchLanguage {
  return language
}

/** Runs `listener` on every language change; returns the unsubscribe. */
export function subscribeLanguage(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * `AiLocale` for the AI primitives and Web Components. It is passed in as a
 * property, never imported by the packages themselves.
 */
function aiLocaleFor(value: WorkbenchLanguage): AiLocale {
  return value === 'zh-CN' ? ZH_CN_LOCALE : EN_LOCALE
}

export function getAiLocale(): AiLocale {
  return aiLocaleFor(language)
}

export function setLanguage(next: WorkbenchLanguage): void {
  if (next === language) return
  language = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage can be unavailable; the choice still holds for this page.
  }
  const tag = WORKBENCH_LANGUAGES.find(entry => entry.id === next)?.tag ?? next
  document.documentElement.lang = tag
  for (const listener of listeners) listener(next)
}

/** Applies the stored language to `<html lang>` before the shell renders. */
export function applyInitialLanguage(): void {
  const tag =
    WORKBENCH_LANGUAGES.find(entry => entry.id === language)?.tag ?? language
  document.documentElement.lang = tag
}
