<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { NodeViewWrapper } from '@tiptap/vue-3';
import { Maximize2, Minimize2, Pencil, Trash2 } from '@/components/icons';
import { $t } from '../../utils/i18n';
import type { DrawData } from '@/components/zq-draw/types';

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  deleteNode: () => void;
  selected: boolean;
  editor: any;
}>();

const editing = ref(false);
const fullscreen = ref(false);
const previewWidth = ref(600);
const previewHeight = ref(300);
const containerRef = ref<HTMLElement | null>(null);

const DrawPreview = shallowRef<any>(null);
const ZqDraw = shallowRef<any>(null);

const drawData = computed<DrawData | null>(() => {
  const raw = props.node.attrs.data;
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
});

const hasContent = computed(() => {
  if (!drawData.value) return false;
  const els = drawData.value.elements;
  return els && els.length > 0 && els.some((e: any) => !e.isDeleted);
});

async function loadPreview() {
  if (!DrawPreview.value) {
    const mod = await import('@/components/zq-draw/DrawPreview.vue');
    DrawPreview.value = mod.default;
  }
}

async function loadEditor() {
  if (!ZqDraw.value) {
    const mod = await import('@/components/zq-draw/ZqDraw.vue');
    ZqDraw.value = mod.default;
  }
}

function measureContainer() {
  if (containerRef.value) {
    const w = containerRef.value.clientWidth || 600;
    previewWidth.value = w;
    previewHeight.value = Math.min(400, Math.max(200, Math.round(w * 0.5)));
  }
}

function openEditor() {
  if (props.editor?.isEditable === false) return;
  loadEditor();
  editing.value = true;
}

function onDrawChange(data: DrawData) {
  props.updateAttributes({ data: JSON.stringify(data) });
}

function closeEditor() {
  fullscreen.value = false;
  editing.value = false;
}

function toggleFullscreen() {
  fullscreen.value = !fullscreen.value;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && fullscreen.value) {
    e.preventDefault();
    e.stopPropagation();
    fullscreen.value = false;
  }
}

onMounted(() => {
  measureContainer();
  if (hasContent.value) loadPreview();
  document.addEventListener('keydown', onKeydown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown, true);
});

watch(hasContent, (val) => {
  if (val && !DrawPreview.value) loadPreview();
});

watch(editing, (val) => {
  if (!val) measureContainer();
});
</script>

<template>
  <NodeViewWrapper
    ref="containerRef"
    class="zq-draw-block"
    :class="{ 'is-selected': selected, 'is-editing': editing }"
    data-type="draw"
  >
    <div v-if="!editing" class="zq-draw-block__view" contenteditable="false">
      <div
        v-if="hasContent && DrawPreview && drawData"
        class="zq-draw-block__preview-host"
        @dblclick="openEditor"
      >
        <component
          :is="DrawPreview"
          :data="drawData"
          :width="previewWidth"
          :height="previewHeight"
        />
      </div>
      <div
        v-else
        class="zq-draw-block__empty"
        @click="openEditor"
      >
        <Pencil class="zq-draw-block__empty-icon" />
        <span>{{ $t('zq-editor.draw.clickToEdit') }}</span>
      </div>

      <div v-if="editor?.isEditable" class="zq-draw-block__toolbar">
        <button
          class="zq-draw-block__btn"
          :title="$t('zq-editor.draw.edit')"
          @click="openEditor"
        >
          <Maximize2 class="zq-draw-block__btn-icon" />
        </button>
        <button
          class="zq-draw-block__btn zq-draw-block__btn--danger"
          :title="$t('zq-editor.draw.delete')"
          @click="deleteNode"
        >
          <Trash2 class="zq-draw-block__btn-icon" />
        </button>
      </div>
    </div>

    <Teleport to="body" :disabled="!fullscreen">
      <div
        v-if="editing"
        class="zq-draw-block__editor"
        :class="{ 'zq-draw-block__editor--fullscreen': fullscreen }"
        contenteditable="false"
      >
        <div class="zq-draw-block__editor-header">
          <span class="zq-draw-block__editor-title">{{ $t('zq-editor.draw.title') }}</span>
          <div class="zq-draw-block__editor-actions">
            <button
              class="zq-draw-block__header-btn"
              :title="fullscreen ? $t('zq-editor.draw.exitFullscreen') : $t('zq-editor.draw.fullscreen')"
              @click="toggleFullscreen"
            >
              <Minimize2 v-if="fullscreen" class="zq-draw-block__header-btn-icon" />
              <Maximize2 v-else class="zq-draw-block__header-btn-icon" />
            </button>
            <button class="zq-draw-block__close-btn" @click="closeEditor">
              {{ $t('zq-editor.draw.done') }}
            </button>
          </div>
        </div>
        <div class="zq-draw-block__editor-body">
          <component
            v-if="ZqDraw"
            :is="ZqDraw"
            :model-value="drawData ?? undefined"
            width="100%"
            height="100%"
            @update:model-value="onDrawChange"
          />
        </div>
      </div>
    </Teleport>
  </NodeViewWrapper>
</template>

<style scoped>
.zq-draw-block {
  margin: 0.75rem 0;
}

.zq-draw-block__view {
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  min-height: 80px;
  transition: border-color 0.15s;
}

.zq-draw-block.is-selected .zq-draw-block__view {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 1px var(--accent-shadow);
}

.zq-draw-block__view:hover {
  border-color: var(--border-strong);
}

.zq-draw-block__preview-host {
  cursor: pointer;
  min-height: 120px;
}

.zq-draw-block__preview-host :deep(canvas) {
  display: block;
  width: 100%;
}

.zq-draw-block__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  cursor: pointer;
  color: var(--text-tertiary);
  transition: color 0.15s, background 0.15s;
}

.zq-draw-block__empty:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.zq-draw-block__empty-icon {
  width: 28px;
  height: 28px;
  opacity: 0.5;
}

.zq-draw-block__empty span {
  font-size: 13px;
}

.zq-draw-block__toolbar {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.zq-draw-block__view:hover .zq-draw-block__toolbar {
  opacity: 1;
}

.zq-draw-block__btn {
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

.zq-draw-block__btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-draw-block__btn--danger:hover {
  color: #f56c6c;
}

.zq-draw-block__btn-icon {
  width: 14px;
  height: 14px;
}

/* --- Editor (inline) --- */
.zq-draw-block__editor {
  border: 2px solid var(--accent-color);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.25s ease;
}

.zq-draw-block__editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--bg-editor);
  border-bottom: 1px solid var(--border-color);
}

.zq-draw-block__editor-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.zq-draw-block__editor-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zq-draw-block__header-btn {
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

.zq-draw-block__header-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.zq-draw-block__header-btn-icon {
  width: 16px;
  height: 16px;
}

.zq-draw-block__close-btn {
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

.zq-draw-block__close-btn:hover {
  opacity: 0.85;
}

.zq-draw-block__editor-body {
  height: 480px;
  background: var(--bg-editor);
}

.zq-draw-block.is-editing {
  z-index: 5;
}

/* --- Fullscreen mode --- */
.zq-draw-block__editor--fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  border: none;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-editor);
}

.zq-draw-block__editor--fullscreen .zq-draw-block__editor-header {
  padding: 8px 16px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.zq-draw-block__editor--fullscreen .zq-draw-block__editor-header button,
.zq-draw-block__editor--fullscreen .zq-draw-block__editor-header .zq-draw-block__editor-actions {
  -webkit-app-region: no-drag;
}

.zq-draw-block__editor--fullscreen .zq-draw-block__editor-body {
  flex: 1;
  height: auto;
}
</style>
