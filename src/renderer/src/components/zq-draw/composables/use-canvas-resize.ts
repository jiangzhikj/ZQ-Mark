import { onMounted, onBeforeUnmount, type Ref } from 'vue';
import { useDrawStore } from '../store/draw-store';

export function useCanvasResize(containerRef: Ref<HTMLElement | null>) {
  const store = useDrawStore();
  let observer: ResizeObserver | null = null;

  function updateSize() {
    const el = containerRef.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    store.canvasWidth = rect.width;
    store.canvasHeight = rect.height;
    store.offsetTop = rect.top;
    store.offsetLeft = rect.left;
    store.requestRender();
  }

  onMounted(() => {
    updateSize();
    if (containerRef.value) {
      observer = new ResizeObserver(() => updateSize());
      observer.observe(containerRef.value);
    }
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
  });

  return { updateSize };
}
