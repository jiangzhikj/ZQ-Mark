<script setup lang="ts">
import {
  ref,
  computed,
  inject,
  onMounted,
  onBeforeUnmount,
  nextTick,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { Eye, Pencil, RotateCw } from '@/components/icons';
import {
  DRAWIO_UI_LAYOUT_INJECT_KEY,
  buildDrawioEmbedUrl,
  buildDrawioViewerEmbedUrl,
  parseDrawioMessage,
  getLoadXmlForDrawio,
  isDrawioDiagramXml,
  postDrawioEmbedInvokeSave,
  type DrawioUiLayout,
} from './drawio-embed';

const { t, locale } = useI18n();

const injectedDrawioUiLayout = inject(DRAWIO_UI_LAYOUT_INJECT_KEY);

function resolvedDrawioUiLayout(): DrawioUiLayout {
  const v = injectedDrawioUiLayout?.value;
  return v === 'minimal' ? 'minimal' : 'full';
}

const token = ref(
  new URLSearchParams(window.location.search).get('drawioToken') || '',
);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const standalonePreviewIframeRef = ref<HTMLIFrameElement | null>(null);
const iframeSrc = ref('');
const standalonePreviewIframeSrc = ref('');
const indexBaseUrl = ref<string | null>(null);
const bundleError = ref(false);
let drawioLoadSentForSession = false;
let standalonePreviewLoadSentForSession = false;

/** 独立窗口：编辑 | 预览 */
const layerMode = ref<'edit' | 'preview'>('edit');
const pendingPreviewAfterSave = ref(false);

const closeAfterExportPending = ref(false);
let closeExportTimer: ReturnType<typeof setTimeout> | null = null;

const pendingDoneAfterSave = ref(false);
let saveBeforeExportTimer: ReturnType<typeof setTimeout> | null = null;

const sessionXml = ref('');

const hasDiagram = computed(() => isDrawioDiagramXml(sessionXml.value));

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function notifyDrawioLayout() {
  const w = iframeRef.value?.contentWindow;
  if (!w) return;
  try {
    w.postMessage(
      JSON.stringify({ action: 'fullscreenChanged', value: true }),
      '*',
    );
  } catch {
    /* ignore */
  }
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

function notifyStandalonePreviewLayout() {
  const w = standalonePreviewIframeRef.value?.contentWindow;
  if (!w) return;
  try {
    w.postMessage(
      JSON.stringify({ action: 'fullscreenChanged', value: true }),
      '*',
    );
  } catch {
    /* ignore */
  }
  const bump = () => {
    try {
      w.dispatchEvent(new Event('resize'));
      w.document?.defaultView?.dispatchEvent(new Event('resize'));
    } catch {
      /* ignore */
    }
  };
  bump();
  requestAnimationFrame(bump);
  setTimeout(bump, 50);
  setTimeout(bump, 200);
}

function setupStandalonePreview() {
  standalonePreviewLoadSentForSession = false;
  if (!indexBaseUrl.value || !hasDiagram.value) {
    standalonePreviewIframeSrc.value = '';
    return;
  }
  const u = buildDrawioViewerEmbedUrl(indexBaseUrl.value, {
    dark: isDarkTheme(),
    appLocale: locale.value,
  });
  standalonePreviewIframeSrc.value = `${u}${u.includes('?') ? '&' : '?'}_zq_sa=${Date.now()}`;
}

function handleStandalonePreviewEmbedMessage(ev: MessageEvent) {
  const iframe = standalonePreviewIframeRef.value;
  if (!iframe?.contentWindow || ev.source !== iframe.contentWindow) return;

  const data = parseDrawioMessage(ev.data);
  if (!data) return;

  if (data.event === 'init') {
    if (standalonePreviewLoadSentForSession) return;
    standalonePreviewLoadSentForSession = true;
    const xml = getLoadXmlForDrawio(sessionXml.value);
    iframe.contentWindow?.postMessage(
      JSON.stringify({ action: 'load', xml }),
      '*',
    );
  }
}

function onStandalonePreviewIframeLoad() {
  void nextTick().then(() => notifyStandalonePreviewLayout());
}

function switchStandaloneToEdit() {
  if (layerMode.value === 'edit') return;
  layerMode.value = 'edit';
  void nextTick().then(() => {
    notifyDrawioLayout();
    requestAnimationFrame(() => notifyDrawioLayout());
    setTimeout(() => notifyDrawioLayout(), 120);
  });
}

function switchStandaloneToPreview() {
  if (layerMode.value === 'preview') return;
  const w = iframeRef.value?.contentWindow;
  if (!w || !iframeSrc.value) return;
  pendingPreviewAfterSave.value = true;
  postDrawioEmbedInvokeSave(w);
}

function onWindowMessage(ev: MessageEvent) {
  handleEmbedMessage(ev);
  handleStandalonePreviewEmbedMessage(ev);
}

function handleEmbedMessage(ev: MessageEvent) {
  const iframe = iframeRef.value;
  if (!iframe?.contentWindow || ev.source !== iframe.contentWindow) return;

  const data = parseDrawioMessage(ev.data);
  if (!data) return;

  if (data.event === 'init') {
    if (drawioLoadSentForSession) return;
    drawioLoadSentForSession = true;
    const xml = getLoadXmlForDrawio(sessionXml.value);
    iframe.contentWindow?.postMessage(
      JSON.stringify({ action: 'load', xml }),
      '*',
    );
    return;
  }

  if (
    data.event === 'save' &&
    typeof data.xml === 'string' &&
    isDrawioDiagramXml(data.xml)
  ) {
    sessionXml.value = data.xml;
    if (pendingPreviewAfterSave.value && iframe.contentWindow) {
      pendingPreviewAfterSave.value = false;
      layerMode.value = 'preview';
      setupStandalonePreview();
      void nextTick(() => notifyStandalonePreviewLayout());
      return;
    }
    if (pendingDoneAfterSave.value && iframe.contentWindow) {
      pendingDoneAfterSave.value = false;
      if (saveBeforeExportTimer != null) {
        clearTimeout(saveBeforeExportTimer);
        saveBeforeExportTimer = null;
      }
      closeAfterExportPending.value = true;
      iframe.contentWindow.postMessage(
        JSON.stringify({ action: 'export', format: 'svg' }),
        '*',
      );
      closeExportTimer = setTimeout(() => {
        closeExportTimer = null;
        if (closeAfterExportPending.value) {
          closeAfterExportPending.value = false;
          window.electron?.windowClose?.();
        }
      }, 8000);
    }
    return;
  }

  if (
    data.event === 'export' &&
    data.format === 'svg' &&
    typeof data.data === 'string' &&
    data.data.startsWith('data:') &&
    typeof data.xml === 'string' &&
    isDrawioDiagramXml(data.xml)
  ) {
    if (closeAfterExportPending.value) {
      void commitAndClose(data.xml, data.data);
    }
  }
}

async function commitAndClose(xml: string, preview: string) {
  closeAfterExportPending.value = false;
  if (closeExportTimer != null) {
    clearTimeout(closeExportTimer);
    closeExportTimer = null;
  }
  const api = window.electron;
  if (!api?.drawioStandaloneCommit || !token.value) {
    api?.windowClose?.();
    return;
  }
  await api.drawioStandaloneCommit({
    xml,
    preview,
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
    closeAfterExportPending.value = true;
    w.postMessage(JSON.stringify({ action: 'export', format: 'svg' }), '*');
    closeExportTimer = setTimeout(() => {
      closeExportTimer = null;
      if (closeAfterExportPending.value) {
        closeAfterExportPending.value = false;
        window.electron?.windowClose?.();
      }
    }, 8000);
  }, 1200);
  postDrawioEmbedInvokeSave(w);
}

function onEditorIframeLoad() {
  void nextTick().then(() => notifyDrawioLayout());
}

watch(
  () => sessionXml.value,
  () => {
    standalonePreviewLoadSentForSession = false;
  },
);

async function loadStandaloneDrawio() {
  bundleError.value = false;
  const api = window.electron;
  if (!api?.getDrawioIndexUrl || !api.getDrawioStandaloneInitial) {
    bundleError.value = true;
    iframeSrc.value = '';
    standalonePreviewIframeSrc.value = '';
    return;
  }
  const initial = await api.getDrawioStandaloneInitial();
  if (!initial || initial.token !== token.value) {
    bundleError.value = true;
    iframeSrc.value = '';
    standalonePreviewIframeSrc.value = '';
    return;
  }
  sessionXml.value = initial.xml;
  const base = await api.getDrawioIndexUrl();
  indexBaseUrl.value = base;
  if (!base) {
    bundleError.value = true;
    iframeSrc.value = '';
    standalonePreviewIframeSrc.value = '';
    return;
  }
  drawioLoadSentForSession = false;
  const url = buildDrawioEmbedUrl(base, {
    dark: isDarkTheme(),
    uiLayout: resolvedDrawioUiLayout(),
    appLocale: locale.value,
  });
  iframeSrc.value = `${url}${url.includes('?') ? '&' : '?'}_zq_st=${Date.now()}`;
}

onMounted(async () => {
  window.addEventListener('message', onWindowMessage, false);
  await loadStandaloneDrawio();
});

onBeforeUnmount(() => {
  window.removeEventListener('message', onWindowMessage, false);
  if (closeExportTimer != null) clearTimeout(closeExportTimer);
  if (saveBeforeExportTimer != null) clearTimeout(saveBeforeExportTimer);
});
</script>

<template>
  <div class="zq-drawio-standalone">
    <div class="zq-drawio-standalone__header">
      <span class="zq-drawio-standalone__title">{{ t('zq-editor.drawio.title') }}</span>
      <div class="zq-drawio-standalone__actions">
        <button
          type="button"
          class="zq-drawio-standalone__icon-btn"
          :class="{ 'is-active': layerMode === 'edit' }"
          :disabled="!iframeSrc || bundleError"
          :title="t('zq-editor.drawio.switchToEdit')"
          @click="switchStandaloneToEdit"
        >
          <Pencil class="zq-drawio-standalone__icon-btn-svg" />
        </button>
        <button
          type="button"
          class="zq-drawio-standalone__icon-btn"
          :class="{ 'is-active': layerMode === 'preview' }"
          :disabled="!iframeSrc || bundleError"
          :title="t('zq-editor.drawio.switchToPreview')"
          @click="switchStandaloneToPreview"
        >
          <Eye class="zq-drawio-standalone__icon-btn-svg" />
        </button>
        <button
          type="button"
          class="zq-drawio-standalone__done"
          :disabled="!iframeSrc || bundleError"
          @click="onDone"
        >
          {{ t('zq-editor.drawio.done') }}
        </button>
      </div>
    </div>
    <div v-if="bundleError" class="zq-drawio-standalone__error">
      <div class="zq-drawio-standalone__error-row">
        <span class="zq-drawio-standalone__error-text">{{
          t('zq-editor.drawio.missingBundle')
        }}</span>
        <button
          type="button"
          class="zq-drawio-standalone__error-refresh"
          :title="t('zq-editor.drawio.refreshBundle')"
          @click="loadStandaloneDrawio"
        >
          <RotateCw class="zq-drawio-standalone__error-refresh-icon" />
        </button>
      </div>
    </div>
    <div v-else class="zq-drawio-standalone__body">
      <div
        class="zq-drawio-standalone__pane"
        :class="
          layerMode === 'edit'
            ? 'zq-drawio-standalone__layer-front'
            : 'zq-drawio-standalone__layer-back'
        "
      >
        <iframe
          v-if="iframeSrc"
          ref="iframeRef"
          class="zq-drawio-standalone__iframe"
          :src="iframeSrc"
          title="draw.io"
          sandbox="allow-scripts allow-popups allow-forms allow-modals allow-downloads allow-presentation"
          referrerpolicy="no-referrer"
          @load="onEditorIframeLoad"
        />
      </div>
      <div
        class="zq-drawio-standalone__pane zq-drawio-standalone__pane--preview"
        :class="
          layerMode === 'preview'
            ? 'zq-drawio-standalone__layer-front'
            : 'zq-drawio-standalone__layer-back'
        "
      >
        <iframe
          v-if="standalonePreviewIframeSrc && hasDiagram"
          ref="standalonePreviewIframeRef"
          class="zq-drawio-standalone__preview-iframe"
          :src="standalonePreviewIframeSrc"
          title="draw.io preview"
          sandbox="allow-scripts allow-popups allow-forms allow-modals allow-downloads allow-presentation"
          referrerpolicy="no-referrer"
          @load="onStandalonePreviewIframeLoad"
        />
        <div
          v-else
          class="zq-drawio-standalone__preview-empty"
        >
          {{ t('zq-editor.drawio.previewEmpty') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.zq-drawio-standalone {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-editor);
  overflow: hidden;
}

/* 与 draw.io 工具栏背景一致 */
.zq-drawio-standalone__header {
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

.zq-drawio-standalone__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.zq-drawio-standalone__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.zq-drawio-standalone__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.zq-drawio-standalone__icon-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-drawio-standalone__icon-btn.is-active {
  background: color-mix(in srgb, var(--accent-color) 18%, transparent);
  color: var(--accent-color);
}

.zq-drawio-standalone__icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zq-drawio-standalone__icon-btn-svg {
  width: 16px;
  height: 16px;
}

.zq-drawio-standalone__done {
  -webkit-app-region: no-drag;
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

.zq-drawio-standalone__done:hover:not(:disabled) {
  opacity: 0.85;
}

.zq-drawio-standalone__done:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zq-drawio-standalone__error {
  padding: 24px;
  font-size: 13px;
  color: var(--text-muted);
}

.zq-drawio-standalone__error-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.zq-drawio-standalone__error-text {
  flex: 1;
  min-width: 0;
  line-height: 1.5;
}

.zq-drawio-standalone__error-refresh {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: -4px -4px 0 0;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.zq-drawio-standalone__error-refresh:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-drawio-standalone__error-refresh-icon {
  width: 16px;
  height: 16px;
}

.zq-drawio-standalone__body {
  flex: 1;
  min-height: 0;
  position: relative;
  background: var(--bg-editor);
}

.zq-drawio-standalone__pane {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* 与 DrawioBlockComponent：避免 display:none 使编辑 iframe 宽高为 0 */
.zq-drawio-standalone__layer-back {
  visibility: hidden;
  pointer-events: none;
  z-index: 1;
}

.zq-drawio-standalone__layer-front {
  visibility: visible;
  pointer-events: auto;
  z-index: 2;
}

.zq-drawio-standalone__pane--preview {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-editor);
}

.zq-drawio-standalone__preview-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-editor);
}

.zq-drawio-standalone__preview-empty {
  padding: 24px;
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: center;
}

.zq-drawio-standalone__iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-editor);
}

html[data-theme='dark'] .zq-drawio-standalone__header {
  background: #2c2c2c;
  border-bottom-color: #404040;
}
</style>
