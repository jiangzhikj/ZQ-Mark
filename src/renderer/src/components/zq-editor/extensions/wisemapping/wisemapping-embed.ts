/** iframe 内嵌页与宿主之间的 postMessage 协议（与 wisemapping-embed/src/main.tsx 一致） */

import {
  fetchDiagramAssetText,
  isDiagramAssetUrl,
} from '../../utils/diagram-preview-asset';

export const WISEMAPPING_HOST_PROTO = 'zq-wisemapping-host' as const;

export function mapAppLocaleToWisemappingLocale(appLocale: string): string {
  const lc = appLocale.toLowerCase().replace(/_/g, '-');
  if (lc === 'zh-tw' || lc === 'zh-hant' || lc === 'zh-hk') return 'zh';
  if (lc.startsWith('zh')) return 'zh-CN';
  return 'en';
}

export interface ParsedWisemappingHostMessage {
  zq?: string;
  type?: 'ready' | 'save';
  mapXml?: string;
  preview?: string;
}

export function parseWisemappingHostMessage(
  raw: unknown,
): ParsedWisemappingHostMessage | null {
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
  const d = o as ParsedWisemappingHostMessage;
  if (d.zq !== WISEMAPPING_HOST_PROTO) return null;
  return d;
}

/**
 * 校验 postMessage 是否来自当前 Wisemapping iframe。
 * local-asset 与沙箱无 allow-same-origin 时，部分环境下 ev.source 与 contentWindow 严格不等，
 * 但仍可通过子窗口的 frameElement 与宿主持有的 iframe 对应。
 */
export function isWisemappingMessageFromIframe(
  ev: MessageEvent,
  iframe: HTMLIFrameElement | null,
): boolean {
  if (!iframe?.contentWindow) return false;
  if (ev.source === iframe.contentWindow) return true;
  const src = ev.source;
  if (!(src instanceof Window)) return false;
  try {
    return src.frameElement === iframe;
  } catch {
    return false;
  }
}

export function hasWisemappingMapXml(s: string | null | undefined): boolean {
  if (s == null || !String(s).trim()) return false;
  const str = String(s);
  if (isDiagramAssetUrl(str)) return true;
  return /<map[\s>]/.test(str) && /version\s*=\s*["']tango["']/.test(str);
}

export async function resolveMapXmlForWisemapping(raw: string): Promise<string> {
  const s = raw?.trim() ?? '';
  if (isDiagramAssetUrl(s)) {
    const t = await fetchDiagramAssetText(s);
    if (t != null && t.trim().length > 0) return t;
    return '<map name="1" version="tango"><topic central="true" text="Mind Map" id="1"/></map>';
  }
  return s.length > 0
    ? s
    : '<map name="1" version="tango"><topic central="true" text="Mind Map" id="1"/></map>';
}

export function postWisemappingLoad(
  target: Window,
  payload: {
    mapXml: string | null;
    theme: 'light' | 'dark';
    openMode?: 'edit' | 'view';
    locale: string;
  },
): void {
  target.postMessage(
    JSON.stringify({
      zq: WISEMAPPING_HOST_PROTO,
      type: 'load',
      mapXml: payload.mapXml,
      theme: payload.theme,
      openMode: payload.openMode ?? 'edit',
      locale: payload.locale,
    }),
    '*',
  );
}

export function postWisemappingFlushSave(target: Window): void {
  target.postMessage(
    JSON.stringify({
      zq: WISEMAPPING_HOST_PROTO,
      type: 'flush-save',
    }),
    '*',
  );
}

export function postWisemappingNotifyLayout(target: Window): void {
  target.postMessage(
    JSON.stringify({
      zq: WISEMAPPING_HOST_PROTO,
      type: 'notify-layout',
    }),
    '*',
  );
}

export function postWisemappingSetTheme(target: Window, theme: 'light' | 'dark'): void {
  target.postMessage(
    JSON.stringify({
      zq: WISEMAPPING_HOST_PROTO,
      type: 'set-theme',
      theme,
    }),
    '*',
  );
}

/** 触发嵌入页导出当前画布为 PNG 或 SVG（由 wisemapping-embed 内 ImageExporterFactory 生成并下载） */
export function postWisemappingExportImage(
  target: Window,
  format: 'png' | 'svg',
): void {
  target.postMessage(
    JSON.stringify({
      zq: WISEMAPPING_HOST_PROTO,
      type: 'export-image',
      format,
    }),
    '*',
  );
}
