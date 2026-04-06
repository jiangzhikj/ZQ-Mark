<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  Diamond,
  Minus,
  MoveRight,
  Pencil,
  Type,
  Image,
  Eraser,
  Frame,
} from '@/components/icons';

const { t: $t } = useI18n();
import { useDrawStore } from '../store/draw-store';
import type { ToolType } from '../types';

const store = useDrawStore();

interface ToolItem {
  type: ToolType;
  icon: any;
  labelKey: string;
  shortcut: string;
}

const tools: ToolItem[] = [
  { type: 'selection', icon: MousePointer2, labelKey: 'draw.tool.selection', shortcut: 'V' },
  { type: 'hand', icon: Hand, labelKey: 'draw.tool.hand', shortcut: 'H' },
  { type: 'rectangle', icon: Square, labelKey: 'draw.tool.rectangle', shortcut: 'R' },
  { type: 'ellipse', icon: Circle, labelKey: 'draw.tool.ellipse', shortcut: 'O' },
  { type: 'diamond', icon: Diamond, labelKey: 'draw.tool.diamond', shortcut: 'D' },
  { type: 'line', icon: Minus, labelKey: 'draw.tool.line', shortcut: 'L' },
  { type: 'arrow', icon: MoveRight, labelKey: 'draw.tool.arrow', shortcut: 'A' },
  { type: 'freedraw', icon: Pencil, labelKey: 'draw.tool.freedraw', shortcut: 'P' },
  { type: 'text', icon: Type, labelKey: 'draw.tool.text', shortcut: 'T' },
  { type: 'image', icon: Image, labelKey: 'draw.tool.image', shortcut: 'I' },
  { type: 'eraser', icon: Eraser, labelKey: 'draw.tool.eraser', shortcut: 'E' },
  { type: 'frame', icon: Frame, labelKey: 'draw.tool.frame', shortcut: 'F' },
];

const currentTool = computed(() => store.activeTool.type);

function selectTool(type: ToolType) {
  store.setActiveTool(type);
}
</script>

<template>
  <div class="zq-draw-toolbar">
    <div
      v-for="tool in tools"
      :key="tool.type"
      class="zq-draw-toolbar-item"
      :class="{ 'is-active': currentTool === tool.type }"
      :title="`${$t(tool.labelKey)} (${tool.shortcut})`"
      @click="selectTool(tool.type)"
    >
      <component :is="tool.icon" class="zq-draw-toolbar-icon" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.zq-draw-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.zq-draw-toolbar-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s;

  &:hover {
    background: var(--bg-hover);
  }

  &.is-active {
    background: var(--accent-shadow);
    color: var(--accent-color);
  }
}

.zq-draw-toolbar-icon {
  width: 18px;
  height: 18px;
}
</style>
