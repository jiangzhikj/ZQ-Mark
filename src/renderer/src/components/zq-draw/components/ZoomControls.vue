<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ZoomIn, ZoomOut, Maximize, ScanSearch } from '@/components/icons';

const { t: $t } = useI18n();
import { useDrawStore } from '../store/draw-store';

const store = useDrawStore();

const zoomPercentage = computed(() => {
  return `${Math.round(store.zoom.value * 100)}%`;
});
</script>

<template>
  <div class="zq-draw-zoom-controls">
    <button
      class="zq-draw-zoom-btn"
      :title="$t('draw.action.zoomOut')"
      @click="store.zoomOut()"
    >
      <ZoomOut class="zq-draw-zoom-icon" />
    </button>
    <button
      class="zq-draw-zoom-label"
      :title="$t('draw.action.resetZoom')"
      @click="store.resetZoom()"
    >
      {{ zoomPercentage }}
    </button>
    <button
      class="zq-draw-zoom-btn"
      :title="$t('draw.action.zoomIn')"
      @click="store.zoomIn()"
    >
      <ZoomIn class="zq-draw-zoom-icon" />
    </button>
    <button
      class="zq-draw-zoom-btn"
      :title="$t('draw.action.zoomToFit')"
      @click="store.zoomToFit()"
    >
      <Maximize class="zq-draw-zoom-icon" />
    </button>
    <button
      class="zq-draw-zoom-btn"
      :title="$t('draw.action.zoomToFitSelection')"
      @click="store.zoomToFitSelection()"
    >
      <ScanSearch class="zq-draw-zoom-icon" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.zq-draw-zoom-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.zq-draw-zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s;

  &:hover {
    background: var(--bg-hover);
  }
}

.zq-draw-zoom-label {
  min-width: 50px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  transition: all 0.15s;

  &:hover {
    background: var(--bg-hover);
  }
}

.zq-draw-zoom-icon {
  width: 16px;
  height: 16px;
}
</style>
