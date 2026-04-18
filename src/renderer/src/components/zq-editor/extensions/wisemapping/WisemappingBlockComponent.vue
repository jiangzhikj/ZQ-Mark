<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from 'vue';
import { nanoid } from 'nanoid';
import { NodeViewWrapper } from '@tiptap/vue-3';
import { useI18n } from 'vue-i18n';
import { ChevronDown, ExternalLink, Pencil, RotateCw, Trash2, Workflow } from '@/components/icons';
import {
  parseWisemappingHostMessage,
  hasWisemappingMapXml,
  resolveMapXmlForWisemapping,
  mapAppLocaleToWisemappingLocale,
  postWisemappingLoad,
  postWisemappingFlushSave,
  postWisemappingNotifyLayout,
  postWisemappingSetTheme,
  postWisemappingExportImage,
} from './wisemapping-embed';
import {
  persistDiagramPreviewDataUrl,
  diagramPreviewSrc,
  persistDiagramTextAsset,
} from '../../utils/diagram-preview-asset';

const WISEMAPPING_DIALOG_ROOT_CLASS = 'zq-wisemapping-dialog-fullscreen-open';

const { locale } = useI18n();

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  deleteNode: () => void;
  selected: boolean;
  editor: any;
}>();

const editing = ref(false);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const iframeSrc = ref('');
const iframeKey = ref(0);
const indexBaseUrl = ref<string | null>(null);
const bundleError = ref(false);
const isWebPlatform = ref(false);
const isMac = ref(false);

const pendingCloseAfterSave = ref(false);
let saveBeforeExportTimer: ReturnType<typeof setTimeout> | null = null;

const loadOpenMode = ref<'edit' | 'view'>('edit');

const standaloneToken = ref('');
const pendingStandaloneToken = ref<string | null>(null);
let standaloneExportTimer: ReturnType<typeof setTimeout> | null = null;

const storedMapXml = computed(() =>
  typeof props.node.attrs.mapXml === 'string' ? props.node.attrs.mapXml : '',
);

const previewDataUrl = computed(() =>
  diagramPreviewSrc(props.node.attrs.preview),
);

const hasMap = computed(() => hasWisemappingMapXml(storedMapXml.value));

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function resetEditorState() {
  editing.value = false;
  iframeSrc.value = '';
  pendingCloseAfterSave.value = false;
  if (saveBeforeExportTimer != null) {
    clearTimeout(saveBeforeExportTimer);
    saveBeforeExportTimer = null;
  }
}

async function finishOpenStandaloneFromEditor(mapXml: string, tok: string) {
  const api = window.electron;
  if (!api?.openWisemappingStandalone) return;
  standaloneToken.value = tok;
  await api.openWisemappingStandalone({ mapXml, token: tok });
  resetEditorState();
}

async function openStandaloneFromBlockView(tok: string) {
  const api = window.electron;
  if (!api?.openWisemappingStandalone) return;
  standaloneToken.value = tok;
  const mapXml = await resolveMapXmlForWisemapping(storedMapXml.value);
  await api.openWisemappingStandalone({
    mapXml,
    token: tok,
  });
}

async function openInStandaloneWindow() {
  if (isWebPlatform.value || bundleError.value) return;
  if (!window.electron?.openWisemappingStandalone) return;
  const tok = nanoid();
  const w = iframeRef.value?.contentWindow;
  if (editing.value && w && iframeSrc.value) {
    pendingStandaloneToken.value = tok;
    postWisemappingFlushSave(w);
    standaloneExportTimer = setTimeout(() => {
      standaloneExportTimer = null;
      if (!pendingStandaloneToken.value) return;
      pendingStandaloneToken.value = null;
      void (async () => {
        const mapXml = await resolveMapXmlForWisemapping(storedMapXml.value);
        void finishOpenStandaloneFromEditor(mapXml, tok);
      })();
    }, 2000);
    return;
  }
  await openStandaloneFromBlockView(tok);
}

function handleEditorEmbedMessage(ev: MessageEvent) {
  const iframe = iframeRef.value;
  if (!iframe?.contentWindow || ev.source !== iframe.contentWindow) return;

  const data = parseWisemappingHostMessage(ev.data);
  if (!data) return;

  if (
    pendingStandaloneToken.value &&
    data.type === 'save' &&
    typeof data.mapXml === 'string'
  ) {
    void (async () => {
      const mapStored = await persistDiagramTextAsset(data.mapXml, '.xml');
      const attrs: Record<string, any> = { mapXml: mapStored };
      if (typeof data.preview === 'string' && data.preview.startsWith('data:')) {
        attrs.preview = await persistDiagramPreviewDataUrl(data.preview);
      }
      props.updateAttributes(attrs);
      const tok = pendingStandaloneToken.value;
      pendingStandaloneToken.value = null;
      if (standaloneExportTimer != null) {
        clearTimeout(standaloneExportTimer);
        standaloneExportTimer = null;
      }
      void finishOpenStandaloneFromEditor(data.mapXml, tok);
    })();
    return;
  }

  if (data.type === 'ready') {
    void (async () => {
      const raw = await resolveMapXmlForWisemapping(storedMapXml.value);
      const mapXml = raw.trim().length > 0 ? raw : null;
      postWisemappingLoad(iframe.contentWindow!, {
        mapXml,
        theme: isDarkTheme() ? 'dark' : 'light',
        openMode: loadOpenMode.value,
        locale: mapAppLocaleToWisemappingLocale(locale.value),
      });
    })();
    return;
  }

  if (data.type !== 'save' || typeof data.mapXml !== 'string') return;

  void (async () => {
    const mapStored = await persistDiagramTextAsset(data.mapXml, '.xml');
    const attrs: Record<string, any> = { mapXml: mapStored };
    if (typeof data.preview === 'string' && data.preview.startsWith('data:')) {
      attrs.preview = await persistDiagramPreviewDataUrl(data.preview);
    }
    props.updateAttributes(attrs);

    if (pendingCloseAfterSave.value && iframe.contentWindow) {
      pendingCloseAfterSave.value = false;
      if (saveBeforeExportTimer != null) {
        clearTimeout(saveBeforeExportTimer);
        saveBeforeExportTimer = null;
      }
      resetEditorState();
    }
  })();
}

function onWindowMessage(ev: MessageEvent) {
  handleEditorEmbedMessage(ev);
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
  setTimeout(bumpResize, 450);
}

function onEditorIframeLoad() {
  void nextTick().then(() => notifyWisemappingLayout());
}

const exportMenuDetailsRef = ref<HTMLDetailsElement | null>(null);

function exportWisemappingFromIframe(format: 'png' | 'svg') {
  const w = iframeRef.value?.contentWindow;
  if (!w || !editing.value) return;
  postWisemappingExportImage(w, format);
}

function pickExportFormat(format: 'png' | 'svg') {
  exportMenuDetailsRef.value?.removeAttribute('open');
  exportWisemappingFromIframe(format);
}

async function prepareBaseUrl() {
  bundleError.value = false;
  const api = window.electron;
  if (!api?.getWisemappingIndexUrl) {
    indexBaseUrl.value = null;
    return;
  }
  const base = await api.getWisemappingIndexUrl();
  indexBaseUrl.value = base;
  if (!base) {
    bundleError.value = true;
  }
}

async function openEditor() {
  if (props.editor?.isEditable === false) return;
  if (isWebPlatform.value) return;
  await prepareBaseUrl();
  if (!indexBaseUrl.value) {
    bundleError.value = true;
    return;
  }
  loadOpenMode.value = 'edit';
  editing.value = true;
  iframeKey.value += 1;
  await nextTick();
  const base = indexBaseUrl.value;
  const sep = base.includes('?') ? '&' : '?';
  iframeSrc.value = `${base}${sep}_zq_wm=${Date.now()}`;
}

async function openDialogInPreviewMode() {
  if (props.editor?.isEditable === false) return;
  if (isWebPlatform.value) return;
  await prepareBaseUrl();
  if (!indexBaseUrl.value) {
    bundleError.value = true;
    return;
  }
  loadOpenMode.value = 'view';
  editing.value = true;
  iframeKey.value += 1;
  await nextTick();
  const base = indexBaseUrl.value;
  const sep = base.includes('?') ? '&' : '?';
  iframeSrc.value = `${base}${sep}_zq_wm=${Date.now()}`;
  void nextTick().then(() => notifyWisemappingLayout());
}

function closeEditor() {
  const w = iframeRef.value?.contentWindow;
  if (!w || !iframeSrc.value) {
    resetEditorState();
    return;
  }
  pendingCloseAfterSave.value = true;
  saveBeforeExportTimer = setTimeout(() => {
    saveBeforeExportTimer = null;
    if (!pendingCloseAfterSave.value) return;
    pendingCloseAfterSave.value = false;
    resetEditorState();
  }, 1200);
  postWisemappingFlushSave(w);
}

let cleanupWisemappingStandaloneCommit: (() => void) | undefined;

onMounted(async () => {
  window.addEventListener('message', onWindowMessage, false);
  try {
    const platform = await window.electron.getPlatform();
    isWebPlatform.value = platform === 'web';
    isMac.value = platform === 'darwin';
  } catch {
    isWebPlatform.value = false;
    isMac.value = false;
  }
  if (!isWebPlatform.value) {
    await prepareBaseUrl();
  }
  if (window.electron?.onWisemappingStandaloneCommit) {
    cleanupWisemappingStandaloneCommit = window.electron.onWisemappingStandaloneCommit(
      (payload) => {
        if (payload.token !== standaloneToken.value) return;
        void (async () => {
          const preview = await persistDiagramPreviewDataUrl(payload.preview);
          const mapXml = await persistDiagramTextAsset(payload.mapXml, '.xml');
          props.updateAttributes({
            mapXml,
            preview,
          });
          standaloneToken.value = '';
        })();
      },
    );
  }
});

onBeforeUnmount(() => {
  document.documentElement.classList.remove(WISEMAPPING_DIALOG_ROOT_CLASS);
  window.removeEventListener('message', onWindowMessage, false);
  if (saveBeforeExportTimer != null) clearTimeout(saveBeforeExportTimer);
  if (standaloneExportTimer != null) clearTimeout(standaloneExportTimer);
  cleanupWisemappingStandaloneCommit?.();
});

watch(
  () => editing.value && !!iframeSrc.value,
  (open) => {
    if (open) {
      document.documentElement.classList.add(WISEMAPPING_DIALOG_ROOT_CLASS);
    } else {
      document.documentElement.classList.remove(WISEMAPPING_DIALOG_ROOT_CLASS);
    }
  },
);

watch(
  () => locale.value,
  () => {
    if (!editing.value || !iframeSrc.value) return;
    const w = iframeRef.value?.contentWindow;
    if (!w) return;
    postWisemappingSetTheme(w, isDarkTheme() ? 'dark' : 'light');
  },
);

async function refreshWisemappingBundle() {
  if (isWebPlatform.value) return;
  await prepareBaseUrl();
}
</script>

<template>
  <NodeViewWrapper
    class="zq-wisemapping-block"
    :class="{ 'is-selected': selected, 'is-editing': editing }"
    data-type="wisemapping"
  >
    <div v-if="!editing" class="zq-wisemapping-block__view" contenteditable="false">
      <div
        v-if="isWebPlatform"
        class="zq-wisemapping-block__error"
      >
        {{ $t('zq-editor.wisemapping.desktopOnly') }}
      </div>
      <div
        v-else-if="bundleError"
        class="zq-wisemapping-block__error zq-wisemapping-block__error-row"
      >
        <span class="zq-wisemapping-block__error-text">{{
          $t('zq-editor.wisemapping.missingBundle')
        }}</span>
        <button
          type="button"
          class="zq-wisemapping-block__error-refresh"
          :title="$t('zq-editor.wisemapping.refreshBundle')"
          @click="refreshWisemappingBundle"
        >
          <RotateCw class="zq-wisemapping-block__error-refresh-icon" />
        </button>
      </div>
      <div
        v-else-if="previewDataUrl"
        class="zq-wisemapping-block__thumb"
        @dblclick="openDialogInPreviewMode"
      >
        <img
          class="zq-wisemapping-block__thumb-img"
          :src="previewDataUrl"
          alt=""
          draggable="false"
        >
        <span class="zq-wisemapping-block__thumb-hint">{{
          $t('zq-editor.wisemapping.hintHasMap')
        }}</span>
      </div>
      <div
        v-else
        class="zq-wisemapping-block__preview"
        @dblclick="openDialogInPreviewMode"
      >
        <Workflow class="zq-wisemapping-block__icon" />
        <span v-if="hasMap">{{ $t('zq-editor.wisemapping.hintHasMap') }}</span>
        <span v-else>{{ $t('zq-editor.wisemapping.clickToEdit') }}</span>
      </div>

      <div
        v-if="editor?.isEditable && !isWebPlatform && !bundleError"
        class="zq-wisemapping-block__toolbar"
      >
        <button
          type="button"
          class="zq-wisemapping-block__btn"
          :title="$t('zq-editor.wisemapping.edit')"
          @click="openEditor"
        >
          <Pencil class="zq-wisemapping-block__btn-icon" />
        </button>
        <button
          type="button"
          class="zq-wisemapping-block__btn"
          :title="$t('zq-editor.wisemapping.openStandalone')"
          @click="openInStandaloneWindow"
        >
          <ExternalLink class="zq-wisemapping-block__btn-icon" />
        </button>
        <button
          type="button"
          class="zq-wisemapping-block__btn zq-wisemapping-block__btn--danger"
          :title="$t('zq-editor.wisemapping.delete')"
          @click="deleteNode"
        >
          <Trash2 class="zq-wisemapping-block__btn-icon" />
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="editing && iframeSrc"
        class="zq-wisemapping-block__editor"
        contenteditable="false"
      >
        <div
          class="zq-wisemapping-block__editor-header"
          :class="{ 'zq-wisemapping-block__editor-header--mac': isMac }"
        >
          <span class="zq-wisemapping-block__editor-title">{{
            $t('zq-editor.wisemapping.title')
          }}</span>
          <div class="zq-wisemapping-block__editor-actions">
            <details ref="exportMenuDetailsRef" class="zq-wisemapping-block__export-dropdown">
              <summary
                class="zq-wisemapping-block__export-summary"
                :title="$t('zq-editor.wisemapping.export')"
              >
                <span>{{ $t('zq-editor.wisemapping.export') }}</span>
                <ChevronDown class="zq-wisemapping-block__export-chevron" :size="16" :stroke-width="2" />
              </summary>
              <div class="zq-wisemapping-block__export-panel">
                <button
                  type="button"
                  class="zq-wisemapping-block__export-item"
                  :title="$t('zq-editor.wisemapping.exportPng')"
                  @click="pickExportFormat('png')"
                >
                  PNG
                </button>
                <button
                  type="button"
                  class="zq-wisemapping-block__export-item"
                  :title="$t('zq-editor.wisemapping.exportSvg')"
                  @click="pickExportFormat('svg')"
                >
                  SVG
                </button>
              </div>
            </details>
            <button
              type="button"
              class="zq-wisemapping-block__header-btn"
              :title="$t('zq-editor.wisemapping.openStandalone')"
              @click="openInStandaloneWindow"
            >
              <ExternalLink class="zq-wisemapping-block__header-btn-icon" />
            </button>
            <button type="button" class="zq-wisemapping-block__close-btn" @click="closeEditor">
              {{ $t('zq-editor.wisemapping.done') }}
            </button>
          </div>
        </div>
        <div class="zq-wisemapping-block__editor-body">
          <iframe
            :key="iframeKey"
            ref="iframeRef"
            class="zq-wisemapping-block__iframe"
            :src="iframeSrc"
            title="WiseMapping"
            sandbox="allow-scripts allow-popups allow-forms allow-modals allow-downloads allow-presentation"
            referrerpolicy="no-referrer"
            @load="onEditorIframeLoad"
          />
        </div>
      </div>
    </Teleport>
  </NodeViewWrapper>
</template>

<style scoped>
.zq-wisemapping-block {
  margin: 0.75rem 0;
}

.zq-wisemapping-block__view {
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  min-height: 80px;
  transition: border-color 0.15s;
}

.zq-wisemapping-block.is-selected .zq-wisemapping-block__view {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 1px var(--accent-shadow);
}

.zq-wisemapping-block__view:hover {
  border-color: var(--border-strong);
}

.zq-wisemapping-block__error {
  padding: 16px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.zq-wisemapping-block__error-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.zq-wisemapping-block__error-text {
  flex: 1;
  min-width: 0;
}

.zq-wisemapping-block__error-refresh {
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

.zq-wisemapping-block__error-refresh:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-wisemapping-block__error-refresh-icon {
  width: 16px;
  height: 16px;
}

.zq-wisemapping-block__thumb {
  position: relative;
  cursor: pointer;
  min-height: 200px;
  background: var(--bg-editor);
}

.zq-wisemapping-block__thumb-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 360px;
  object-fit: contain;
  vertical-align: top;
}

.zq-wisemapping-block__thumb-hint {
  display: block;
  padding: 8px 12px 12px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.zq-wisemapping-block__preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 120px;
  padding: 32px 16px;
  cursor: pointer;
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
  transition: color 0.15s, background 0.15s;
}

.zq-wisemapping-block__preview:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.zq-wisemapping-block__icon {
  width: 28px;
  height: 28px;
  opacity: 0.5;
}

.zq-wisemapping-block__toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  z-index: 2;
}

.zq-wisemapping-block__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: background 0.15s, color 0.15s;
}

.zq-wisemapping-block__btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-wisemapping-block__btn--danger:hover {
  color: var(--danger-color, #c62828);
}

.zq-wisemapping-block__btn-icon {
  width: 16px;
  height: 16px;
}

.zq-wisemapping-block__editor {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  background: var(--bg-editor);
}

.zq-wisemapping-block__editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 8px 16px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
}

.zq-wisemapping-block__editor-header--mac {
  padding-left: 80px;
}

.zq-wisemapping-block__editor-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.zq-wisemapping-block__editor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zq-wisemapping-block__header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.zq-wisemapping-block__header-btn:hover {
  background: var(--bg-hover);
}

.zq-wisemapping-block__header-btn--text {
  width: auto;
  min-width: 44px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
}

.zq-wisemapping-block__export-dropdown {
  position: relative;
}

.zq-wisemapping-block__export-summary {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 32px;
  padding: 0 8px;
  list-style: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.zq-wisemapping-block__export-summary::-webkit-details-marker {
  display: none;
}

.zq-wisemapping-block__export-summary:hover {
  background: var(--bg-hover);
}

.zq-wisemapping-block__export-chevron {
  flex-shrink: 0;
  opacity: 0.75;
  transition: transform 0.15s ease;
}

.zq-wisemapping-block__export-dropdown[open] .zq-wisemapping-block__export-chevron {
  transform: rotate(180deg);
}

.zq-wisemapping-block__export-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 2000;
  min-width: 112px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-sidebar);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.zq-wisemapping-block__export-item {
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

.zq-wisemapping-block__export-item:hover {
  background: var(--bg-hover);
}

.zq-wisemapping-block__header-btn-icon {
  width: 16px;
  height: 16px;
}

.zq-wisemapping-block__close-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  background: var(--accent-color);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}

.zq-wisemapping-block__editor-body {
  flex: 1;
  min-height: 0;
}

.zq-wisemapping-block__iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
