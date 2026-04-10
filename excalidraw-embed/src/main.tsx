import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Excalidraw, exportToSvg, restore } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { LibraryItem } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { loadMergedBuiltinLibraryItems } from './loadBuiltinLibrary';

const PROTO = 'zq-excalidraw-host' as const;

/**
 * collaborators 在运行时为 Map；JSON.stringify 会变成 {}，反序列化后没有 forEach → 报错。
 * 持久化时去掉；加载时若非 Map 也删掉，交给 Excalidraw 重新初始化。
 */
function sanitizeAppStateForPersist(appState: AppState): Partial<AppState> {
  const r = { ...appState } as Record<string, unknown>;
  delete r.collaborators;
  return r as Partial<AppState>;
}

function sanitizeAppStateFromStorage(
  appState: Partial<AppState> | undefined,
): Partial<AppState> {
  if (!appState || typeof appState !== 'object') return {};
  const next = { ...appState } as Record<string, unknown>;
  if ('collaborators' in next && !(next.collaborators instanceof Map)) {
    delete next.collaborators;
  }
  return next as Partial<AppState>;
}

function parseScene(
  raw: string | null | undefined,
): { elements: ExcalidrawElement[]; appState: Partial<AppState> } | null {
  if (raw == null || !String(raw).trim()) return null;
  try {
    const o = JSON.parse(String(raw)) as {
      elements?: ExcalidrawElement[];
      appState?: Partial<AppState>;
    };
    if (o && Array.isArray(o.elements)) {
      return {
        elements: o.elements,
        appState: sanitizeAppStateFromStorage(
          o.appState && typeof o.appState === 'object' ? o.appState : {},
        ),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * 全屏 dialog / 独立窗口：用 Hand 作为「预览」交互；文档内嵌块缩略图仍依赖 save 里的 SVG（preview）。
 */
function withViewModeHand(appState: Partial<AppState> | undefined): Partial<AppState> {
  const base =
    appState && typeof appState === 'object' ? { ...appState } : ({} as Partial<AppState>);
  const prev = base.activeTool;
  const lastActive =
    prev && typeof prev === 'object' && 'type' in prev && prev.type !== 'hand'
      ? {
          type: prev.type,
          customType: 'customType' in prev ? prev.customType : null,
        }
      : { type: 'selection' as const, customType: null };
  return {
    ...base,
    activeTool: {
      type: 'hand',
      customType: null,
      locked: false,
      lastActiveTool: lastActive,
    },
  };
}

function App() {
  const [initialData, setInitialData] = useState<{
    elements: ExcalidrawElement[];
    appState: Partial<AppState>;
  } | null>(null);
  /** 每次收到宿主 load 递增，强制 Excalidraw 重新挂载（含二次打开、Strict Mode 双次 ready） */
  const [mountKey, setMountKey] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [langCode, setLangCode] = useState('en');
  /** null = 仍在加载；合并自 public/builtin-libraries/*.excalidrawlib */
  const [builtinLibraryItems, setBuiltinLibraryItems] = useState<LibraryItem[] | null>(null);
  const filesRef = useRef<BinaryFiles>({});
  const lastElementsRef = useRef<readonly ExcalidrawElement[]>([]);
  const lastAppStateRef = useRef<AppState | null>(null);
  const lastFilesRef = useRef<BinaryFiles>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSceneRef = useRef<string>('');

  const flushSave = useCallback(
    async (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const scene = JSON.stringify({
        elements,
        appState: sanitizeAppStateForPersist(appState),
      });
      if (scene === lastSceneRef.current) return;
      lastSceneRef.current = scene;

      let preview: string | undefined;
      try {
        const svg = await exportToSvg({
          elements: [...elements],
          appState,
          files,
          exportPadding: 12,
        });
        const svgString = new XMLSerializer().serializeToString(svg);
        preview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
      } catch {
        /* 文档块缩略图可选 */
      }

      window.parent.postMessage(
        JSON.stringify({
          zq: PROTO,
          type: 'save',
          scene,
          preview,
        }),
        '*',
      );
    },
    [],
  );

  const flushSaveImmediate = useCallback(async () => {
    const elements = lastElementsRef.current;
    const appState = lastAppStateRef.current;
    const files = lastFilesRef.current;
    if (!appState) return;
    await flushSave(elements, appState, files);
  }, [flushSave]);

  const onChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      lastElementsRef.current = elements;
      lastAppStateRef.current = appState;
      lastFilesRef.current = files;
      filesRef.current = files;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flushSave(elements, appState, files);
      }, 450);
    },
    [flushSave],
  );

  useEffect(() => {
    let cancelled = false;
    void loadMergedBuiltinLibraryItems()
      .then((items) => {
        if (!cancelled) setBuiltinLibraryItems(items);
      })
      .catch(() => {
        if (!cancelled) setBuiltinLibraryItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      let data: unknown = ev.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data) as Record<string, unknown>;
        } catch {
          return;
        }
      }
      if (!data || typeof data !== 'object') return;
      const d = data as {
        zq?: string;
        type?: string;
        scene?: string | null;
        theme?: string;
        openMode?: 'edit' | 'view';
        langCode?: string;
      };
      if (d.zq !== PROTO || d.type !== 'load') return;

      lastSceneRef.current = '';
      const th = d.theme === 'dark' ? 'dark' : 'light';
      if (typeof d.langCode === 'string' && d.langCode.trim()) {
        setLangCode(d.langCode.trim());
      }
      const openMode = d.openMode === 'view' ? 'view' : 'edit';
      setTheme(th);
      const parsed = parseScene(d.scene ?? null);
      if (parsed) {
        const restored = restore(
          {
            elements: parsed.elements,
            appState: { ...sanitizeAppStateFromStorage(parsed.appState), theme: th },
          },
          null,
          null,
          { repairBindings: true, refreshDimensions: true },
        );
        const appAfter = sanitizeAppStateFromStorage({
          ...restored.appState,
          theme: th,
        });
        setInitialData({
          elements: restored.elements as ExcalidrawElement[],
          appState:
            openMode === 'view' ? withViewModeHand(appAfter) : appAfter,
        });
      } else {
        setInitialData({
          elements: [],
          appState:
            openMode === 'view'
              ? withViewModeHand({ theme: th })
              : { theme: th },
        });
      }
      setMountKey((k) => k + 1);
    }
    window.addEventListener('message', onMsg);
    /** 必须在注册监听器之后再通知宿主，否则父窗口在 iframe load 时发出的 load 会丢失 → 二次打开空白 */
    window.parent.postMessage(JSON.stringify({ zq: PROTO, type: 'ready' }), '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    function onHostCommand(ev: MessageEvent) {
      let data: unknown = ev.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data) as Record<string, unknown>;
        } catch {
          return;
        }
      }
      if (!data || typeof data !== 'object') return;
      const d = data as { zq?: string; type?: string; langCode?: string };
      if (d.zq !== PROTO) return;
      if (d.type === 'set-lang' && typeof d.langCode === 'string' && d.langCode.trim()) {
        setLangCode(d.langCode.trim());
        return;
      }
      if (d.type === 'flush-save') {
        void flushSaveImmediate();
        return;
      }
      if (d.type === 'notify-layout') {
        try {
          window.dispatchEvent(new Event('resize'));
        } catch {
          /* ignore */
        }
        return;
      }
    }
    window.addEventListener('message', onHostCommand);
    return () => window.removeEventListener('message', onHostCommand);
  }, [flushSaveImmediate]);

  if (!initialData || builtinLibraryItems === null) {
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
    <div style={{ height: '100vh', width: '100%' }}>
      <Excalidraw
        key={mountKey}
        langCode={langCode}
        initialData={{
          elements: initialData.elements,
          appState: initialData.appState,
          libraryItems: builtinLibraryItems,
        }}
        onChange={onChange}
        theme={theme}
      />
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<App />);
}
