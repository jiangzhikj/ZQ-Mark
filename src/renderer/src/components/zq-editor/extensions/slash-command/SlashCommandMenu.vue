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
  PenTool,
  Quote,
  Sigma,
  Smile,
  Table,
  Video,
} from '@/components/icons';

import type { SlashCommandItem } from './commands';

import { groupCommandsByCategory } from './commands';

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
  PenTool,
  Pencil,
};

const groupedItems = computed(() =>
  groupCommandsByCategory(props.items || []),
);

const flatItems = computed(() => props.items || []);

function selectItem(index: number) {
  const item = flatItems.value[index];
  if (item) {
    props.command(item);
  }
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
    selectedIndex.value = (selectedIndex.value + len - 1) % len;
    scrollToSelected();
    return true;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    selectedIndex.value = (selectedIndex.value + 1) % len;
    scrollToSelected();
    return true;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    selectItem(selectedIndex.value);
    return true;
  }
  return false;
}

watch(
  () => props.items,
  () => {
    selectedIndex.value = 0;
  },
);

onMounted(() => {
  selectedIndex.value = 0;
});

onUnmounted(() => {
  selectedIndex.value = 0;
});

defineExpose({ onKeyDown });
</script>

<template>
  <div ref="menuRef" class="zq-slash-menu">
    <template v-if="flatItems.length > 0">
      <template v-for="[category, items] in groupedItems" :key="category">
        <div class="zq-slash-menu__category">{{ category }}</div>
        <button
          v-for="item in items"
          :key="item.title"
          class="zq-slash-menu__item"
          :class="{
            'is-selected':
              flatItems.indexOf(item) === selectedIndex,
          }"
          @click="selectItem(flatItems.indexOf(item))"
          @mouseenter="selectedIndex = flatItems.indexOf(item)"
        >
          <span class="zq-slash-menu__icon">
            <component
              :is="iconMap[item.icon]"
              v-if="iconMap[item.icon]"
              class="h-4 w-4"
            />
          </span>
          <span class="zq-slash-menu__text">
            <span class="zq-slash-menu__title">{{ item.title }}</span>
            <span class="zq-slash-menu__desc">{{ item.description }}</span>
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

.zq-slash-menu__item:hover,
.zq-slash-menu__item.is-selected {
  background-color: var(--el-fill-color-light);
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
