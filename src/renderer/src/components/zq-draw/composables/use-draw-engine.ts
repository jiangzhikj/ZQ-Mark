import { onMounted, onBeforeUnmount, watch } from 'vue';
import type { DrawData } from '../types';
import { useDrawStore } from '../store/draw-store';

export function useDrawEngine(opts: {
  initialData?: DrawData | null;
  readonly?: boolean;
}) {
  const store = useDrawStore();

  onMounted(() => {
    store.init();

    if (opts.initialData) {
      store.loadDrawData(opts.initialData);
    }

    store.requestRender();
  });

  watch(
    () => opts.readonly,
    (val) => {
      store.viewModeEnabled = !!val;
      store.requestRender();
    },
  );

  onBeforeUnmount(() => {
    store.destroy();
  });

  return { store };
}
