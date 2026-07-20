<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '@/components/icons'
import { ZqButton } from '@/components/ui'
import { ZqFormItem } from '@/components/ui/form'
import { buildExportFullHTML } from '../../../shared/export-html'
import {
  clampMarginInches,
  DEFAULT_PDF_EXPORT_SETTINGS,
  pdfMarginInches,
  pdfPageDimensionsPx,
  type PdfExportSettings,
  type PdfMarginPreset,
  type PdfOrientation,
  type PdfPaperSize,
} from '../../../shared/pdf-export'

const props = defineProps<{
  visible: boolean
  title: string
  html: string
}>()

const emit = defineEmits<{
  export: [settings: PdfExportSettings]
  cancel: []
}>()

const { t } = useI18n()

function createDefaultSettings(): PdfExportSettings {
  return { ...DEFAULT_PDF_EXPORT_SETTINGS }
}

const settings = ref<PdfExportSettings>(createDefaultSettings())
const currentPage = ref(1)
const totalPages = ref(1)
const contentHeightPx = ref(0)
const overlayRef = ref<HTMLDivElement | null>(null)
const viewportRef = ref<HTMLDivElement | null>(null)
const previewIframeRef = ref<HTMLIFrameElement | null>(null)
let syncingScroll = false

const PAPER_OPTIONS: PdfPaperSize[] = ['A4', 'A3', 'A5', 'Letter', 'Legal']
const MARGIN_OPTIONS: PdfMarginPreset[] = ['normal', 'narrow', 'wide', 'minimal', 'custom']

const previewDocHtml = computed(() =>
  buildExportFullHTML(props.html, props.title, undefined, settings.value, {
    preview: true,
  }),
)

const pageDims = computed(() => pdfPageDimensionsPx(settings.value))

const previewScale = computed(() => {
  const maxWidth = 520
  return Math.min(1, maxWidth / pageDims.value.pageWidth)
})

const scaledPageWidth = computed(() =>
  Math.round(pageDims.value.pageWidth * previewScale.value),
)
const scaledPageHeight = computed(() =>
  Math.round(pageDims.value.pageHeight * previewScale.value),
)

const iframeHeightPx = computed(() =>
  Math.max(pageDims.value.pageHeight, contentHeightPx.value || pageDims.value.pageHeight),
)

const scaledDocHeight = computed(() =>
  Math.round(iframeHeightPx.value * previewScale.value),
)

const iframeTransform = computed(() => `scale(${previewScale.value})`)

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      settings.value = createDefaultSettings()
      currentPage.value = 1
      totalPages.value = 1
      contentHeightPx.value = 0
      await nextTick()
      overlayRef.value?.focus()
    }
  },
)

watch(previewDocHtml, () => {
  currentPage.value = 1
  contentHeightPx.value = 0
})

watch(pageDims, () => {
  updatePageInfo()
})

function onIframeLoad() {
  const doc = previewIframeRef.value?.contentDocument
  if (!doc) return
  contentHeightPx.value = doc.documentElement.scrollHeight
  updatePageInfo()
  nextTick(() => scrollToPage(currentPage.value, false))
}

function updatePageInfo() {
  const pageStride = pageDims.value.pageHeight
  const docHeight = contentHeightPx.value || pageStride
  totalPages.value = Math.max(1, Math.ceil(docHeight / pageStride))
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
}

function scrollToPage(page: number, smooth = true) {
  const el = viewportRef.value
  if (!el) return
  syncingScroll = true
  el.scrollTo({
    top: (page - 1) * scaledPageHeight.value,
    behavior: smooth ? 'smooth' : 'auto',
  })
  requestAnimationFrame(() => {
    syncingScroll = false
  })
}

function goToPage(page: number) {
  const raw = Number.isFinite(page) ? Math.trunc(page) : 1
  const next = Math.min(Math.max(1, raw), totalPages.value)
  currentPage.value = next
  scrollToPage(next)
}

function onPageInput(e: Event) {
  const raw = Number((e.target as HTMLInputElement).value)
  goToPage(raw)
}

function onViewportScroll() {
  if (syncingScroll) return
  const el = viewportRef.value
  if (!el || scaledPageHeight.value <= 0) return
  const page = Math.floor(el.scrollTop / scaledPageHeight.value) + 1
  currentPage.value = Math.min(Math.max(1, page), totalPages.value)
}

function applyMarginPreset(preset: PdfMarginPreset) {
  if (preset === 'custom') return
  const m = pdfMarginInches(preset)
  settings.value.marginTop = m.top
  settings.value.marginBottom = m.bottom
  settings.value.marginLeft = m.left
  settings.value.marginRight = m.right
}

function onMarginPresetChange() {
  applyMarginPreset(settings.value.margins)
}

function onMarginFieldInput(field: 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight') {
  settings.value.margins = 'custom'
  settings.value[field] = clampMarginInches(settings.value[field])
}

function onExport() {
  emit('export', {
    ...settings.value,
    marginTop: clampMarginInches(settings.value.marginTop),
    marginBottom: clampMarginInches(settings.value.marginBottom),
    marginLeft: clampMarginInches(settings.value.marginLeft),
    marginRight: clampMarginInches(settings.value.marginRight),
  })
}

function onCancel() {
  emit('cancel')
}

function onOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('export-pdf-overlay')) {
    onCancel()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') onCancel()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="export-pdf">
      <div
        v-if="visible"
        ref="overlayRef"
        class="export-pdf-overlay"
        tabindex="-1"
        @mousedown="onOverlayClick"
        @keydown="onKeydown"
      >
        <div class="export-pdf-dialog" @mousedown.stop>
          <header class="export-pdf-header">
            <div class="export-pdf-header__info">
              <h2 class="export-pdf-header__title">{{ title || t('exportPdf.untitled') }}</h2>
              <span class="export-pdf-header__subtitle">{{ t('exportPdf.subtitle') }}</span>
            </div>
            <div class="export-pdf-header__actions">
              <ZqButton variant="primary" @click="onExport">
                {{ t('exportPdf.export') }}
              </ZqButton>
              <ZqButton @click="onCancel">{{ t('exportPdf.close') }}</ZqButton>
            </div>
          </header>

          <div class="export-pdf-body">
            <section class="export-pdf-preview">
              <div class="export-pdf-preview__toolbar">
                <button
                  type="button"
                  class="export-pdf-page-btn"
                  :disabled="currentPage <= 1"
                  :title="t('exportPdf.firstPage')"
                  @click="goToPage(1)"
                >
                  <ChevronsLeft :size="16" :stroke-width="2" />
                </button>
                <button
                  type="button"
                  class="export-pdf-page-btn"
                  :disabled="currentPage <= 1"
                  :title="t('exportPdf.prevPage')"
                  @click="goToPage(currentPage - 1)"
                >
                  <ChevronLeft :size="16" :stroke-width="2" />
                </button>
                <span class="export-pdf-page-indicator">
                  <input
                    class="export-pdf-page-input"
                    type="number"
                    min="1"
                    :max="totalPages"
                    :value="currentPage"
                    @change="onPageInput"
                  />
                  <span>/ {{ totalPages }}</span>
                </span>
                <button
                  type="button"
                  class="export-pdf-page-btn"
                  :disabled="currentPage >= totalPages"
                  :title="t('exportPdf.nextPage')"
                  @click="goToPage(currentPage + 1)"
                >
                  <ChevronRight :size="16" :stroke-width="2" />
                </button>
                <button
                  type="button"
                  class="export-pdf-page-btn"
                  :disabled="currentPage >= totalPages"
                  :title="t('exportPdf.lastPage')"
                  @click="goToPage(totalPages)"
                >
                  <ChevronsRight :size="16" :stroke-width="2" />
                </button>
              </div>

              <div
                ref="viewportRef"
                class="export-pdf-preview__viewport"
                @scroll="onViewportScroll"
              >
                <div
                  class="export-pdf-preview__document"
                  :style="{
                    width: `${scaledPageWidth}px`,
                    height: `${scaledDocHeight}px`,
                  }"
                >
                  <iframe
                    ref="previewIframeRef"
                    class="export-pdf-preview__iframe"
                    :srcdoc="previewDocHtml"
                    scrolling="no"
                    :style="{
                      width: `${pageDims.pageWidth}px`,
                      height: `${iframeHeightPx}px`,
                      transform: iframeTransform,
                      transformOrigin: 'top left',
                    }"
                    @load="onIframeLoad"
                  />
                </div>
              </div>
            </section>

            <aside class="export-pdf-settings">
              <ZqFormItem :label="t('exportPdf.paperSize')">
                <select v-model="settings.paperSize" class="export-pdf-select">
                  <option v-for="opt in PAPER_OPTIONS" :key="opt" :value="opt">
                    {{ opt }}
                  </option>
                </select>
              </ZqFormItem>

              <ZqFormItem :label="t('exportPdf.margins')">
                <select
                  v-model="settings.margins"
                  class="export-pdf-select"
                  @change="onMarginPresetChange"
                >
                  <option
                    v-for="opt in MARGIN_OPTIONS"
                    :key="opt"
                    :value="opt"
                  >
                    {{ t(`exportPdf.margin.${opt}`) }}
                  </option>
                </select>
                <div class="export-pdf-margin-grid">
                  <label class="export-pdf-margin-field">
                    <span class="export-pdf-margin-field__label">{{ t('exportPdf.marginTop') }}</span>
                    <input
                      v-model.number="settings.marginTop"
                      class="export-pdf-margin-input"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      @input="onMarginFieldInput('marginTop')"
                    />
                  </label>
                  <label class="export-pdf-margin-field">
                    <span class="export-pdf-margin-field__label">{{ t('exportPdf.marginBottom') }}</span>
                    <input
                      v-model.number="settings.marginBottom"
                      class="export-pdf-margin-input"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      @input="onMarginFieldInput('marginBottom')"
                    />
                  </label>
                  <label class="export-pdf-margin-field">
                    <span class="export-pdf-margin-field__label">{{ t('exportPdf.marginLeft') }}</span>
                    <input
                      v-model.number="settings.marginLeft"
                      class="export-pdf-margin-input"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      @input="onMarginFieldInput('marginLeft')"
                    />
                  </label>
                  <label class="export-pdf-margin-field">
                    <span class="export-pdf-margin-field__label">{{ t('exportPdf.marginRight') }}</span>
                    <input
                      v-model.number="settings.marginRight"
                      class="export-pdf-margin-input"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      @input="onMarginFieldInput('marginRight')"
                    />
                  </label>
                </div>
                <span class="export-pdf-margin-unit">{{ t('exportPdf.marginUnit') }}</span>
              </ZqFormItem>

              <ZqFormItem :label="t('exportPdf.orientation')">
                <div class="export-pdf-segmented">
                  <button
                    type="button"
                    class="export-pdf-segmented__btn"
                    :class="{ active: settings.orientation === 'portrait' }"
                    @click="settings.orientation = 'portrait'"
                  >
                    {{ t('exportPdf.portrait') }}
                  </button>
                  <button
                    type="button"
                    class="export-pdf-segmented__btn"
                    :class="{ active: settings.orientation === 'landscape' }"
                    @click="settings.orientation = 'landscape'"
                  >
                    {{ t('exportPdf.landscape') }}
                  </button>
                </div>
              </ZqFormItem>
            </aside>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.export-pdf-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  outline: none;
}

.export-pdf-dialog {
  width: min(1040px, calc(100vw - 48px));
  height: min(720px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}

.export-pdf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-sidebar);
}

.export-pdf-header__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.export-pdf-header__subtitle {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.export-pdf-header__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.export-pdf-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 280px;
}

.export-pdf-preview {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-hover) 40%, var(--bg-editor));
}

.export-pdf-preview__toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.export-pdf-page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-editor);
  color: var(--text-secondary);
  cursor: pointer;
}

.export-pdf-page-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.export-pdf-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.export-pdf-page-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 72px;
  justify-content: center;
}

.export-pdf-page-input {
  width: 42px;
  height: 28px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-editor);
  color: var(--text-primary);
  text-align: center;
  font-size: 13px;
  font-family: inherit;
}

.export-pdf-preview__viewport {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 24px;
}

.export-pdf-preview__document {
  position: relative;
  margin: 0 auto;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.export-pdf-preview__iframe {
  border: none;
  pointer-events: none;
  display: block;
}

.export-pdf-settings {
  padding: 16px 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.export-pdf-select {
  width: 100%;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-editor);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  padding: 0 10px;
  cursor: pointer;
}

.export-pdf-select:focus {
  outline: none;
  border-color: var(--accent-color);
}

.export-pdf-margin-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.export-pdf-margin-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.export-pdf-margin-field__label {
  font-size: 11px;
  color: var(--text-tertiary);
}

.export-pdf-margin-input {
  width: 100%;
  height: 30px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-editor);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  padding: 0 8px;
}

.export-pdf-margin-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.export-pdf-margin-unit {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.export-pdf-segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 3px;
  border-radius: 8px;
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
}

.export-pdf-segmented--triple {
  grid-template-columns: repeat(3, 1fr);
}

.export-pdf-segmented__btn {
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
  padding: 0 4px;
}

.export-pdf-segmented__btn:hover {
  color: var(--text-primary);
}

.export-pdf-segmented__btn.active {
  background: var(--bg-editor);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.export-pdf-enter-active {
  transition: opacity 0.15s ease;
}

.export-pdf-enter-active .export-pdf-dialog {
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.export-pdf-leave-active {
  transition: opacity 0.1s ease;
}

.export-pdf-enter-from {
  opacity: 0;
}

.export-pdf-enter-from .export-pdf-dialog {
  transform: scale(0.97);
  opacity: 0;
}

.export-pdf-leave-to {
  opacity: 0;
}

@media (max-width: 860px) {
  .export-pdf-body {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }

  .export-pdf-settings {
    max-height: 240px;
    border-top: 1px solid var(--border-color);
  }
}
</style>
