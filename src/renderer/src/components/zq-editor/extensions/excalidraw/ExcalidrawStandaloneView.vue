<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCw } from '@/components/icons';
import {
  parseExcalidrawHostMessage,
  mapAppLocaleToExcalidrawLangCode,
  postExcalidrawLoad,
  postExcalidrawFlushSave,
  postExcalidrawNotifyLayout,
  postExcalidrawSetLang,
} from './excalidraw-embed';
import { persistDiagramPreviewDataUrl } from '../../utils/diagram-preview-asset';

const { t, locale } = useI18n();

const token = ref(
  new URLSearchParams(window.location.search).get('excalidrawToken') || '',
);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const iframeSrc = ref('');
const iframeKey = ref(0);
const bundleError = ref(false);

const pendingDoneAfterSave = ref(false);
let saveBeforeExportTimer: ReturnType<typeof setTimeout> | null = null;

const sessionScene = ref('');
/** 回写文档块缩略图用，不在本窗口内展示 */
const sessionPreview = ref('');

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function notifyExcalidrawLayout() {
  const w = iframeRef.value?.contentWindow;
  if (!w) return;
  postExcalidrawNotifyLayout(w);
  const bumpResize = () => {
    try {
      w.dispatchEvent(new Event('resize'));
      w.document?.defaultView?.dispatchEvent(new Event('resize'));
    } catch {
      /* ignore */
    }
  };
  bumpResize();
  requestAnimationFrame(bumpResize);
  setTimeout(bumpResize, 50);
  setTimeout(bumpResize, 200);
}

function handleEmbedMessage(ev: MessageEvent) {
  const iframe = iframeRef.value;
  if (!iframe?.contentWindow || ev.source !== iframe.contentWindow) return;

  const data = parseExcalidrawHostMessage(ev.data);
  if (!data) return;

  if (data.type === 'ready') {
    const scene =
      sessionScene.value.trim().length > 0 ? sessionScene.value : null;
    postExcalidrawLoad(iframe.contentWindow!, {
      scene,
      theme: isDarkTheme() ? 'dark' : 'light',
      openMode: 'edit',
      langCode: mapAppLocaleToExcalidrawLangCode(locale.value),
    });
    return;
  }

  if (data.type !== 'save' || typeof data.scene !== 'string') return;

  sessionScene.value = data.scene;
  if (typeof data.preview === 'string' && data.preview.startsWith('data:')) {
    sessionPreview.value = data.preview;
  }

  if (pendingDoneAfterSave.value && iframe.contentWindow) {
    pendingDoneAfterSave.value = false;
    if (saveBeforeExportTimer != null) {
      clearTimeout(saveBeforeExportTimer);
      saveBeforeExportTimer = null;
    }
    void commitAndClose(data.scene, sessionPreview.value);
  }
}

function onWindowMessage(ev: MessageEvent) {
  handleEmbedMessage(ev);
}

async function commitAndClose(scene: string, preview: string) {
  const api = window.electron;
  if (!api?.excalidrawStandaloneCommit || !token.value) {
    api?.windowClose?.();
    return;
  }
  const previewRef = await persistDiagramPreviewDataUrl(preview);
  await api.excalidrawStandaloneCommit({
    scene,
    preview: previewRef,
    token: token.value,
  });
  api.windowClose?.();
}

function onDone() {
  const w = iframeRef.value?.contentWindow;
  if (!w || !iframeSrc.value) {
    window.electron?.windowClose?.();
    return;
  }
  pendingDoneAfterSave.value = true;
  saveBeforeExportTimer = setTimeout(() => {
    saveBeforeExportTimer = null;
    if (!pendingDoneAfterSave.value) return;
    pendingDoneAfterSave.value = false;
    void commitAndClose(sessionScene.value, sessionPreview.value);
  }, 1200);
  postExcalidrawFlushSave(w);
}

function onEditorIframeLoad() {
  void nextTick().then(() => notifyExcalidrawLayout());
}

async function loadStandaloneExcalidraw() {
  bundleError.value = false;
  const api = window.electron;
  if (!api?.getExcalidrawIndexUrl || !api.getExcalidrawStandaloneInitial) {
    bundleError.value = true;
    iframeSrc.value = '';
    return;
  }
  const initial = await api.getExcalidrawStandaloneInitial();
  if (!initial || initial.token !== token.value) {
    bundleError.value = true;
    iframeSrc.value = '';
    return;
  }
  sessionScene.value = initial.scene || '';
  sessionPreview.value = '';
  const base = await api.getExcalidrawIndexUrl();
  if (!base) {
    bundleError.value = true;
    iframeSrc.value = '';
    return;
  }
  iframeKey.value += 1;
  const sep = base.includes('?') ? '&' : '?';
  iframeSrc.value = `${base}${sep}_zq_ex_sa=${Date.now()}`;
}

onMounted(async () => {
  window.addEventListener('message', onWindowMessage, false);
  await loadStandaloneExcalidraw();
});

watch(
  () => locale.value,
  () => {
    if (!iframeSrc.value || bundleError.value) return;
    const w = iframeRef.value?.contentWindow;
    if (!w) return;
    postExcalidrawSetLang(w, mapAppLocaleToExcalidrawLangCode(locale.value));
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('message', onWindowMessage, false);
  if (saveBeforeExportTimer != null) clearTimeout(saveBeforeExportTimer);
});
</script>

<template>
  <div class="zq-excalidraw-standalone">
    <div class="zq-excalidraw-standalone__header">
      <span class="zq-excalidraw-standalone__title">{{ t('zq-editor.excalidraw.title') }}</span>
      <div class="zq-excalidraw-standalone__actions">
        <button
          type="button"
          class="zq-excalidraw-standalone__done"
          :disabled="!iframeSrc || bundleError"
          @click="onDone"
        >
          {{ t('zq-editor.excalidraw.done') }}
        </button>
      </div>
    </div>
    <div v-if="bundleError" class="zq-excalidraw-standalone__error">
      <div class="zq-excalidraw-standalone__error-row">
        <span class="zq-excalidraw-standalone__error-text">{{
          t('zq-editor.excalidraw.missingBundle')
        }}</span>
        <button
          type="button"
          class="zq-excalidraw-standalone__error-refresh"
          :title="t('zq-editor.excalidraw.refreshBundle')"
          @click="loadStandaloneExcalidraw"
        >
          <RotateCw class="zq-excalidraw-standalone__error-refresh-icon" />
        </button>
      </div>
    </div>
    <div v-else class="zq-excalidraw-standalone__body">
      <iframe
        v-if="iframeSrc"
        :key="iframeKey"
        ref="iframeRef"
        class="zq-excalidraw-standalone__iframe"
        :src="iframeSrc"
        title="Excalidraw"
        sandbox="allow-scripts allow-popups allow-forms allow-modals allow-downloads allow-presentation"
        referrerpolicy="no-referrer"
        @load="onEditorIframeLoad"
      />
    </div>
  </div>
</template>

<style scoped>
.zq-excalidraw-standalone {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-editor);
  overflow: hidden;
}

.zq-excalidraw-standalone__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 8px 16px;
  padding-left: 80px;
  background: #f5f5f5;
  border-bottom: 1px solid #e8e8e8;
  -webkit-app-region: drag;
}

.zq-excalidraw-standalone__header button,
.zq-excalidraw-standalone__actions {
  -webkit-app-region: no-drag;
}

.zq-excalidraw-standalone__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.zq-excalidraw-standalone__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zq-excalidraw-standalone__done {
  padding: 4px 14px;
  border: none;
  border-radius: 6px;
  background: var(--accent-color);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.zq-excalidraw-standalone__done:hover:not(:disabled) {
  opacity: 0.85;
}

.zq-excalidraw-standalone__done:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zq-excalidraw-standalone__error {
  padding: 16px;
  flex: 1;
  display: flex;
  align-items: flex-start;
}

.zq-excalidraw-standalone__error-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-active);
  max-width: 100%;
}

.zq-excalidraw-standalone__error-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.zq-excalidraw-standalone__error-refresh {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.zq-excalidraw-standalone__error-refresh:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-excalidraw-standalone__error-refresh-icon {
  width: 16px;
  height: 16px;
}

.zq-excalidraw-standalone__body {
  flex: 1;
  min-height: 0;
  position: relative;
  background: var(--bg-editor);
}

.zq-excalidraw-standalone__iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-editor);
}

html[data-theme='dark'] .zq-excalidraw-standalone__header {
  background: #2c2c2c;
  border-bottom-color: #404040;
}
</style>
