<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ImageOff,
  RotateCw,
  Trash2,
} from '@/components/icons';

import { NodeViewWrapper } from '@tiptap/vue-3';

const props = defineProps<{
  deleteNode: () => void;
  editor: any;
  node: any;
  selected: boolean;
  updateAttributes: (attrs: Record<string, any>) => void;
}>();

const imageVisible = ref(false);
const hasError = ref(false);

const displaySrc = computed(() => props.node.attrs.src || '');

watch(
  () => props.node.attrs.src,
  () => {
    hasError.value = false;
    imageVisible.value = false;
  },
);

const imgRef = ref<HTMLImageElement | null>(null);
const isResizing = ref(false);
const startX = ref(0);
const startWidth = ref(0);
const startHeight = ref(0);
const resizeDirection = ref('');
const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const originalRatio = ref(1);

const showError = computed(() => {
  if (!displaySrc.value) return true;
  return hasError.value && !imageVisible.value;
});

const placeholderStyle = computed(() => {
  const style: Record<string, string> = {};
  const w = props.node.attrs.width;
  const h = props.node.attrs.height;

  if (w) {
    style.width = typeof w === 'number' ? `${w}px` : w;
  }
  if (h) {
    style.height = typeof h === 'number' ? `${h}px` : h;
  }

  if (!w && !h) {
    style.width = '100%';
    style.aspectRatio = '16 / 9';
  } else if (w && !h) {
    style.aspectRatio = '16 / 9';
  } else if (!w && h) {
    style.aspectRatio = '16 / 9';
  }

  return style;
});

const imageStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.node.attrs.width) {
    style.width =
      typeof props.node.attrs.width === 'number'
        ? `${props.node.attrs.width}px`
        : props.node.attrs.width;
  }
  if (props.node.attrs.height) {
    style.height =
      typeof props.node.attrs.height === 'number'
        ? `${props.node.attrs.height}px`
        : props.node.attrs.height;
  }
  return style;
});

const wrapperStyle = computed(() => {
  const alignment = props.node.attrs.alignment || 'center';
  const justifyMap: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };
  return { justifyContent: justifyMap[alignment] || 'center' };
});

const presetSizes = [
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: '100%', value: 100 },
];

function handleImageLoad() {
  hasError.value = false;
  imageVisible.value = true;
  if (imgRef.value) {
    const { naturalWidth, naturalHeight } = imgRef.value;
    originalRatio.value = naturalWidth / naturalHeight;

    if (!props.node.attrs.width && !props.node.attrs.height && naturalWidth > 0) {
      const editorEl = props.editor?.view?.dom?.parentElement;
      const containerWidth = editorEl?.clientWidth || 800;
      const maxWidth = containerWidth - 32;
      const w = Math.min(naturalWidth, maxWidth);
      const h = Math.round(w / originalRatio.value);
      props.updateAttributes({ width: w, height: h });
    }
  }
}

function handleImageError() {
  imageVisible.value = false;
  hasError.value = true;
}

function handleRetry() {
  hasError.value = false;
  imageVisible.value = false;
  const src = props.node.attrs.src;
  if (src && imgRef.value) {
    imgRef.value.src = '';
    nextTick(() => {
      if (imgRef.value) {
        imgRef.value.src = src;
      }
    });
  }
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  contextMenuPosition.value = { x: e.clientX, y: e.clientY };
  contextMenuVisible.value = true;
  setTimeout(() => {
    document.addEventListener('click', closeContextMenu);
  }, 0);
}

function closeContextMenu() {
  contextMenuVisible.value = false;
  document.removeEventListener('click', closeContextMenu);
}

function startResize(e: MouseEvent, direction: string) {
  e.preventDefault();
  e.stopPropagation();
  isResizing.value = true;
  resizeDirection.value = direction;
  startX.value = e.clientX;
  if (imgRef.value) {
    startWidth.value = imgRef.value.offsetWidth;
    startHeight.value = imgRef.value.offsetHeight;
  }
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
}

function handleResize(e: MouseEvent) {
  if (!isResizing.value) return;
  const deltaX = e.clientX - startX.value;
  const isLeft = resizeDirection.value.includes('w');
  const newWidth = isLeft
    ? Math.max(50, startWidth.value - deltaX)
    : Math.max(50, startWidth.value + deltaX);
  const newHeight = Math.round(newWidth / originalRatio.value);
  props.updateAttributes({ width: newWidth, height: newHeight });
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
}

function setAlignment(alignment: 'center' | 'left' | 'right') {
  props.updateAttributes({ alignment });
  closeContextMenu();
}

function setPresetSize(percent: number) {
  if (!imgRef.value) return;
  const editorEl = props.editor?.view?.dom?.parentElement;
  const containerWidth = editorEl?.clientWidth || 800;
  const maxWidth = containerWidth - 32;
  const newWidth = Math.round((maxWidth * percent) / 100);
  const newHeight = Math.round(newWidth / originalRatio.value);
  props.updateAttributes({ width: newWidth, height: newHeight });
  closeContextMenu();
}

function resetSize() {
  if (imgRef.value) {
    props.updateAttributes({
      width: imgRef.value.naturalWidth,
      height: imgRef.value.naturalHeight,
    });
  }
  closeContextMenu();
}

function handleDelete() {
  props.deleteNode();
  closeContextMenu();
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.removeEventListener('click', closeContextMenu);
});
</script>

<template>
  <NodeViewWrapper class="zq-image-wrapper flex" :style="wrapperStyle">
    <div
      class="zq-image-container"
      :class="{ 'is-selected': selected, 'is-resizing': isResizing }"
    >
      <!-- Error state -->
      <div
        v-if="showError"
        class="zq-image-placeholder zq-image-placeholder--error"
        :style="placeholderStyle"
      >
        <ImageOff class="zq-image-placeholder__icon" />
        <span class="zq-image-placeholder__text">
          {{ $t('zq-editor.image.loadFailed') }}
        </span>
        <button class="zq-image-placeholder__retry" @click="handleRetry">
          <RotateCw class="h-3 w-3" />
          {{ $t('zq-editor.image.retry') }}
        </button>
      </div>

      <img
        v-if="displaySrc && !hasError"
        ref="imgRef"
        :src="displaySrc"
        :alt="node.attrs.alt"
        :title="node.attrs.title"
        :style="imageStyle"
        class="zq-image"
        :class="{ 'is-visible': imageVisible }"
        draggable="false"
        @load="handleImageLoad"
        @error="handleImageError"
        @contextmenu="handleContextMenu"
      />

      <template v-if="selected && imageVisible">
        <div class="zq-resize-handle zq-resize-nw" @mousedown="(e) => startResize(e, 'nw')" />
        <div class="zq-resize-handle zq-resize-ne" @mousedown="(e) => startResize(e, 'ne')" />
        <div class="zq-resize-handle zq-resize-sw" @mousedown="(e) => startResize(e, 'sw')" />
        <div class="zq-resize-handle zq-resize-se" @mousedown="(e) => startResize(e, 'se')" />
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="zq-image-menu"
        :style="{
          left: `${contextMenuPosition.x}px`,
          top: `${contextMenuPosition.y}px`,
        }"
        @click.stop
      >
        <div class="zq-image-menu__group">
          <div class="zq-image-menu__label">{{ $t('zq-editor.image.alignment') }}</div>
          <div class="zq-image-menu__row">
            <button
              class="zq-image-menu__icon-btn"
              :class="{ 'is-active': node.attrs.alignment === 'left' }"
              :title="$t('zq-editor.image.alignLeft')"
              @click="setAlignment('left')"
            >
              <AlignLeft class="h-4 w-4" />
            </button>
            <button
              class="zq-image-menu__icon-btn"
              :class="{ 'is-active': node.attrs.alignment === 'center' }"
              :title="$t('zq-editor.image.alignCenter')"
              @click="setAlignment('center')"
            >
              <AlignCenter class="h-4 w-4" />
            </button>
            <button
              class="zq-image-menu__icon-btn"
              :class="{ 'is-active': node.attrs.alignment === 'right' }"
              :title="$t('zq-editor.image.alignRight')"
              @click="setAlignment('right')"
            >
              <AlignRight class="h-4 w-4" />
            </button>
          </div>
        </div>
        <div class="zq-image-menu__divider" />
        <div class="zq-image-menu__group">
          <div class="zq-image-menu__row">
            <button
              v-for="size in presetSizes"
              :key="size.value"
              class="zq-image-menu__size-btn"
              @click="setPresetSize(size.value)"
            >
              {{ size.label }}
            </button>
          </div>
        </div>
        <div class="zq-image-menu__divider" />
        <button class="zq-image-menu__item" @click="resetSize">
          <RotateCw class="zq-image-menu__item-icon" />
          <span>{{ $t('zq-editor.image.reset') }}</span>
        </button>
        <button class="zq-image-menu__item zq-image-menu__item--danger" @click="handleDelete">
          <Trash2 class="zq-image-menu__item-icon" />
          <span>{{ $t('zq-editor.image.delete') }}</span>
        </button>
      </div>
    </Teleport>
  </NodeViewWrapper>
</template>

<style scoped>
.zq-image-wrapper {
  margin: 0.5em 0;
}

.zq-image-container {
  position: relative;
  display: inline-block;
  line-height: 0;
}

.zq-image-container.is-selected .zq-image.is-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.zq-image-container.is-resizing {
  user-select: none;
}

/* Placeholder / skeleton */
.zq-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 6px;
  background-color: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  overflow: hidden;
  position: relative;
  min-height: 80px;
}

.zq-image-placeholder__shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--el-fill-color-light) 50%,
    transparent 100%
  );
  animation: zq-shimmer 1.5s infinite;
}

@keyframes zq-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.zq-image-placeholder--error {
  background-color: var(--el-fill-color-lighter);
  border: 1px dashed var(--el-border-color);
}

.zq-image-placeholder__icon {
  width: 32px;
  height: 32px;
  color: var(--el-text-color-placeholder);
}

.zq-image-placeholder__text {
  font-size: 0.8125rem;
  color: var(--el-text-color-placeholder);
  line-height: 1;
}

.zq-image-placeholder__retry {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  font-size: 0.75rem;
  color: var(--el-color-primary);
  background: transparent;
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.zq-image-placeholder__retry:hover {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

/*
  Image starts at opacity 0, transitions to 1 when .is-visible is added.
  On re-mount after resize, the browser loads from cache so @load fires
  almost instantly — the transition is imperceptible.
*/
.zq-image {
  display: block;
  max-width: 100%;
  border-radius: 6px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.zq-image.is-visible {
  opacity: 1;
}

.zq-resize-handle {
  position: absolute;
  z-index: 10;
  width: 10px;
  height: 10px;
  background-color: var(--el-bg-color);
  border: 2px solid var(--el-color-primary);
  border-radius: 3px;
}

.zq-resize-handle:hover {
  background-color: var(--el-color-primary-dark-2);
}

.zq-resize-nw { top: -5px; left: -5px; cursor: nw-resize; }
.zq-resize-ne { top: -5px; right: -5px; cursor: ne-resize; }
.zq-resize-sw { bottom: -5px; left: -5px; cursor: sw-resize; }
.zq-resize-se { bottom: -5px; right: -5px; cursor: se-resize; }

.zq-image-menu {
  position: fixed;
  z-index: 9999;
  min-width: 170px;
  padding: 6px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.zq-image-menu__group { padding: 4px 6px; }
.zq-image-menu__label { font-size: 0.7rem; color: var(--el-text-color-secondary); margin-bottom: 4px; font-weight: 600; }
.zq-image-menu__row { display: flex; gap: 4px; }
.zq-image-menu__divider { height: 1px; background: var(--el-border-color-lighter); margin: 4px 6px; }

.zq-image-menu__icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 26px;
  border: 1px solid var(--el-border-color); border-radius: 4px;
  background: transparent; cursor: pointer; color: var(--el-text-color-regular);
  transition: all 0.15s;
}

.zq-image-menu__icon-btn:hover { border-color: var(--el-color-primary); color: var(--el-color-primary); }
.zq-image-menu__icon-btn.is-active { background: var(--el-color-primary); color: var(--el-color-white); border-color: var(--el-color-primary); }

.zq-image-menu__size-btn {
  flex: 1; height: 26px; font-size: 0.75rem;
  border: 1px solid var(--el-border-color); border-radius: 4px;
  background: transparent; cursor: pointer; color: var(--el-text-color-regular);
  transition: all 0.15s;
}

.zq-image-menu__size-btn:hover { border-color: var(--el-color-primary); color: var(--el-color-primary); background: var(--el-color-primary-light-9); }

.zq-image-menu__item {
  display: flex; align-items: center; width: 100%;
  padding: 6px 8px; border: none; background: transparent;
  cursor: pointer; font-size: 0.8125rem; color: var(--el-text-color-regular);
  border-radius: 5px; transition: background-color 0.12s; text-align: left; gap: 6px;
}

.zq-image-menu__item:hover { background: var(--el-fill-color-light); }
.zq-image-menu__item--danger { color: var(--el-color-danger); }
.zq-image-menu__item--danger:hover { background: var(--el-color-danger-light-9); }
.zq-image-menu__item-icon { width: 15px; height: 15px; flex-shrink: 0; }
</style>
