<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Download,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from '@/components/icons';

const props = defineProps<{
  visible: boolean;
  src: string;
  alt?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.15;

const scale = ref(1);
const rotation = ref(0);
const panX = ref(0);
const panY = ref(0);

const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0, px: 0, py: 0 });

let bodyPrevOverflow = '';

const transformLayerStyle = computed(() => ({
  transform: `rotate(${rotation.value}deg) scale(${scale.value})`,
  transformOrigin: 'center center',
}));

const panLayerStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px)`,
}));

const stageCursor = computed(() => {
  if (!canPan.value) return 'default';
  return isDragging.value ? 'grabbing' : 'grab';
});

const canPan = computed(() => scale.value > 1.01);

function resetView() {
  scale.value = 1;
  rotation.value = 0;
  panX.value = 0;
  panY.value = 0;
}

async function downloadImage() {
  try {
    const response = await fetch(props.src)
    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    const urlPath = props.src.split('?')[0]
    const fileName = urlPath.split('/').pop() || 'image.png'
    if (window.electron) {
      await window.electron.saveArrayBufferAs(buffer, fileName)
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    }
  } catch (err) {
    console.error('Failed to download image:', err)
  }
}

function close() {
  emit('close');
}

function zoomIn() {
  scale.value = Math.min(MAX_SCALE, scale.value * ZOOM_STEP);
}

function zoomOut() {
  scale.value = Math.max(MIN_SCALE, scale.value / ZOOM_STEP);
}

function rotateCw() {
  rotation.value = (rotation.value + 90) % 360;
}

function rotateCcw() {
  rotation.value = (rotation.value - 90 + 360) % 360;
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  if (e.deltaY < 0) zoomIn();
  else zoomOut();
}

function onPanMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  if (!canPan.value) return;
  e.preventDefault();
  isDragging.value = true;
  dragStart.value = {
    x: e.clientX,
    y: e.clientY,
    px: panX.value,
    py: panY.value,
  };
  document.addEventListener('mousemove', onPanMouseMove);
  document.addEventListener('mouseup', onPanMouseUp);
}

function onPanMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  panX.value = dragStart.value.px + (e.clientX - dragStart.value.x);
  panY.value = dragStart.value.py + (e.clientY - dragStart.value.y);
}

function onPanMouseUp() {
  isDragging.value = false;
  document.removeEventListener('mousemove', onPanMouseMove);
  document.removeEventListener('mouseup', onPanMouseUp);
}

function onKeydown(ev: KeyboardEvent) {
  if (!props.visible) return;
  if (ev.key === 'Escape') {
    ev.preventDefault();
    close();
    return;
  }
  if (ev.key === '+' || ev.key === '=') {
    ev.preventDefault();
    zoomIn();
    return;
  }
  if (ev.key === '-' || ev.key === '_') {
    ev.preventDefault();
    zoomOut();
    return;
  }
  if (ev.key === '[') {
    ev.preventDefault();
    rotateCcw();
    return;
  }
  if (ev.key === ']') {
    ev.preventDefault();
    rotateCw();
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      resetView();
      bodyPrevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeydown);
    } else {
      document.body.style.overflow = bodyPrevOverflow;
      document.removeEventListener('keydown', onKeydown);
      onPanMouseUp();
    }
  },
);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  onPanMouseUp();
  document.body.style.overflow = bodyPrevOverflow;
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="zq-image-preview"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('zq-editor.image.previewTitle')"
      @click.self="close"
    >
      <button
        type="button"
        class="zq-image-preview__close"
        :aria-label="$t('zq-editor.image.previewClose')"
        @click="close"
      >
        <X class="h-5 w-5" />
      </button>

      <div class="zq-image-preview__viewport" @wheel.prevent="onWheel">
        <div
          class="zq-image-preview__pan"
          :style="[panLayerStyle, { cursor: stageCursor }]"
          @mousedown="onPanMouseDown"
        >
          <div class="zq-image-preview__transform" :style="transformLayerStyle">
            <img
              :src="src"
              :alt="alt || $t('zq-editor.image.previewTitle')"
              class="zq-image-preview__img"
              draggable="false"
              @dblclick.stop.prevent="resetView"
            />
          </div>
        </div>
      </div>

      <div class="zq-image-preview__toolbar" @click.stop @wheel.stop>
        <button
          type="button"
          class="zq-image-preview__tool"
          :title="$t('zq-editor.image.previewZoomOut')"
          :aria-label="$t('zq-editor.image.previewZoomOut')"
          @click="zoomOut"
        >
          <ZoomOut class="h-5 w-5" />
        </button>
        <button
          type="button"
          class="zq-image-preview__tool"
          :title="$t('zq-editor.image.previewZoomIn')"
          :aria-label="$t('zq-editor.image.previewZoomIn')"
          @click="zoomIn"
        >
          <ZoomIn class="h-5 w-5" />
        </button>
        <span class="zq-image-preview__toolbar-sep" aria-hidden="true" />
        <button
          type="button"
          class="zq-image-preview__tool"
          :title="$t('zq-editor.image.previewRotateLeft')"
          :aria-label="$t('zq-editor.image.previewRotateLeft')"
          @click="rotateCcw"
        >
          <RotateCcw class="h-5 w-5" />
        </button>
        <button
          type="button"
          class="zq-image-preview__tool"
          :title="$t('zq-editor.image.previewRotateRight')"
          :aria-label="$t('zq-editor.image.previewRotateRight')"
          @click="rotateCw"
        >
          <RotateCw class="h-5 w-5" />
        </button>
        <span class="zq-image-preview__toolbar-sep" aria-hidden="true" />
        <button
          type="button"
          class="zq-image-preview__tool"
          :title="$t('zq-editor.image.download')"
          :aria-label="$t('zq-editor.image.download')"
          @click="downloadImage"
        >
          <Download class="h-5 w-5" />
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.zq-image-preview {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.78);
  box-sizing: border-box;
  padding: 0;
}

.zq-image-preview__close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.zq-image-preview__close:hover {
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
}

.zq-image-preview__viewport {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
}

.zq-image-preview__pan {
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
}

.zq-image-preview__transform {
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
}

.zq-image-preview__img {
  max-width: min(92vw, 1200px);
  max-height: min(72vh, 900px);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
  vertical-align: middle;
}

.zq-image-preview__toolbar {
  position: absolute;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(30, 30, 30, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
}


.zq-image-preview__toolbar-sep {
  width: 1px;
  height: 22px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.2);
}

.zq-image-preview__tool {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.zq-image-preview__tool:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}


</style>
