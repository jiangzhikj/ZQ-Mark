<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  inject,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from 'vue';
import { nanoid } from 'nanoid';
import { NodeViewWrapper } from '@tiptap/vue-3';
import { useI18n } from 'vue-i18n';
import { Eye, ExternalLink, Pencil, Trash2, Workflow } from '@/components/icons';
import { $t } from '../../utils/i18n';
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

const { locale } = useI18n();

/** 与 styles.css 中 html.zq-drawio-dialog-fullscreen-open #app 配套 */
const DRAWIO_DIALOG_ROOT_CLASS = 'zq-drawio-dialog-fullscreen-open';

const injectedDrawioUiLayout = inject(DRAWIO_UI_LAYOUT_INJECT_KEY);

function resolvedDrawioUiLayout(): DrawioUiLayout {
  const v = injectedDrawioUiLayout?.value;
  return v === 'minimal' ? 'minimal' : 'full';
}

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  deleteNode: () => void;
  selected: boolean;
  editor: any;
}>();

const editing = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const previewIframeRef = ref<HTMLIFrameElement | null>(null);
/** 全屏层内只读预览（与编辑共用 Teleport） */
const dialogPreviewIframeRef = ref<HTMLIFrameElement | null>(null);
const iframeSrc = ref('');
const previewIframeSrc = ref('');
const dialogPreviewIframeSrc = ref('');
const indexBaseUrl = ref<string | null>(null);
const bundleError = ref(false);
const isWebPlatform = ref(false);

/** 关闭编辑器前拉取 SVG 预览，收到 export 后再卸载 iframe */
const closeAfterExportPending = ref(false);
let closeExportTimer: ReturnType<typeof setTimeout> | null = null;

/** 点「完成」时先走 embed 的 save，再 export SVG */
const pendingCloseAfterSave = ref(false);
let saveBeforeExportTimer: ReturnType<typeof setTimeout> | null = null;

/** 全屏层：编辑 | 预览 */
const dialogLayerMode = ref<'edit' | 'preview'>('edit');
/** 切到预览前需先 save，收到 save 后再切模式 */
const pendingPreviewAfterSave = ref(false);

/** 与独立窗口回写 commit 对应的 token */
const standaloneToken = ref('');
const pendingStandaloneToken = ref<string | null>(null);
let standaloneExportTimer: ReturnType<typeof setTimeout> | null = null;

let drawioLoadSentForSession = false;
let previewLoadSentForSession = false;
let dialogPreviewLoadSentForSession = false;

const storedXml = computed(() =>
  typeof props.node.attrs.xml === 'string' ? props.node.attrs.xml : '',
);

const previewDataUrl = computed(() => {
  const p = props.node.attrs.preview;
  return typeof p === 'string' && p.startsWith('data:') ? p : '';
});

const hasDiagram = computed(() => isDrawioDiagramXml(storedXml.value));

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function resetEditorState() {
  editing.value = false;
  iframeSrc.value = '';
  dialogPreviewIframeSrc.value = '';
  dialogLayerMode.value = 'edit';
  pendingPreviewAfterSave.value = false;
  drawioLoadSentForSession = false;
  dialogPreviewLoadSentForSession = false;
  closeAfterExportPending.value = false;
  pendingCloseAfterSave.value = false;
  if (closeExportTimer != null) {
    clearTimeout(closeExportTimer);
    closeExportTimer = null;
  }
  if (saveBeforeExportTimer != null) {
    clearTimeout(saveBeforeExportTimer);
    saveBeforeExportTimer = null;
  }
}

function startEmbedExportSvgForClose(w: Window) {
  closeAfterExportPending.value = true;
  w.postMessage(JSON.stringify({ action: 'export', format: 'svg' }), '*');
  closeExportTimer = setTimeout(() => {
    closeExportTimer = null;
    if (closeAfterExportPending.value) {
      closeAfterExportPending.value = false;
      resetEditorState();
      refreshPreviewIframeSrc();
    }
  }, 5000);
}

async function finishOpenStandaloneFromEditor(xml: string, tok: string) {
  const api = window.electron;
  if (!api?.openDrawioStandalone) return;
  standaloneToken.value = tok;
  await api.openDrawioStandalone({ xml, token: tok });
  resetEditorState();
  refreshPreviewIframeSrc();
}

async function openStandaloneFromBlockView(tok: string) {
  const api = window.electron;
  if (!api?.openDrawioStandalone) return;
  standaloneToken.value = tok;
  await api.openDrawioStandalone({
    xml: getLoadXmlForDrawio(storedXml.value),
    token: tok,
  });
}

async function openInStandaloneWindow() {
  if (isWebPlatform.value || bundleError.value) return;
  if (!window.electron?.openDrawioStandalone) return;
  const tok = nanoid();
  const w = iframeRef.value?.contentWindow;
  if (editing.value && w && iframeSrc.value) {
    pendingStandaloneToken.value = tok;
    w.postMessage(JSON.stringify({ action: 'export', format: 'xml' }), '*');
    standaloneExportTimer = setTimeout(() => {
      standaloneExportTimer = null;
      if (!pendingStandaloneToken.value) return;
      pendingStandaloneToken.value = null;
      void finishOpenStandaloneFromEditor(
        getLoadXmlForDrawio(storedXml.value),
        tok,
      );
    }, 2000);
    return;
  }
  await openStandaloneFromBlockView(tok);
}

function handleEditorEmbedMessage(ev: MessageEvent) {
  const iframe = iframeRef.value;
  if (!iframe?.contentWindow || ev.source !== iframe.contentWindow) return;

  const data = parseDrawioMessage(ev.data);
  if (!data) return;

  if (
    pendingStandaloneToken.value &&
    data.event === 'export' &&
    data.format === 'xml' &&
    typeof data.xml === 'string' &&
    isDrawioDiagramXml(data.xml)
  ) {
    const tok = pendingStandaloneToken.value;
    pendingStandaloneToken.value = null;
    if (standaloneExportTimer != null) {
      clearTimeout(standaloneExportTimer);
      standaloneExportTimer = null;
    }
    void finishOpenStandaloneFromEditor(data.xml, tok);
    return;
  }

  if (data.event === 'init') {
    if (drawioLoadSentForSession) return;
    drawioLoadSentForSession = true;
    const xml = getLoadXmlForDrawio(storedXml.value);
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
    props.updateAttributes({ xml: data.xml });
    if (pendingPreviewAfterSave.value && iframe.contentWindow) {
      pendingPreviewAfterSave.value = false;
      dialogLayerMode.value = 'preview';
      setupDialogPreview();
      void nextTick(() => notifyDialogPreviewLayout());
    }
    if (pendingCloseAfterSave.value && iframe.contentWindow) {
      pendingCloseAfterSave.value = false;
      if (saveBeforeExportTimer != null) {
        clearTimeout(saveBeforeExportTimer);
        saveBeforeExportTimer = null;
      }
      startEmbedExportSvgForClose(iframe.contentWindow);
    }
    return;
  }

  if (
    data.event === 'export' &&
    data.format === 'svg' &&
    typeof data.data === 'string' &&
    data.data.startsWith('data:')
  ) {
    props.updateAttributes({ preview: data.data });
    if (closeAfterExportPending.value) {
      closeAfterExportPending.value = false;
      if (closeExportTimer != null) {
        clearTimeout(closeExportTimer);
        closeExportTimer = null;
      }
      resetEditorState();
    }
  }
}

function handleBlockPreviewEmbedMessage(ev: MessageEvent) {
  const iframe = previewIframeRef.value;
  if (!iframe?.contentWindow || ev.source !== iframe.contentWindow) return;

  const data = parseDrawioMessage(ev.data);
  if (!data) return;

  if (data.event === 'init') {
    if (previewLoadSentForSession) return;
    previewLoadSentForSession = true;
    const xml = getLoadXmlForDrawio(storedXml.value);
    iframe.contentWindow?.postMessage(
      JSON.stringify({ action: 'load', xml }),
      '*',
    );
  }
}

function handleDialogPreviewEmbedMessage(ev: MessageEvent) {
  const iframe = dialogPreviewIframeRef.value;
  if (!iframe?.contentWindow || ev.source !== iframe.contentWindow) return;

  const data = parseDrawioMessage(ev.data);
  if (!data) return;

  if (data.event === 'init') {
    if (dialogPreviewLoadSentForSession) return;
    dialogPreviewLoadSentForSession = true;
    const xml = getLoadXmlForDrawio(storedXml.value);
    iframe.contentWindow?.postMessage(
      JSON.stringify({ action: 'load', xml }),
      '*',
    );
  }
}

function setupDialogPreview() {
  dialogPreviewLoadSentForSession = false;
  if (!indexBaseUrl.value || !hasDiagram.value) {
    dialogPreviewIframeSrc.value = '';
    return;
  }
  const u = buildDrawioViewerEmbedUrl(indexBaseUrl.value, {
    dark: isDarkTheme(),
    appLocale: locale.value,
  });
  dialogPreviewIframeSrc.value = `${u}${u.includes('?') ? '&' : '?'}_zq_dlg=${Date.now()}`;
}

function notifyDialogPreviewLayout() {
  const w = dialogPreviewIframeRef.value?.contentWindow;
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

function switchDialogToEdit() {
  if (dialogLayerMode.value === 'edit') return;
  dialogLayerMode.value = 'edit';
  void nextTick().then(() => {
    notifyDrawioLayout();
    requestAnimationFrame(() => notifyDrawioLayout());
    setTimeout(() => notifyDrawioLayout(), 120);
  });
}

function switchDialogToPreview() {
  if (dialogLayerMode.value === 'preview') return;
  const w = iframeRef.value?.contentWindow;
  if (!w || !iframeSrc.value) return;
  pendingPreviewAfterSave.value = true;
  postDrawioEmbedInvokeSave(w);
}

function onDialogPreviewIframeLoad() {
  void nextTick().then(() => notifyDialogPreviewLayout());
}

function onWindowMessage(ev: MessageEvent) {
  handleEditorEmbedMessage(ev);
  handleBlockPreviewEmbedMessage(ev);
  handleDialogPreviewEmbedMessage(ev);
}

async function prepareEditorUrl() {
  bundleError.value = false;
  const api = window.electron;
  if (!api?.getDrawioIndexUrl) {
    indexBaseUrl.value = null;
    return;
  }
  const base = await api.getDrawioIndexUrl();
  indexBaseUrl.value = base;
  if (!base) {
    bundleError.value = true;
  }
}

function refreshPreviewIframeSrc() {
  previewLoadSentForSession = false;
  if (
    isWebPlatform.value ||
    !indexBaseUrl.value ||
    editing.value ||
    !hasDiagram.value ||
    previewDataUrl.value
  ) {
    previewIframeSrc.value = '';
    return;
  }
  const u = buildDrawioViewerEmbedUrl(indexBaseUrl.value, {
    dark: isDarkTheme(),
    appLocale: locale.value,
  });
  previewIframeSrc.value = `${u}${u.includes('?') ? '&' : '?'}_zq_pv=${Date.now()}`;
}

async function openEditor() {
  if (props.editor?.isEditable === false) return;
  if (isWebPlatform.value) return;
  await prepareEditorUrl();
  if (!indexBaseUrl.value) {
    bundleError.value = true;
    return;
  }
  previewIframeSrc.value = '';
  dialogPreviewIframeSrc.value = '';
  dialogLayerMode.value = 'edit';
  editing.value = true;
  await nextTick();
  drawioLoadSentForSession = false;
  const url = buildDrawioEmbedUrl(indexBaseUrl.value, {
    dark: isDarkTheme(),
    uiLayout: resolvedDrawioUiLayout(),
    appLocale: locale.value,
  });
  iframeSrc.value = `${url}${url.includes('?') ? '&' : '?'}_zq_t=${Date.now()}`;
}

/** 从块上双击：全屏默认进入预览（编辑 iframe 仍加载，便于切到编辑） */
async function openDialogInPreviewMode() {
  if (props.editor?.isEditable === false) return;
  if (isWebPlatform.value) return;
  await prepareEditorUrl();
  if (!indexBaseUrl.value) {
    bundleError.value = true;
    return;
  }
  previewIframeSrc.value = '';
  dialogPreviewIframeSrc.value = '';
  dialogLayerMode.value = 'preview';
  editing.value = true;
  await nextTick();
  drawioLoadSentForSession = false;
  dialogPreviewLoadSentForSession = false;
  const url = buildDrawioEmbedUrl(indexBaseUrl.value, {
    dark: isDarkTheme(),
    uiLayout: resolvedDrawioUiLayout(),
    appLocale: locale.value,
  });
  iframeSrc.value = `${url}${url.includes('?') ? '&' : '?'}_zq_t=${Date.now()}`;
  setupDialogPreview();
  await nextTick();
  notifyDialogPreviewLayout();
}

function closeEditor() {
  if (dialogLayerMode.value === 'preview') {
    resetEditorState();
    refreshPreviewIframeSrc();
    return;
  }
  const w = iframeRef.value?.contentWindow;
  if (!w || !iframeSrc.value) {
    resetEditorState();
    refreshPreviewIframeSrc();
    return;
  }
  pendingCloseAfterSave.value = true;
  saveBeforeExportTimer = setTimeout(() => {
    saveBeforeExportTimer = null;
    if (!pendingCloseAfterSave.value) return;
    pendingCloseAfterSave.value = false;
    startEmbedExportSvgForClose(w);
  }, 1200);
  postDrawioEmbedInvokeSave(w);
}

/** draw.io 依赖窗口尺寸与 embed 的 fullscreen 协议；全屏层需通知内部重排侧栏与画布 */
function notifyDrawioLayout() {
  const w = iframeRef.value?.contentWindow;
  if (!w) return;
  try {
    w.postMessage(
      JSON.stringify({
        action: 'fullscreenChanged',
        value: true,
      }),
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
  setTimeout(bumpResize, 450);
}

function onEditorIframeLoad() {
  void nextTick().then(() => notifyDrawioLayout());
}

let cleanupDrawioStandaloneCommit: (() => void) | undefined;

onMounted(async () => {
  window.addEventListener('message', onWindowMessage, false);
  try {
    isWebPlatform.value = (await window.electron.getPlatform()) === 'web';
  } catch {
    isWebPlatform.value = false;
  }
  if (!isWebPlatform.value) {
    await prepareEditorUrl();
    refreshPreviewIframeSrc();
  }
  if (window.electron?.onDrawioStandaloneCommit) {
    cleanupDrawioStandaloneCommit = window.electron.onDrawioStandaloneCommit(
      (payload) => {
        if (payload.token !== standaloneToken.value) return;
        props.updateAttributes({
          xml: payload.xml,
          preview: payload.preview,
        });
        standaloneToken.value = '';
      },
    );
  }
});

onBeforeUnmount(() => {
  document.documentElement.classList.remove(DRAWIO_DIALOG_ROOT_CLASS);
  window.removeEventListener('message', onWindowMessage, false);
  if (closeExportTimer != null) clearTimeout(closeExportTimer);
  if (saveBeforeExportTimer != null) clearTimeout(saveBeforeExportTimer);
  if (standaloneExportTimer != null) clearTimeout(standaloneExportTimer);
  cleanupDrawioStandaloneCommit?.();
});

watch(
  () =>
    [hasDiagram.value, previewDataUrl.value, editing.value, indexBaseUrl.value, locale.value] as const,
  () => {
    refreshPreviewIframeSrc();
  },
);

watch(
  () => storedXml.value,
  () => {
    previewLoadSentForSession = false;
    dialogPreviewLoadSentForSession = false;
  },
);

watch(
  () => editing.value && !!iframeSrc.value,
  (open) => {
    if (open) {
      document.documentElement.classList.add(DRAWIO_DIALOG_ROOT_CLASS);
    } else {
      document.documentElement.classList.remove(DRAWIO_DIALOG_ROOT_CLASS);
    }
  },
);
</script>

<template>
  <NodeViewWrapper
    ref="containerRef"
    class="zq-drawio-block"
    :class="{ 'is-selected': selected, 'is-editing': editing }"
    data-type="drawio"
  >
    <div v-if="!editing" class="zq-drawio-block__view" contenteditable="false">
      <div
        v-if="isWebPlatform"
        class="zq-drawio-block__error"
      >
        {{ $t('zq-editor.drawio.desktopOnly') }}
      </div>
      <div
        v-else-if="bundleError"
        class="zq-drawio-block__error"
      >
        {{ $t('zq-editor.drawio.missingBundle') }}
      </div>
      <div
        v-else-if="previewDataUrl"
        class="zq-drawio-block__thumb"
        @dblclick="openDialogInPreviewMode"
      >
        <img
          class="zq-drawio-block__thumb-img"
          :src="previewDataUrl"
          alt=""
          draggable="false"
        >
        <span class="zq-drawio-block__thumb-hint">{{ $t('zq-editor.drawio.hintHasDiagram') }}</span>
      </div>
      <div
        v-else-if="hasDiagram && previewIframeSrc"
        class="zq-drawio-block__thumb zq-drawio-block__thumb--iframe"
        @dblclick="openDialogInPreviewMode"
      >
        <iframe
          ref="previewIframeRef"
          class="zq-drawio-block__preview-iframe"
          :src="previewIframeSrc"
          title="draw.io preview"
          sandbox="allow-scripts allow-popups allow-forms allow-modals allow-downloads allow-presentation"
          referrerpolicy="no-referrer"
        />
        <span class="zq-drawio-block__thumb-hint">{{ $t('zq-editor.drawio.hintHasDiagram') }}</span>
      </div>
      <div
        v-else
        class="zq-drawio-block__preview"
        @dblclick="openDialogInPreviewMode"
      >
        <Workflow class="zq-drawio-block__icon" />
        <span v-if="hasDiagram">{{ $t('zq-editor.drawio.hintHasDiagram') }}</span>
        <span v-else>{{ $t('zq-editor.drawio.clickToEdit') }}</span>
      </div>

      <div v-if="editor?.isEditable && !isWebPlatform && !bundleError" class="zq-drawio-block__toolbar">
        <button
          type="button"
          class="zq-drawio-block__btn"
          :title="$t('zq-editor.drawio.edit')"
          @click="openEditor"
        >
          <Pencil class="zq-drawio-block__btn-icon" />
        </button>
        <button
          type="button"
          class="zq-drawio-block__btn"
          :title="$t('zq-editor.drawio.openStandalone')"
          @click="openInStandaloneWindow"
        >
          <ExternalLink class="zq-drawio-block__btn-icon" />
        </button>
        <button
          type="button"
          class="zq-drawio-block__btn zq-drawio-block__btn--danger"
          :title="$t('zq-editor.drawio.delete')"
          @click="deleteNode"
        >
          <Trash2 class="zq-drawio-block__btn-icon" />
        </button>
      </div>
    </div>

    <!-- 始终挂到 body：避免从窄编辑栏 Teleport 到全屏时 iframe 尺寸突变导致 draw.io 侧栏/画布错位 -->
    <Teleport to="body">
      <div
        v-if="editing && iframeSrc"
        class="zq-drawio-block__editor"
        contenteditable="false"
      >
        <div class="zq-drawio-block__editor-header">
          <span class="zq-drawio-block__editor-title">{{ $t('zq-editor.drawio.title') }}</span>
          <div class="zq-drawio-block__editor-actions">
            <button
              type="button"
              class="zq-drawio-block__header-btn"
              :class="{ 'is-active': dialogLayerMode === 'edit' }"
              :title="$t('zq-editor.drawio.switchToEdit')"
              @click="switchDialogToEdit"
            >
              <Pencil class="zq-drawio-block__header-btn-icon" />
            </button>
            <button
              type="button"
              class="zq-drawio-block__header-btn"
              :class="{ 'is-active': dialogLayerMode === 'preview' }"
              :title="$t('zq-editor.drawio.switchToPreview')"
              @click="switchDialogToPreview"
            >
              <Eye class="zq-drawio-block__header-btn-icon" />
            </button>
            <button
              type="button"
              class="zq-drawio-block__header-btn"
              :title="$t('zq-editor.drawio.openStandalone')"
              @click="openInStandaloneWindow"
            >
              <ExternalLink class="zq-drawio-block__header-btn-icon" />
            </button>
            <button type="button" class="zq-drawio-block__close-btn" @click="closeEditor">
              {{ $t('zq-editor.drawio.done') }}
            </button>
          </div>
        </div>
        <div class="zq-drawio-block__editor-body">
          <div
            class="zq-drawio-block__editor-pane"
            :class="
              dialogLayerMode === 'edit'
                ? 'zq-drawio-block__layer-front'
                : 'zq-drawio-block__layer-back'
            "
          >
            <iframe
              ref="iframeRef"
              class="zq-drawio-block__iframe"
              :src="iframeSrc"
              title="draw.io"
              sandbox="allow-scripts allow-popups allow-forms allow-modals allow-downloads allow-presentation"
              referrerpolicy="no-referrer"
              @load="onEditorIframeLoad"
            />
          </div>
          <div
            class="zq-drawio-block__preview-pane"
            :class="
              dialogLayerMode === 'preview'
                ? 'zq-drawio-block__layer-front'
                : 'zq-drawio-block__layer-back'
            "
          >
            <iframe
              v-if="dialogPreviewIframeSrc && hasDiagram"
              ref="dialogPreviewIframeRef"
              class="zq-drawio-block__dialog-preview-iframe"
              :src="dialogPreviewIframeSrc"
              title="draw.io preview"
              sandbox="allow-scripts allow-popups allow-forms allow-modals allow-downloads allow-presentation"
              referrerpolicy="no-referrer"
              @load="onDialogPreviewIframeLoad"
            />
            <img
              v-else-if="previewDataUrl"
              class="zq-drawio-block__dialog-preview-img"
              :src="previewDataUrl"
              alt=""
              draggable="false"
            />
            <div
              v-else
              class="zq-drawio-block__dialog-preview-empty"
            >
              {{ $t('zq-editor.drawio.previewEmpty') }}
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </NodeViewWrapper>
</template>

<style scoped>
.zq-drawio-block {
  margin: 0.75rem 0;
}

.zq-drawio-block__view {
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  min-height: 80px;
  transition: border-color 0.15s;
}

.zq-drawio-block.is-selected .zq-drawio-block__view {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 1px var(--accent-shadow);
}

.zq-drawio-block__view:hover {
  border-color: var(--border-strong);
}

.zq-drawio-block__thumb {
  position: relative;
  cursor: pointer;
  min-height: 200px;
  background: var(--bg-editor);
}

.zq-drawio-block__thumb-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 360px;
  object-fit: contain;
  vertical-align: top;
}

.zq-drawio-block__thumb--iframe {
  min-height: 220px;
}

.zq-drawio-block__preview-iframe {
  display: block;
  width: 100%;
  height: 260px;
  border: none;
  pointer-events: none;
  background: var(--bg-editor);
}

.zq-drawio-block__thumb-hint {
  display: block;
  padding: 8px 12px 12px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.zq-drawio-block__preview {
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

.zq-drawio-block__preview:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.zq-drawio-block__icon {
  width: 28px;
  height: 28px;
  opacity: 0.5;
}

.zq-drawio-block__error {
  padding: 16px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.zq-drawio-block__toolbar {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.zq-drawio-block__view:hover .zq-drawio-block__toolbar {
  opacity: 1;
}

.zq-drawio-block__btn {
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

.zq-drawio-block__btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-drawio-block__btn--danger:hover {
  color: #f56c6c;
}

.zq-drawio-block__btn-icon {
  width: 14px;
  height: 14px;
}

/* 默认全屏覆盖层：Teleport 到 body，与独立窗口同尺 */
.zq-drawio-block__editor {
  position: fixed;
  z-index: 10001;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-editor);
}

/* 与 draw.io 默认工具栏/菜单条背景一致（浅色 #f5f5f5，非纯白画布） */
.zq-drawio-block__editor-header {
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

.zq-drawio-block__editor-header button,
.zq-drawio-block__editor-header .zq-drawio-block__editor-actions {
  -webkit-app-region: no-drag;
}

.zq-drawio-block__editor-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.zq-drawio-block__editor-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zq-drawio-block__header-btn {
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

.zq-drawio-block__header-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-drawio-block__header-btn.is-active {
  background: color-mix(in srgb, var(--accent-color) 18%, transparent);
  color: var(--accent-color);
}

.zq-drawio-block__header-btn-icon {
  width: 16px;
  height: 16px;
}

.zq-drawio-block__close-btn {
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

.zq-drawio-block__close-btn:hover {
  opacity: 0.85;
}

.zq-drawio-block__editor-body {
  flex: 1;
  min-height: 0;
  height: auto;
  position: relative;
  background: var(--bg-editor);
}

.zq-drawio-block__editor-pane,
.zq-drawio-block__preview-pane {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/**
 * 勿用 v-show/display:none 藏编辑 iframe：尺寸会变成 0，draw.io 画布按错误大小初始化。
 * 背面层仅 visibility:hidden，仍占位全屏，切回编辑时尺寸正确。
 */
.zq-drawio-block__layer-back {
  visibility: hidden;
  pointer-events: none;
  z-index: 1;
}

.zq-drawio-block__layer-front {
  visibility: visible;
  pointer-events: auto;
  z-index: 2;
}

.zq-drawio-block__preview-pane {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-editor);
}

.zq-drawio-block__dialog-preview-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-editor);
}

.zq-drawio-block__dialog-preview-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.zq-drawio-block__dialog-preview-empty {
  padding: 24px;
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: center;
}

.zq-drawio-block__iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-editor);
}

html[data-theme='dark'] .zq-drawio-block__editor-header {
  background: #2c2c2c;
  border-bottom-color: #404040;
}
</style>
