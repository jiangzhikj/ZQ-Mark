import { nanoid } from 'nanoid'
import type { WebLibrarySerialized } from './web-zql'

const SID_PARAM = 'sid'
const VIEW_PARAM = 'view'

export type WebViewState = 'welcome' | 'document' | 'library'

/** 与 sessionStorage 中保存的页面状态一致，用于刷新后恢复 */
export interface WebPageStateV1 {
  v: 1
  view: WebViewState
  filePath?: string | null
  fileName?: string
  isZq?: boolean
  zqMeta?: unknown
  docJson?: unknown
  markdown?: string
  library?: WebLibrarySerialized | null
  activeLibraryDocId?: string | null
}

function storageKey(sid: string): string {
  return `zq-web-${sid}`
}

/** 确保 URL 含 sid；同一标签页内刷新通过 sid 找回 sessionStorage */
export function ensureWebSessionInUrl(): string {
  const u = new URL(window.location.href)
  let sid = u.searchParams.get(SID_PARAM)
  if (!sid) {
    sid = nanoid(10)
    u.searchParams.set(SID_PARAM, sid)
    if (!u.searchParams.has(VIEW_PARAM)) {
      u.searchParams.set(VIEW_PARAM, 'welcome')
    }
    history.replaceState({}, '', u.pathname + u.search + u.hash)
  }
  return sid
}

export function getWebSessionIdFromUrl(): string {
  return new URL(window.location.href).searchParams.get(SID_PARAM) || ensureWebSessionInUrl()
}

/** 同步 URL 上的 view，便于区分欢迎页 / 单文档 / 文件库 */
export function setWebUrlView(view: WebViewState): void {
  const u = new URL(window.location.href)
  u.searchParams.set(SID_PARAM, getWebSessionIdFromUrl())
  u.searchParams.set(VIEW_PARAM, view)
  history.replaceState({}, '', u.pathname + u.search + u.hash)
}

export function loadWebPageState(): WebPageStateV1 | null {
  try {
    const raw = sessionStorage.getItem(storageKey(getWebSessionIdFromUrl()))
    if (!raw) return null
    const data = JSON.parse(raw) as WebPageStateV1
    return data?.v === 1 ? data : null
  } catch {
    return null
  }
}

export function saveWebPageState(state: WebPageStateV1): void {
  try {
    sessionStorage.setItem(storageKey(getWebSessionIdFromUrl()), JSON.stringify(state))
  } catch (e) {
    console.warn('[web] saveWebPageState failed', e)
  }
}

/** 与 web-electron 中 getWindowMode 使用的键一致，供 initLibrary 判断是否为文件库模式 */
export const WEB_STORAGE_WINDOW_MODE_KEY = 'zq-web-window-mode'

export function setWebStoredWindowMode(mode: 'document' | 'library'): void {
  sessionStorage.setItem(WEB_STORAGE_WINDOW_MODE_KEY, mode)
}
