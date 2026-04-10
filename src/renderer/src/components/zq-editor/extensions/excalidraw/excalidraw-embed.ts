/** iframe 内嵌页与宿主之间的 postMessage 协议（与 excalidraw-embed/src/main.tsx 一致） */

import {
  fetchDiagramAssetText,
  isDiagramAssetUrl,
} from '../../utils/diagram-preview-asset';

export const EXCALIDRAW_HOST_PROTO = 'zq-excalidraw-host' as const;

/** 与 Excalidraw 内置语言包一致（见 @excalidraw/excalidraw languages） */
export function mapAppLocaleToExcalidrawLangCode(appLocale: string): string {
  const lc = appLocale.toLowerCase().replace(/_/g, '-');
  if (lc === 'zh-tw' || lc === 'zh-hant' || lc === 'zh-hk') return 'zh-TW';
  if (lc.startsWith('zh')) return 'zh-CN';
  return 'en';
}

export interface ParsedExcalidrawHostMessage {
  zq?: string;
  type?: 'ready' | 'save';
  scene?: string;
  preview?: string;
}

export function parseExcalidrawHostMessage(
  raw: unknown,
): ParsedExcalidrawHostMessage | null {
  if (raw == null) return null;
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return null;
  const d = o as ParsedExcalidrawHostMessage;
  if (d.zq !== EXCALIDRAW_HOST_PROTO) return null;
  return d;
}

export function hasExcalidrawScene(s: string | null | undefined): boolean {
  if (s == null || !String(s).trim()) return false;
  const str = String(s);
  if (isDiagramAssetUrl(str)) return true;
  try {
    const o = JSON.parse(str) as { elements?: unknown };
    return Array.isArray(o.elements) && o.elements.length > 0;
  } catch {
    return false;
  }
}

/** 解析 attrs 中的 scene（内联 JSON 或资源 URL）为可传给 embed load 的 JSON 字符串 */
export async function resolveSceneForExcalidraw(raw: string): Promise<string> {
  const s = raw?.trim() ?? '';
  if (isDiagramAssetUrl(s)) {
    const t = await fetchDiagramAssetText(s);
    if (t != null && t.trim().length > 0) return t;
    return '{}';
  }
  return s.length > 0 ? s : '{}';
}

export function postExcalidrawLoad(
  target: Window,
  payload: {
    scene: string | null;
    theme: 'light' | 'dark';
    /** view：内嵌页默认选中 Hand（抓手）作为「预览」；edit：默认编辑工具 */
    openMode?: 'edit' | 'view';
    /** 与宿主 vue-i18n locale 对齐，如 zh-CN / zh-TW / en */
    langCode: string;
  },
): void {
  target.postMessage(
    JSON.stringify({
      zq: EXCALIDRAW_HOST_PROTO,
      type: 'load',
      scene: payload.scene,
      theme: payload.theme,
      openMode: payload.openMode ?? 'edit',
      langCode: payload.langCode,
    }),
    '*',
  );
}

/** 编辑中切换应用语言时更新 Excalidraw UI，不重载场景 */
export function postExcalidrawSetLang(target: Window, langCode: string): void {
  target.postMessage(
    JSON.stringify({
      zq: EXCALIDRAW_HOST_PROTO,
      type: 'set-lang',
      langCode,
    }),
    '*',
  );
}

/** 立即保存（跳过防抖），用于切预览、关闭全屏、打开独立窗口前。 */
export function postExcalidrawFlushSave(target: Window): void {
  target.postMessage(
    JSON.stringify({
      zq: EXCALIDRAW_HOST_PROTO,
      type: 'flush-save',
    }),
    '*',
  );
}

/** 全屏层切换后通知内嵌画布重算尺寸（与 draw.io 的 resize bump 类似）。 */
export function postExcalidrawNotifyLayout(target: Window): void {
  target.postMessage(
    JSON.stringify({
      zq: EXCALIDRAW_HOST_PROTO,
      type: 'notify-layout',
    }),
    '*',
  );
}
