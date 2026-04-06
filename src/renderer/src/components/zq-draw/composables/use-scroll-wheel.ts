import { onMounted, onBeforeUnmount, type Ref } from 'vue';
import { useDrawStore } from '../store/draw-store';
import { MIN_ZOOM, MAX_ZOOM } from '../constants';
import type { NormalizedZoomValue } from '../types';

export function useScrollWheel(containerRef: Ref<HTMLElement | null>) {
  const store = useDrawStore();

  function handleWheel(e: WheelEvent) {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // zoom
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.03 : 0.97;
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, store.zoom.value * factor),
      );

      const rect = containerRef.value?.getBoundingClientRect();
      if (rect) {
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        const oldZoom = store.zoom.value;

        store.scrollX =
          clientX / newZoom - clientX / oldZoom + store.scrollX;
        store.scrollY =
          clientY / newZoom - clientY / oldZoom + store.scrollY;
      }

      store.zoom = { value: newZoom as NormalizedZoomValue };
      store.requestRender();
    } else {
      // pan
      store.scrollX -= e.deltaX / store.zoom.value;
      store.scrollY -= e.deltaY / store.zoom.value;
      store.requestRender();
    }
  }

  onMounted(() => {
    containerRef.value?.addEventListener('wheel', handleWheel, {
      passive: false,
    });
  });

  onBeforeUnmount(() => {
    containerRef.value?.removeEventListener('wheel', handleWheel);
  });
}
