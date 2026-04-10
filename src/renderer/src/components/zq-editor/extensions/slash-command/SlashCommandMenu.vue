<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import {
  AlignJustify,
  ChevronRight as ChevronRightIcon,
  Code,
  Columns2,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Info,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Music,
  Paperclip,
  Pencil,
  Quote,
  Shapes,
  Sigma,
  Smile,
  Table,
  Video,
  Workflow,
} from '@/components/icons';

import type { SlashCommandItem } from './commands';

interface Props {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

const props = defineProps<Props>();
const selectedIndex = ref(0);
const menuRef = ref<HTMLElement>();

const iconMap: Record<string, any> = {
  AlignJustify,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Minus,
  Music,
  Table,
  Info,
  Image,
  ChevronRight: ChevronRightIcon,
  Columns2,
  Sigma,
  Link,
  Video,
  Paperclip,
  Smile,
  Pencil,
  Shapes,
  Workflow,
};

const flatItems = computed(() => props.items || []);

/** 与 flatItems 顺序一致，仅插入分类标题；避免「分组 Map 展开顺序」与 flat 顺序不一致导致方向键高亮乱跳 */
const slashRows = computed(() => {
  const items = flatItems.value;
  const rows: Array<
    | { kind: 'category'; label: string }
    | { kind: 'item'; item: SlashCommandItem; index: number }
  > = [];
  let prevCategory: string | null = null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (item.category !== prevCategory) {
      rows.push({ kind: 'category', label: item.category });
      prevCategory = item.category;
    }
    rows.push({ kind: 'item', item, index: i });
  }
  return rows;
});

function selectItem(index: number) {
  const item = flatItems.value[index];
  if (item && !item.disabled) {
    props.command(item);
  }
}

function moveSelection(delta: 1 | -1) {
  const items = flatItems.value;
  const len = items.length;
  if (len === 0) return;
  let idx = selectedIndex.value;
  for (let step = 0; step < len; step++) {
    idx = (idx + delta + len) % len;
    if (!items[idx]?.disabled) {
      selectedIndex.value = idx;
      scrollToSelected();
      return;
    }
  }
}

function onItemMouseEnter(index: number) {
  if (flatItems.value[index]?.disabled) return;
  selectedIndex.value = index;
}

function scrollToSelected() {
  nextTick(() => {
    const el = menuRef.value?.querySelector('.is-selected');
    el?.scrollIntoView({ block: 'nearest' });
  });
}

function onKeyDown(event: KeyboardEvent) {
  const len = flatItems.value.length;
  if (len === 0) return false;

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveSelection(-1);
    return true;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveSelection(1);
    return true;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    if (flatItems.value[selectedIndex.value]?.disabled) return true;
    selectItem(selectedIndex.value);
    return true;
  }
  return false;
}

function firstEnabledIndex(items: SlashCommandItem[]): number {
  const i = items.findIndex((it) => !it.disabled);
  return i >= 0 ? i : 0;
}

watch(
  () => props.items,
  (items) => {
    const len = items?.length ?? 0;
    if (len === 0) {
      selectedIndex.value = 0;
      return;
    }
    if (selectedIndex.value >= len) {
      selectedIndex.value = len - 1;
    }
    if (items[selectedIndex.value]?.disabled) {
      selectedIndex.value = firstEnabledIndex(items);
    }
  },
  { deep: true },
);

onMounted(() => {
  selectedIndex.value = firstEnabledIndex(flatItems.value);
});

onUnmounted(() => {
  selectedIndex.value = 0;
});

defineExpose({ onKeyDown });
</script>

<template>
  <div ref="menuRef" class="zq-slash-menu">
    <template v-if="flatItems.length > 0">
      <template v-for="(row, ri) in slashRows" :key="row.kind === 'category' ? `c-${row.label}-${ri}` : `i-${row.index}-${row.item.title}`">
        <div v-if="row.kind === 'category'" class="zq-slash-menu__category">
          {{ row.label }}
        </div>
        <button
          v-else
          type="button"
          class="zq-slash-menu__item"
          :class="{
            'is-selected': row.index === selectedIndex,
            'is-disabled': row.item.disabled,
          }"
          :disabled="row.item.disabled"
          @click="selectItem(row.index)"
          @mouseenter="onItemMouseEnter(row.index)"
        >
          <span class="zq-slash-menu__icon">
            <component
              :is="iconMap[row.item.icon]"
              v-if="iconMap[row.item.icon]"
              class="h-4 w-4"
            />
          </span>
          <span class="zq-slash-menu__text">
            <span class="zq-slash-menu__title">{{ row.item.title }}</span>
            <span class="zq-slash-menu__desc">{{ row.item.description }}</span>
          </span>
        </button>
      </template>
    </template>
    <div v-else class="zq-slash-menu__empty">
      {{ $t('zq-editor.slash.noResult') }}
    </div>
  </div>
</template>

<style>
.tippy-box[data-theme~='zq-slash'] {
  background-color: transparent !important;
  color: inherit !important;
}

.tippy-box[data-theme~='zq-slash'] .tippy-content {
  padding: 0 !important;
}

.tippy-box[data-theme~='zq-slash'] .tippy-arrow {
  display: none !important;
}
</style>

<style scoped>
.zq-slash-menu {
  min-width: 280px;
  max-width: 400px;
  max-height: 360px;
  overflow-y: auto;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
  padding: 6px;
}

.zq-slash-menu::-webkit-scrollbar {
  width: 5px;
}

.zq-slash-menu::-webkit-scrollbar-track {
  background: transparent;
}

.zq-slash-menu::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.2s;
}

.zq-slash-menu:hover::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
}

.zq-slash-menu__category {
  padding: 6px 10px 4px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.zq-slash-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.12s;
  text-align: left;
}

.zq-slash-menu__item:hover:not(.is-disabled),
.zq-slash-menu__item.is-selected:not(.is-disabled) {
  background-color: var(--el-fill-color-light);
}

.zq-slash-menu__item.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zq-slash-menu__item.is-disabled .zq-slash-menu__title,
.zq-slash-menu__item.is-disabled .zq-slash-menu__desc {
  color: var(--el-text-color-secondary);
}

.zq-slash-menu__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 6px;
  background-color: var(--el-fill-color);
  color: var(--el-text-color-regular);
  flex-shrink: 0;
}

.zq-slash-menu__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.zq-slash-menu__title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.zq-slash-menu__desc {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}

.zq-slash-menu__empty {
  padding: 1rem;
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 0.875rem;
}
</style>
