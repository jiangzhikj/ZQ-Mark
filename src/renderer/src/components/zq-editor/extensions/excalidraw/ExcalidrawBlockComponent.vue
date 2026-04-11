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
import { ExternalLink, Pencil, RotateCw, Trash2, Shapes } from '@/components/icons';
import {
  parseExcalidrawHostMessage,
  hasExcalidrawScene,
  resolveSceneForExcalidraw,
  mapAppLocaleToExcalidrawLangCode,
  postExcalidrawLoad,
  postExcalidrawFlushSave,
  postExcalidrawNotifyLayout,
  postExcalidrawSetLang,
} from './excalidraw-embed';
import {
  persistDiagramPreviewDataUrl,
  diagramPreviewSrc,
  persistDiagramTextAsset,
} from '../../utils/diagram-preview-asset';

const EXCALIDRAW_DIALOG_ROOT_CLASS = 'zq-excalidraw-dialog-fullscreen-open';

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

/** 与本次打开的 iframe 对应的 load：edit=默认编辑；view=双击进入时默认 Hand 预览 */
const loadOpenMode = ref<'edit' | 'view'>('edit');

const standaloneToken = ref('');
const pendingStandaloneToken = ref<string | null>(null);
let standaloneExportTimer: ReturnType<typeof setTimeout> | null = null;

const storedScene = computed(() =>
  typeof props.node.attrs.scene === 'string' ? props.node.attrs.scene : '',
);

/** 文档内嵌块缩略图：data URL 或落盘后的 local-asset URL */
const previewDataUrl = computed(() =>
  diagramPreviewSrc(props.node.attrs.preview),
);

const hasScene = computed(() => hasExcalidrawScene(storedScene.value));

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

async function finishOpenStandaloneFromEditor(scene: string, tok: string) {
  const api = window.electron;
  if (!api?.openExcalidrawStandalone) return;
  standaloneToken.value = tok;
  await api.openExcalidrawStandalone({ scene, token: tok });
  resetEditorState();
}

async function openStandaloneFromBlockView(tok: string) {
  const api = window.electron;
  if (!api?.openExcalidrawStandalone) return;
  standaloneToken.value = tok;
  const scene = await resolveSceneForExcalidraw(storedScene.value);
  await api.openExcalidrawStandalone({
    scene: scene || '{}',
    token: tok,
  });
}

async function openInStandaloneWindow() {
  if (isWebPlatform.value || bundleError.value) return;
  if (!window.electron?.openExcalidrawStandalone) return;
  const tok = nanoid();
  const w = iframeRef.value?.contentWindow;
  if (editing.value && w && iframeSrc.value) {
    pendingStandaloneToken.value = tok;
    postExcalidrawFlushSave(w);
    standaloneExportTimer = setTimeout(() => {
      standaloneExportTimer = null;
      if (!pendingStandaloneToken.value) return;
      pendingStandaloneToken.value = null;
      void (async () => {
        const scene = await resolveSceneForExcalidraw(storedScene.value);
        void finishOpenStandaloneFromEditor(scene || '{}', tok);
      })();
    }, 2000);
    return;
  }
  await openStandaloneFromBlockView(tok);
}

function handleEditorEmbedMessage(ev: MessageEvent) {
  const iframe = iframeRef.value;
  if (!iframe?.contentWindow || ev.source !== iframe.contentWindow) return;

  const data = parseExcalidrawHostMessage(ev.data);
  if (!data) return;

  if (
    pendingStandaloneToken.value &&
    data.type === 'save' &&
    typeof data.scene === 'string'
  ) {
    void (async () => {
      const sceneStored = await persistDiagramTextAsset(data.scene, '.json');
      const attrs: Record<string, any> = { scene: sceneStored };
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
      void finishOpenStandaloneFromEditor(data.scene, tok);
    })();
    return;
  }

  if (data.type === 'ready') {
    void (async () => {
      const raw = await resolveSceneForExcalidraw(storedScene.value);
      const scene = raw.trim().length > 0 ? raw : null;
      postExcalidrawLoad(iframe.contentWindow!, {
        scene,
        theme: isDarkTheme() ? 'dark' : 'light',
        openMode: loadOpenMode.value,
        langCode: mapAppLocaleToExcalidrawLangCode(locale.value),
      });
    })();
    return;
  }

  if (data.type !== 'save' || typeof data.scene !== 'string') return;

  void (async () => {
    const sceneStored = await persistDiagramTextAsset(data.scene, '.json');
    const attrs: Record<string, any> = { scene: sceneStored };
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
  setTimeout(bumpResize, 450);
}

function onEditorIframeLoad() {
  void nextTick().then(() => notifyExcalidrawLayout());
}

async function prepareBaseUrl() {
  bundleError.value = false;
  const api = window.electron;
  if (!api?.getExcalidrawIndexUrl) {
    indexBaseUrl.value = null;
    return;
  }
  const base = await api.getExcalidrawIndexUrl();
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
  iframeSrc.value = `${base}${sep}_zq_ex=${Date.now()}`;
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
  iframeSrc.value = `${base}${sep}_zq_ex=${Date.now()}`;
  void nextTick().then(() => notifyExcalidrawLayout());
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
  postExcalidrawFlushSave(w);
}

let cleanupExcalidrawStandaloneCommit: (() => void) | undefined;

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
  if (window.electron?.onExcalidrawStandaloneCommit) {
    cleanupExcalidrawStandaloneCommit = window.electron.onExcalidrawStandaloneCommit(
      (payload) => {
        if (payload.token !== standaloneToken.value) return;
        void (async () => {
          const preview = await persistDiagramPreviewDataUrl(payload.preview);
          const scene = await persistDiagramTextAsset(payload.scene, '.json');
          props.updateAttributes({
            scene,
            preview,
          });
          standaloneToken.value = '';
        })();
      },
    );
  }
});

onBeforeUnmount(() => {
  document.documentElement.classList.remove(EXCALIDRAW_DIALOG_ROOT_CLASS);
  window.removeEventListener('message', onWindowMessage, false);
  if (saveBeforeExportTimer != null) clearTimeout(saveBeforeExportTimer);
  if (standaloneExportTimer != null) clearTimeout(standaloneExportTimer);
  cleanupExcalidrawStandaloneCommit?.();
});

watch(
  () => editing.value && !!iframeSrc.value,
  (open) => {
    if (open) {
      document.documentElement.classList.add(EXCALIDRAW_DIALOG_ROOT_CLASS);
    } else {
      document.documentElement.classList.remove(EXCALIDRAW_DIALOG_ROOT_CLASS);
    }
  },
);

watch(
  () => locale.value,
  () => {
    if (!editing.value || !iframeSrc.value) return;
    const w = iframeRef.value?.contentWindow;
    if (!w) return;
    postExcalidrawSetLang(w, mapAppLocaleToExcalidrawLangCode(locale.value));
  },
);

async function refreshExcalidrawBundle() {
  if (isWebPlatform.value) return;
  await prepareBaseUrl();
}
</script>

<template>
  <NodeViewWrapper
    class="zq-excalidraw-block"
    :class="{ 'is-selected': selected, 'is-editing': editing }"
    data-type="excalidraw"
  >
    <div v-if="!editing" class="zq-excalidraw-block__view" contenteditable="false">
      <div
        v-if="isWebPlatform"
        class="zq-excalidraw-block__error"
      >
        {{ $t('zq-editor.excalidraw.desktopOnly') }}
      </div>
      <div
        v-else-if="bundleError"
        class="zq-excalidraw-block__error zq-excalidraw-block__error-row"
      >
        <span class="zq-excalidraw-block__error-text">{{
          $t('zq-editor.excalidraw.missingBundle')
        }}</span>
        <button
          type="button"
          class="zq-excalidraw-block__error-refresh"
          :title="$t('zq-editor.excalidraw.refreshBundle')"
          @click="refreshExcalidrawBundle"
        >
          <RotateCw class="zq-excalidraw-block__error-refresh-icon" />
        </button>
      </div>
      <div
        v-else-if="previewDataUrl"
        class="zq-excalidraw-block__thumb"
        @dblclick="openDialogInPreviewMode"
      >
        <img
          class="zq-excalidraw-block__thumb-img"
          :src="previewDataUrl"
          alt=""
          draggable="false"
        >
        <span class="zq-excalidraw-block__thumb-hint">{{
          $t('zq-editor.excalidraw.hintHasDiagram')
        }}</span>
      </div>
      <div
        v-else
        class="zq-excalidraw-block__preview"
        @dblclick="openDialogInPreviewMode"
      >
        <Shapes class="zq-excalidraw-block__icon" />
        <span v-if="hasScene">{{ $t('zq-editor.excalidraw.hintHasDiagram') }}</span>
        <span v-else>{{ $t('zq-editor.excalidraw.clickToEdit') }}</span>
      </div>

      <div
        v-if="editor?.isEditable && !isWebPlatform && !bundleError"
        class="zq-excalidraw-block__toolbar"
      >
        <button
          type="button"
          class="zq-excalidraw-block__btn"
          :title="$t('zq-editor.excalidraw.edit')"
          @click="openEditor"
        >
          <Pencil class="zq-excalidraw-block__btn-icon" />
        </button>
        <button
          type="button"
          class="zq-excalidraw-block__btn"
          :title="$t('zq-editor.excalidraw.openStandalone')"
          @click="openInStandaloneWindow"
        >
          <ExternalLink class="zq-excalidraw-block__btn-icon" />
        </button>
        <button
          type="button"
          class="zq-excalidraw-block__btn zq-excalidraw-block__btn--danger"
          :title="$t('zq-editor.excalidraw.delete')"
          @click="deleteNode"
        >
          <Trash2 class="zq-excalidraw-block__btn-icon" />
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="editing && iframeSrc"
        class="zq-excalidraw-block__editor"
        contenteditable="false"
      >
        <div
          class="zq-excalidraw-block__editor-header"
          :class="{ 'zq-excalidraw-block__editor-header--mac': isMac }"
        >
          <span class="zq-excalidraw-block__editor-title">{{
            $t('zq-editor.excalidraw.title')
          }}</span>
          <div class="zq-excalidraw-block__editor-actions">
            <button
              type="button"
              class="zq-excalidraw-block__header-btn"
              :title="$t('zq-editor.excalidraw.openStandalone')"
              @click="openInStandaloneWindow"
            >
              <ExternalLink class="zq-excalidraw-block__header-btn-icon" />
            </button>
            <button type="button" class="zq-excalidraw-block__close-btn" @click="closeEditor">
              {{ $t('zq-editor.excalidraw.done') }}
            </button>
          </div>
        </div>
        <div class="zq-excalidraw-block__editor-body">
          <iframe
            :key="iframeKey"
            ref="iframeRef"
            class="zq-excalidraw-block__iframe"
            :src="iframeSrc"
            title="Excalidraw"
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
.zq-excalidraw-block {
  margin: 0.75rem 0;
}

.zq-excalidraw-block__view {
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  min-height: 80px;
  transition: border-color 0.15s;
}

.zq-excalidraw-block.is-selected .zq-excalidraw-block__view {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 1px var(--accent-shadow);
}

.zq-excalidraw-block__view:hover {
  border-color: var(--border-strong);
}

.zq-excalidraw-block__error {
  padding: 16px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.zq-excalidraw-block__error-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.zq-excalidraw-block__error-text {
  flex: 1;
  min-width: 0;
}

.zq-excalidraw-block__error-refresh {
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

.zq-excalidraw-block__error-refresh:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-excalidraw-block__error-refresh-icon {
  width: 16px;
  height: 16px;
}

.zq-excalidraw-block__thumb {
  position: relative;
  cursor: pointer;
  min-height: 200px;
  background: var(--bg-editor);
}

.zq-excalidraw-block__thumb-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 360px;
  object-fit: contain;
  vertical-align: top;
}

.zq-excalidraw-block__thumb-hint {
  display: block;
  padding: 8px 12px 12px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.zq-excalidraw-block__preview {
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

.zq-excalidraw-block__preview:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.zq-excalidraw-block__icon {
  width: 28px;
  height: 28px;
  opacity: 0.5;
}

.zq-excalidraw-block__toolbar {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.zq-excalidraw-block__view:hover .zq-excalidraw-block__toolbar {
  opacity: 1;
}

.zq-excalidraw-block__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 5px;
  background: var(--bg-editor);
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.15s;
}

.zq-excalidraw-block__btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-excalidraw-block__btn--danger:hover {
  color: #f56c6c;
}

.zq-excalidraw-block__btn-icon {
  width: 14px;
  height: 14px;
}

.zq-excalidraw-block__editor {
  position: fixed;
  z-index: 10001;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-editor);
}

.zq-excalidraw-block__editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 8px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e8e8e8;
  -webkit-app-region: drag;
}

.zq-excalidraw-block__editor-header--mac {
  padding-left: 80px;
}

.zq-excalidraw-block__editor-header button,
.zq-excalidraw-block__editor-actions {
  -webkit-app-region: no-drag;
}

.zq-excalidraw-block__editor-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.zq-excalidraw-block__editor-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zq-excalidraw-block__header-btn {
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
  transition: all 0.15s;
}

.zq-excalidraw-block__header-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-excalidraw-block__header-btn-icon {
  width: 16px;
  height: 16px;
}

.zq-excalidraw-block__close-btn {
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

.zq-excalidraw-block__close-btn:hover {
  opacity: 0.85;
}

.zq-excalidraw-block__editor-body {
  flex: 1;
  min-height: 0;
  height: auto;
  position: relative;
  background: var(--bg-editor);
}

.zq-excalidraw-block__iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-editor);
}

html[data-theme='dark'] .zq-excalidraw-block__editor-header {
  background: #2c2c2c;
  border-bottom-color: #404040;
}
</style>
