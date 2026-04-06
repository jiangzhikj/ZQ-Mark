import zhCN from './locales/zh-CN'
import zhTW from './locales/zh-TW'
import en from './locales/en'
import type { AppLocale, SupportedLocale } from './types'

export const messages: Record<SupportedLocale, AppLocale> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en
}

export function t(locale: SupportedLocale, path: string): string {
  const msg = messages[locale]
  const keys = path.split('.')
  let result: unknown = msg
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key]
    } else {
      return path
    }
  }
  return typeof result === 'string' ? result : path
}

export type { AppLocale, SupportedLocale, MenuLocale } from './types'
