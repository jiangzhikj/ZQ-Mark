<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useDrawStore } from '../store/draw-store';
import { useCanvasResize } from '../composables/use-canvas-resize';
import { useScrollWheel } from '../composables/use-scroll-wheel';
import { usePointerEvents } from '../composables/use-pointer-events';

const containerRef = ref<HTMLElement | null>(null);
const staticCanvasRef = ref<HTMLCanvasElement | null>(null);
const interactiveCanvasRef = ref<HTMLCanvasElement | null>(null);

const store = useDrawStore();

useCanvasResize(containerRef);
useScrollWheel(containerRef);
const pointer = usePointerEvents(containerRef);

onMounted(() => {
  store.staticCanvas = staticCanvasRef.value;
  store.interactiveCanvas = interactiveCanvasRef.value;
  pointer.attach();
  store.requestRender();
});

onBeforeUnmount(() => {
  pointer.detach();
});

watch(
  () => store.sceneVersion,
  () => {
    store.requestRender();
  },
);
</script>

<template>
  <div ref="containerRef" class="zq-draw-canvas-container">
    <canvas ref="staticCanvasRef" class="zq-draw-static-canvas" />
    <canvas ref="interactiveCanvasRef" class="zq-draw-interactive-canvas" />
  </div>
</template>

<style scoped lang="scss">
.zq-draw-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
}

.zq-draw-static-canvas,
.zq-draw-interactive-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.zq-draw-interactive-canvas {
  z-index: 1;
}
</style>
