import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { debounce } from 'lodash';
import {
  PersistenceManager,
  ImageExporterFactory,
  type ThemeVariant,
} from '@wisemapping/mindplot';
import Editor, { useEditor } from '@wisemapping/editor';
import type { EditorOptions } from '@wisemapping/editor';
import BootstrapPersistenceManager from '@wisemapping/editor/src/classes/persistence/BootstrapPersistenceManager';
import type { ThemeVariantStorage } from '@wisemapping/editor/src/types/ThemeVariantStorage';
import type MapInfo from '@wisemapping/editor/src/classes/model/map-info';
import type Model from '@wisemapping/editor/src/classes/model/editor';

const PROTO = 'zq-wisemapping-host' as const;

const DEFAULT_MAP_XML =
  '<map name="1" version="tango"><topic central="true" text="Mind Map" id="1"/></map>';

function createMemoryThemeStorage(initial: ThemeVariant): ThemeVariantStorage {
  let v = initial;
  const listeners = new Set<(variant: ThemeVariant) => void>();
  return {
    getThemeVariant: () => v,
    setThemeVariant: (variant: ThemeVariant) => {
      v = variant;
      listeners.forEach((cb) => cb(variant));
    },
    subscribe: (callback: (variant: ThemeVariant) => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
}

class MapInfoZq implements MapInfo {
  private title: string;
  private starred = true;
  constructor(
    private readonly id: string,
    title: string,
    private readonly creatorFullName: string,
    private readonly locked: boolean,
  ) {
    this.title = title;
  }
  getCreatorFullName(): string {
    return this.creatorFullName;
  }
  isStarred(): Promise<boolean> {
    return Promise.resolve(this.starred);
  }
  updateStarred(value: boolean): Promise<void> {
    this.starred = value;
    return Promise.resolve();
  }
  getTitle(): string {
    return this.title;
  }
  updateTitle(title: string): Promise<void> {
    this.title = title;
    return Promise.resolve();
  }
  isLocked(): boolean {
    return this.locked;
  }
  getLockedMessage(): string {
    return 'Map Is Locked !';
  }
  getZoom(): number {
    return 0.8;
  }
  getId(): string {
    return this.id;
  }
}

class HostNotifyPersistenceManager extends PersistenceManager {
  constructor(
    private readonly onSaved: (xml: string, preview?: string) => void,
    private readonly getSvgElement: () => Element | null = () => null,
  ) {
    super();
  }

  loadMapDom(): Promise<Document> {
    return Promise.reject(new Error('loadMapDom not used (bootstrap only)'));
  }

  saveMapXml(
    _mapId: string,
    mapXml: Document,
    _pref?: string,
    _saveHistory?: boolean,
    events?: { onSuccess?: () => void; onError?: (e: unknown) => void },
  ): void {
    void (async () => {
      try {
        const xml = new XMLSerializer().serializeToString(mapXml);
        let preview: string | undefined;
        try {
          const svgElement = this.getSvgElement();
          if (svgElement) {
            const exporter = ImageExporterFactory.create(
              'png',
              svgElement,
              window.innerWidth,
              window.innerHeight,
              true,
            );
            let imgStr = await exporter.exportAndEncode();
            imgStr = imgStr.replace('octet/stream', 'image/png');
            if (imgStr.startsWith('data:')) preview = imgStr;
          }
        } catch {
          /* 缩略图可选 */
        }
        this.onSaved(xml, preview);
        events?.onSuccess?.();
      } catch (e) {
        events?.onError?.(e);
      }
    })();
  }

  discardChanges(_mapId: string): void {
    /* embed */
  }

  unlockMap(_mapId: string): void {
    /* embed */
  }
}

function mapAppLocaleToWisemapping(locale: string): string {
  const lc = locale.toLowerCase().replace(/_/g, '-');
  if (lc === 'zh-tw' || lc === 'zh-hant' || lc === 'zh-hk') return 'zh';
  if (lc.startsWith('zh')) return 'zh-CN';
  return 'en';
}

function normalizeIncomingXml(raw: string | null | undefined): string {
  const s = raw?.trim() ?? '';
  if (!s) return DEFAULT_MAP_XML;
  return s;
}

function readStoredBootstrap(): string | null {
  try {
    const x = sessionStorage.getItem('zq-wm-bootstrap');
    if (x) {
      sessionStorage.removeItem('zq-wm-bootstrap');
      return x;
    }
  } catch {
    /* ignore */
  }
  return null;
}

type LoadMsg = {
  zq?: string;
  type?: string;
  mapXml?: string | null;
  theme?: string;
  openMode?: string;
  locale?: string;
  format?: 'png' | 'svg';
};

function parseHostMessage(raw: unknown): LoadMsg | null {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  return o as LoadMsg;
}

function postSave(mapXml: string, preview?: string): void {
  window.parent.postMessage(
    JSON.stringify({ zq: PROTO, type: 'save', mapXml, preview }),
    '*',
  );
}

function triggerDownloadFromUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (url.startsWith('blob:')) {
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }
}

async function exportMindmapToFile(model: Model | undefined, format: 'png' | 'svg'): Promise<void> {
  if (!model?.isMapLoadded()) return;
  const designer = model.getDesigner();
  const workspace = designer.getWorkSpace();
  const svgElement = workspace.getSVGElement();
  const exporter = ImageExporterFactory.create(
    format,
    svgElement,
    window.innerWidth,
    window.innerHeight,
    true,
  );
  let url = await exporter.exportAndEncode();
  if (format === 'png') {
    url = url.replace('octet/stream', 'image/png');
  }
  triggerDownloadFromUrl(url, format === 'png' ? 'mindmap.png' : 'mindmap.svg');
}

function EmbeddedEditorApp({
  bootstrapXml,
  themeMode,
  localeCode,
}: {
  bootstrapXml: string;
  themeMode: 'light' | 'dark';
  localeCode: string;
}) {
  const themeVariantStorage = useMemo(
    () => createMemoryThemeStorage(themeMode === 'dark' ? 'dark' : 'light'),
    [themeMode],
  );

  useEffect(() => {
    themeVariantStorage.setThemeVariant(themeMode === 'dark' ? 'dark' : 'light');
  }, [themeMode, themeVariantStorage]);

  const mapInfo = useMemo(
    () => new MapInfoZq('zq-embed', 'Mind Map', 'ZQ Mark', false),
    [],
  );

  const getSvgElementRef = useRef<() => Element | null>(() => null);

  const hostPmRef = useRef<HostNotifyPersistenceManager | null>(null);
  if (!hostPmRef.current) {
    hostPmRef.current = new HostNotifyPersistenceManager(
      (xml, preview) => {
        postSave(xml, preview);
      },
      () => {
        try {
          return getSvgElementRef.current() ?? null;
        } catch {
          return null;
        }
      },
    );
  }

  const persistence = useMemo(
    () => new BootstrapPersistenceManager(hostPmRef.current!, bootstrapXml),
    [bootstrapXml],
  );

  const options: EditorOptions = useMemo(
    () => ({
      mode: 'edition-owner',
      locale: localeCode,
      enableKeyboardEvents: true,
      enableAppBar: false,
      hideCreatorInfo: true,
      saveOnLoad: false,
      initialThemeVariant: themeMode === 'dark' ? 'dark' : 'light',
    }),
    [localeCode, themeMode],
  );

  const editor = useEditor({
    mapInfo,
    options,
    persistenceManager: persistence,
  });

  useEffect(() => {
    getSvgElementRef.current = () => {
      try {
        const m = editor.model;
        if (!m?.isMapLoadded()) return null;
        return m.getDesigner().getWorkSpace().getSVGElement() ?? null;
      } catch {
        return null;
      }
    };
  }, [editor.model]);

  useEffect(() => {
    const m = editor.model;
    if (!m?.isMapLoadded()) return undefined;
    const designer = m.getDesigner();
    const debounced = debounce(() => {
      void m.save(false).catch(() => {});
    }, 900);
    designer.addEvent('modelUpdate', debounced);
    return () => {
      debounced.cancel();
      designer.removeEvent('modelUpdate', debounced);
    };
  }, [editor.model]);

  useEffect(() => {
    function onCmd(ev: MessageEvent) {
      const d = parseHostMessage(ev.data);
      if (!d || d.zq !== PROTO) return;
      if (d.type === 'flush-save') {
        // 等布局一帧后再保存，避免首次点「完成」时 SVG 尚未就绪导致无 preview
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            void editor.model?.save(false).catch(() => {});
          });
        });
        return;
      }
      if (d.type === 'notify-layout') {
        try {
          window.dispatchEvent(new Event('resize'));
        } catch {
          /* ignore */
        }
      }
      if (d.type === 'set-theme' && d.theme) {
        themeVariantStorage.setThemeVariant(d.theme === 'dark' ? 'dark' : 'light');
      }
      if (d.type === 'export-image') {
        const fmt = d.format === 'svg' ? 'svg' : 'png';
        void exportMindmapToFile(editor.model, fmt).catch(() => {});
      }
    }
    window.addEventListener('message', onCmd);
    return () => window.removeEventListener('message', onCmd);
  }, [editor.model, themeVariantStorage]);

  return (
    <Editor
      config={editor}
      onAction={() => {}}
      themeVariantStorage={themeVariantStorage}
    />
  );
}

function RootApp() {
  const stored = readStoredBootstrap();
  const [bootXml, setBootXml] = useState<string | null>(stored);
  const [theme, setTheme] = useState<'light' | 'dark'>(stored ? 'light' : 'light');
  const [localeCode, setLocaleCode] = useState('en');
  const appliedRef = useRef<string | null>(stored);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = parseHostMessage(ev.data);
      if (!d || d.zq !== PROTO) return;

      if (d.type === 'load') {
        const xml = normalizeIncomingXml(d.mapXml ?? null);
        const th = d.theme === 'dark' ? 'dark' : 'light';
        const loc =
          typeof d.locale === 'string' && d.locale.trim() ? d.locale.trim() : 'en';

        if (appliedRef.current != null && appliedRef.current !== xml) {
          try {
            sessionStorage.setItem('zq-wm-bootstrap', xml);
          } catch {
            /* ignore */
          }
          window.location.reload();
          return;
        }
        appliedRef.current = xml;
        setBootXml(xml);
        setTheme(th);
        setLocaleCode(loc);
        return;
      }
    }
    window.addEventListener('message', onMsg);
    window.parent.postMessage(JSON.stringify({ zq: PROTO, type: 'ready' }), '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (!bootXml) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'system-ui, sans-serif',
          color: '#666',
        }}
      >
        …
      </div>
    );
  }

  return (
    <EmbeddedEditorApp
      key={bootXml.slice(0, 120)}
      bootstrapXml={bootXml}
      themeMode={theme}
      localeCode={localeCode}
    />
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<RootApp />);
}
