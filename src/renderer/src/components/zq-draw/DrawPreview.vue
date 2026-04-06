<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';

import type { DrawData, DrawElement, AppState, BinaryFiles } from './types';
import type { NormalizedZoomValue } from './types';
import { getCommonBounds } from './elements/bounds';
import { renderStaticScene } from './core/renderer/static-scene';
import { loadDrawFonts } from './fonts';

const props = withDefaults(
  defineProps<{
    data: DrawData;
    width: number;
    height: number;
  }>(),
  {
    width: 800,
    height: 450,
  },
);

const canvasRef = ref<HTMLCanvasElement>();
const containerRef = ref<HTMLDivElement>();
const imageCache = new Map<string, HTMLImageElement>();

function buildImageCache(files: BinaryFiles): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const [id, file] of Object.entries(files)) {
    if (imageCache.has(id)) continue;
    promises.push(
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          imageCache.set(id, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = file.dataURL;
      }),
    );
  }
  return Promise.all(promises).then(() => {});
}

function render() {
  const canvas = canvasRef.value;
  if (!canvas || !props.data) return;

  const elements = (props.data.elements || []).filter(
    (el) => !el.isDeleted,
  ) as DrawElement[];
  if (elements.length === 0) return;

  const [x1, y1, x2, y2] = getCommonBounds(elements);
  const contentWidth = x2 - x1;
  const contentHeight = y2 - y1;
  if (contentWidth <= 0 || contentHeight <= 0) return;

  const displayWidth = props.width;
  const displayHeight = props.height;

  const padding = 20;
  const zoom = Math.min(
    displayWidth / (contentWidth + padding * 2),
    displayHeight / (contentHeight + padding * 2),
  );

  const scrollX = -x1 + padding + (displayWidth / zoom - contentWidth - padding * 2) / 2;
  const scrollY = -y1 + padding + (displayHeight / zoom - contentHeight - padding * 2) / 2;

  const appState: AppState = {
    viewBackgroundColor:
      props.data.appState?.viewBackgroundColor || 'transparent',
    zoom: { value: zoom as NormalizedZoomValue },
    scrollX,
    scrollY,
    width: displayWidth,
    height: displayHeight,
    offsetTop: 0,
    offsetLeft: 0,
    theme: props.data.appState?.theme || 'light',
    gridModeEnabled: false,
    gridSize: 20,
    gridStep: 5,
    frameRendering: { enabled: true, name: true, outline: true, clip: true },
    exportBackground: true,
    exportScale: 2,
    exportWithDarkMode: false,
  } as AppState;

  renderStaticScene(
    canvas,
    elements,
    appState,
    props.data.files || {},
    imageCache,
  );
}

async function doRender() {
  if (props.data?.files) {
    await buildImageCache(props.data.files);
  }
  await nextTick();
  render();
}

onMounted(async () => {
  await loadDrawFonts();
  await doRender();
});

watch(
  () => [props.data, props.width, props.height],
  () => doRender(),
  { deep: true },
);

defineExpose({ render: doRender });
</script>

<template>
  <div
    ref="containerRef"
    class="draw-preview"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <canvas ref="canvasRef" class="draw-preview__canvas" />
  </div>
</template>

<style scoped>
.draw-preview {
  overflow: hidden;
}

.draw-preview__canvas {
  display: block;
}
</style>
