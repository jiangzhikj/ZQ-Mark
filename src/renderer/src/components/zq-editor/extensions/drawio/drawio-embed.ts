import { EMPTY_DRAWIO_XML } from './empty-mxfile';
import type { InjectionKey, Ref } from 'vue';

/** full：与 diagrams.net 默认一致（不强制 ui=min）；minimal：侧栏精简的嵌入布局 */
export type DrawioUiLayout = 'full' | 'minimal';

export const DRAWIO_UI_LAYOUT_INJECT_KEY: InjectionKey<Ref<DrawioUiLayout>> =
  Symbol('zq-drawio-ui-layout');

/**
 * 与 `resources/drawio` 内 mxLanguageMap / dia_*.txt 一致，使嵌入 UI 与 ZQ Mark 语言一致。
 */
export function mapAppLocaleToDrawioLang(appLocale: string): string {
  const lc = appLocale.toLowerCase();
  if (lc === 'zh-tw' || lc === 'zh_hant') return 'zh-tw';
  if (lc.startsWith('zh')) return 'zh';
  return 'en';
}

export function buildDrawioEmbedUrl(
  indexBaseUrl: string,
  options: {
    dark?: boolean;
    uiLayout?: DrawioUiLayout;
    /** 应用当前语言（vue-i18n locale），如 zh-CN / zh-TW / en */
    appLocale?: string;
  } = {},
): string {
  const sep = indexBaseUrl.includes('?') ? '&' : '?';
  const params = new URLSearchParams({
    embed: '1',
    proto: 'json',
    /** 不显示 diagrams.net 自带的开屏 / Loading 文案页，由宿主 load 后再呈现 */
    splash: '0',
    /** 隐藏嵌入条上的 Save / Exit，由宿主「完成」统一保存并导出 */
    noSaveBtn: '1',
    noExitBtn: '1',
    saveAndExit: '0',
    ...(options.dark ? { dark: '1' } : {}),
  });
  if (options.uiLayout === 'minimal') {
    params.set('ui', 'min');
  }
  if (options.appLocale) {
    params.set('lang', mapAppLocaleToDrawioLang(options.appLocale));
  }
  return `${indexBaseUrl}${sep}${params.toString()}`;
}

/** 与 draw.io 内「保存」按钮相同：向父窗口 post save 事件（含 xml） */
export function postDrawioEmbedInvokeSave(target: Window): void {
  target.postMessage(
    JSON.stringify({ action: 'invokeAction', actionName: 'save' }),
    '*',
  );
}

/** 块内只读缩略：lightbox + 隐藏 chrome，仍用 embed+proto=json 做 load */
export function buildDrawioViewerEmbedUrl(
  indexBaseUrl: string,
  options: { dark?: boolean; appLocale?: string } = {},
): string {
  const sep = indexBaseUrl.includes('?') ? '&' : '?';
  const params = new URLSearchParams({
    embed: '1',
    proto: 'json',
    ui: 'min',
    lightbox: '1',
    chrome: '0',
    splash: '0',
    ...(options.dark ? { dark: '1' } : {}),
  });
  if (options.appLocale) {
    params.set('lang', mapAppLocaleToDrawioLang(options.appLocale));
  }
  return `${indexBaseUrl}${sep}${params.toString()}`;
}

export interface ParsedDrawioMessage {
  event?: string;
  action?: string;
  xml?: string;
  /** export 响应：svg / xml 等 */
  format?: string;
  /** export svg 时的 Data URL */
  data?: string;
}

export function parseDrawioMessage(raw: unknown): ParsedDrawioMessage | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as ParsedDrawioMessage;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as ParsedDrawioMessage;
    } catch {
      return null;
    }
  }
  return null;
}

/** 单页保存时 draw.io 常发 `<mxGraphModel>...</mxGraphModel>`，多页才是完整 `<mxfile>` */
export function isDrawioDiagramXml(s: string): boolean {
  const t = s.trim();
  if (t.length < 12) return false;
  return (
    t.includes('<mxfile') ||
    t.includes('<mxGraphModel') ||
    (t.includes('<diagram') && t.includes('mxGraphModel'))
  );
}

export function getLoadXmlForDrawio(
  storedXml: string | null | undefined,
): string {
  const s = storedXml?.trim() ?? '';
  if (s.length > 0 && isDrawioDiagramXml(s)) {
    return storedXml!;
  }
  return EMPTY_DRAWIO_XML;
}
