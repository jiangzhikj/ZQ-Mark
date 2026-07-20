import { inject, ref, watch, type Ref } from 'vue';
import { isRelativeAssetPath } from '../../../../../shared/markdown-assets';

function isLocalAbsolutePath(s: string): boolean {
  if (!s) return false;
  if (
    s.startsWith('local-asset:') ||
    s.startsWith('http:') ||
    s.startsWith('https:') ||
    s.startsWith('data:') ||
    s.startsWith('blob:')
  ) {
    return false;
  }
  if (s.startsWith('file://')) return true;
  if (s.startsWith('/') && !s.startsWith('//')) return true;
  if (/^[A-Za-z]:[\\/]/.test(s)) return true;
  return false;
}

export interface UseMdAssetUrlOptions {
  /** 节点 attrs 中的原始 URL */
  getRawUrl: () => string;
  /** 解析为 local-asset 后写回节点（如 importLocalPath） */
  onImport?: (url: string, localAssetUrl: string, fileId?: string) => void;
}

/**
 * 将 image/video/audio/attachment 的 src/url 解析为可渲染 URL：
 * - 相对路径 → resolveDocAssetUrl（仅渲染，不写回节点）
 * - 本地绝对路径 → importLocalPath（可选写回节点）
 */
export function useMdAssetUrl(options: UseMdAssetUrlOptions) {
  const mdDocPath = inject<Ref<string | null>>('mdDocPath', ref(null));
  const renderUrl = ref('');
  let importingPath = '';
  let resolveGen = 0;

  async function resolveUrl(raw: string) {
    const gen = ++resolveGen;

    if (!raw) {
      renderUrl.value = '';
      return;
    }

    if (isRelativeAssetPath(raw)) {
      const docPath = mdDocPath?.value;
      if (docPath && window.electron?.resolveDocAssetUrl) {
        try {
          const url = await window.electron.resolveDocAssetUrl({ docPath, assetPath: raw });
          if (gen !== resolveGen) return;
          if (url) {
            renderUrl.value = url;
            return;
          }
        } catch {
          if (gen !== resolveGen) return;
        }
      }
      // Electron 内相对路径不能作为 src（会相对 app URL 解析）；等 docPath 就绪后重试
      if (window.electron?.resolveDocAssetUrl) {
        renderUrl.value = '';
        return;
      }
      renderUrl.value = raw;
      return;
    }

    renderUrl.value = raw;

    if (isLocalAbsolutePath(raw) && window.electron?.importLocalPath && options.onImport) {
      if (importingPath === raw) return;
      importingPath = raw;
      try {
        const result = await window.electron.importLocalPath(raw);
        if (result && importingPath === raw) {
          options.onImport(raw, result.url, result.id);
          renderUrl.value = result.url;
        }
      } catch {
        /* ignore */
      } finally {
        if (importingPath === raw) importingPath = '';
      }
    }
  }

  watch(
    () => [options.getRawUrl(), mdDocPath?.value] as const,
    ([url]) => {
      void resolveUrl(url || '');
    },
    { immediate: true },
  );

  return { renderUrl, resolveUrl };
}
