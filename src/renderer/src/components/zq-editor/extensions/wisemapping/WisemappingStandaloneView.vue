<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDown, RotateCw } from '@/components/icons';
import {
  parseWisemappingHostMessage,
  mapAppLocaleToWisemappingLocale,
  postWisemappingLoad,
  postWisemappingFlushSave,
  postWisemappingNotifyLayout,
  postWisemappingSetTheme,
  postWisemappingExportImage,
} from './wisemapping-embed';
import { persistDiagramPreviewDataUrl } from '../../utils/diagram-preview-asset';

const { t, locale } = useI18n();

const token = ref(
  new URLSearchParams(window.location.search).get('wisemappingToken') || '',
);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const iframeSrc = ref('');
const iframeKey = ref(0);
const bundleError = ref(false);
const isMac = ref(false);

const pendingDoneAfterSave = ref(false);
let saveBeforeExportTimer: ReturnType<typeof setTimeout> | null = null;

const sessionMapXml = ref('');
const sessionPreview = ref('');

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function notifyWisemappingLayout() {
  const w = iframeRef.value?.contentWindow;
  if (!w) return;
  postWisemappingNotifyLayout(w);
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

  const data = parseWisemappingHostMessage(ev.data);
  if (!data) return;

  if (data.type === 'ready') {
    const mapXml =
      sessionMapXml.value.trim().length > 0 ? sessionMapXml.value : null;
    postWisemappingLoad(iframe.contentWindow!, {
      mapXml,
      theme: isDarkTheme() ? 'dark' : 'light',
      openMode: 'edit',
      locale: mapAppLocaleToWisemappingLocale(locale.value),
    });
    return;
  }

  if (data.type !== 'save' || typeof data.mapXml !== 'string') return;

  sessionMapXml.value = data.mapXml;
  if (typeof data.preview === 'string' && data.preview.startsWith('data:')) {
    sessionPreview.value = data.preview;
  }

  if (pendingDoneAfterSave.value && iframe.contentWindow) {
    pendingDoneAfterSave.value = false;
    if (saveBeforeExportTimer != null) {
      clearTimeout(saveBeforeExportTimer);
      saveBeforeExportTimer = null;
    }
    void commitAndClose(data.mapXml, sessionPreview.value);
  }
}

function onWindowMessage(ev: MessageEvent) {
  handleEmbedMessage(ev);
}

async function commitAndClose(mapXml: string, preview: string) {
  const api = window.electron;
  if (!api?.wisemappingStandaloneCommit || !token.value) {
    api?.windowClose?.();
    return;
  }
  const previewRef = await persistDiagramPreviewDataUrl(preview);
  await api.wisemappingStandaloneCommit({
    mapXml,
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
    void commitAndClose(sessionMapXml.value, sessionPreview.value);
  }, 1200);
  postWisemappingFlushSave(w);
}

function onEditorIframeLoad() {
  void nextTick().then(() => notifyWisemappingLayout());
}

const exportMenuDetailsRef = ref<HTMLDetailsElement | null>(null);

function exportFromEmbed(format: 'png' | 'svg') {
  const w = iframeRef.value?.contentWindow;
  if (!w || !iframeSrc.value || bundleError.value) return;
  postWisemappingExportImage(w, format);
}

function pickStandaloneExport(format: 'png' | 'svg') {
  exportMenuDetailsRef.value?.removeAttribute('open');
  exportFromEmbed(format);
}

async function loadStandaloneWisemapping() {
  bundleError.value = false;
  const api = window.electron;
  if (!api?.getWisemappingIndexUrl || !api.getWisemappingStandaloneInitial) {
    bundleError.value = true;
    iframeSrc.value = '';
    return;
  }
  const initial = await api.getWisemappingStandaloneInitial();
  if (!initial || initial.token !== token.value) {
    bundleError.value = true;
    iframeSrc.value = '';
    return;
  }
  sessionMapXml.value = initial.mapXml || '';
  sessionPreview.value = '';
  const base = await api.getWisemappingIndexUrl();
  if (!base) {
    bundleError.value = true;
    iframeSrc.value = '';
    return;
  }
  iframeKey.value += 1;
  const sep = base.includes('?') ? '&' : '?';
  iframeSrc.value = `${base}${sep}_zq_wm_sa=${Date.now()}`;
}

onMounted(async () => {
  window.addEventListener('message', onWindowMessage, false);
  try {
    const platform = await window.electron.getPlatform();
    isMac.value = platform === 'darwin';
  } catch {
    isMac.value = false;
  }
  await loadStandaloneWisemapping();
});

watch(
  () => locale.value,
  () => {
    if (!iframeSrc.value || bundleError.value) return;
    const w = iframeRef.value?.contentWindow;
    if (!w) return;
    postWisemappingSetTheme(w, isDarkTheme() ? 'dark' : 'light');
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('message', onWindowMessage, false);
  if (saveBeforeExportTimer != null) clearTimeout(saveBeforeExportTimer);
});
</script>

<template>
  <div class="zq-wisemapping-standalone">
    <div
      class="zq-wisemapping-standalone__header"
      :class="{ 'zq-wisemapping-standalone__header--mac': isMac }"
    >
      <span class="zq-wisemapping-standalone__title">{{ t('zq-editor.wisemapping.title') }}</span>
      <div class="zq-wisemapping-standalone__actions">
        <details
          ref="exportMenuDetailsRef"
          class="zq-wisemapping-standalone__export-dropdown"
          :class="{ 'zq-wisemapping-standalone__export-dropdown--disabled': !iframeSrc || bundleError }"
        >
          <summary
            class="zq-wisemapping-standalone__export-summary"
            :title="t('zq-editor.wisemapping.export')"
          >
            <span>{{ t('zq-editor.wisemapping.export') }}</span>
            <ChevronDown class="zq-wisemapping-standalone__export-chevron" :size="16" :stroke-width="2" />
          </summary>
          <div class="zq-wisemapping-standalone__export-panel">
            <button
              type="button"
              class="zq-wisemapping-standalone__export-item"
              :disabled="!iframeSrc || bundleError"
              :title="t('zq-editor.wisemapping.exportPng')"
              @click="pickStandaloneExport('png')"
            >
              PNG
            </button>
            <button
              type="button"
              class="zq-wisemapping-standalone__export-item"
              :disabled="!iframeSrc || bundleError"
              :title="t('zq-editor.wisemapping.exportSvg')"
              @click="pickStandaloneExport('svg')"
            >
              SVG
            </button>
          </div>
        </details>
        <button
          type="button"
          class="zq-wisemapping-standalone__done"
          :disabled="!iframeSrc || bundleError"
          @click="onDone"
        >
          {{ t('zq-editor.wisemapping.done') }}
        </button>
      </div>
    </div>
    <div v-if="bundleError" class="zq-wisemapping-standalone__error">
      <div class="zq-wisemapping-standalone__error-row">
        <span class="zq-wisemapping-standalone__error-text">{{
          t('zq-editor.wisemapping.missingBundle')
        }}</span>
        <button
          type="button"
          class="zq-wisemapping-standalone__error-refresh"
          :title="t('zq-editor.wisemapping.refreshBundle')"
          @click="loadStandaloneWisemapping"
        >
          <RotateCw class="zq-wisemapping-standalone__error-refresh-icon" />
        </button>
      </div>
    </div>
    <div v-else class="zq-wisemapping-standalone__body">
      <iframe
        v-if="iframeSrc"
        :key="iframeKey"
        ref="iframeRef"
        class="zq-wisemapping-standalone__iframe"
        :src="iframeSrc"
        title="WiseMapping"
        sandbox="allow-scripts allow-popups allow-forms allow-modals allow-downloads allow-presentation"
        referrerpolicy="no-referrer"
        @load="onEditorIframeLoad"
      />
    </div>
  </div>
</template>

<style scoped>
.zq-wisemapping-standalone {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-editor);
  overflow: hidden;
}

.zq-wisemapping-standalone__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 8px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e8e8e8;
  -webkit-app-region: drag;
}

.zq-wisemapping-standalone__header--mac {
  padding-left: 80px;
}

.zq-wisemapping-standalone__header button,
.zq-wisemapping-standalone__actions {
  -webkit-app-region: no-drag;
}

.zq-wisemapping-standalone__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.zq-wisemapping-standalone__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zq-wisemapping-standalone__export-dropdown {
  position: relative;
}

.zq-wisemapping-standalone__export-dropdown--disabled .zq-wisemapping-standalone__export-summary {
  pointer-events: none;
  opacity: 0.5;
}

.zq-wisemapping-standalone__export-summary {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 10px;
  list-style: none;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-sidebar);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.zq-wisemapping-standalone__export-summary::-webkit-details-marker {
  display: none;
}

.zq-wisemapping-standalone__export-summary:hover {
  background: var(--bg-hover);
}

.zq-wisemapping-standalone__export-chevron {
  flex-shrink: 0;
  opacity: 0.75;
  transition: transform 0.15s ease;
}

.zq-wisemapping-standalone__export-dropdown[open] .zq-wisemapping-standalone__export-chevron {
  transform: rotate(180deg);
}

.zq-wisemapping-standalone__export-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 100;
  min-width: 112px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-sidebar);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.zq-wisemapping-standalone__export-item {
  display: block;
  width: 100%;
  box-sizing: border-box;
  text-align: left;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.zq-wisemapping-standalone__export-item:hover:not(:disabled) {
  background: var(--bg-hover);
}

.zq-wisemapping-standalone__export-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zq-wisemapping-standalone__done {
  padding: 4px 14px;
  border: none;
  border-radius: 6px;
  background: var(--accent-color);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}

.zq-wisemapping-standalone__done:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zq-wisemapping-standalone__error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.zq-wisemapping-standalone__error-row {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 480px;
}

.zq-wisemapping-standalone__error-text {
  font-size: 13px;
  color: var(--text-muted);
}

.zq-wisemapping-standalone__error-refresh {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  cursor: pointer;
}

.zq-wisemapping-standalone__error-refresh-icon {
  width: 16px;
  height: 16px;
}

.zq-wisemapping-standalone__body {
  flex: 1;
  min-height: 0;
}

.zq-wisemapping-standalone__iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
