<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Undo2, Redo2 } from '@/components/icons';

const { t: $t } = useI18n();
import { useDrawStore } from '../store/draw-store';

const store = useDrawStore();
</script>

<template>
  <div class="zq-draw-undo-redo">
    <button
      class="zq-draw-undo-btn"
      :class="{ 'is-disabled': !store.canUndo }"
      :disabled="!store.canUndo"
      :title="`${$t('draw.action.undo')} (Ctrl+Z)`"
      @click="store.undo()"
    >
      <Undo2 class="zq-draw-undo-icon" />
    </button>
    <button
      class="zq-draw-undo-btn"
      :class="{ 'is-disabled': !store.canRedo }"
      :disabled="!store.canRedo"
      :title="`${$t('draw.action.redo')} (Ctrl+Y)`"
      @click="store.redo()"
    >
      <Redo2 class="zq-draw-undo-icon" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.zq-draw-undo-redo {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.zq-draw-undo-btn {
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

  &:hover:not(.is-disabled) {
    background: var(--bg-hover);
  }

  &.is-disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.zq-draw-undo-icon {
  width: 16px;
  height: 16px;
}
</style>
