<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { nextTick, ref, watch } from 'vue';

import {
  ArrowDown,
  ArrowUp,
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from '@/components/icons';
import { $t } from '../utils/i18n';

import { scrollToResult } from '../extensions/search-replace';

interface Props {
  editor: Editor;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

const searchTerm = ref('');
const replaceTerm = ref('');
const caseSensitive = ref(false);
const showReplace = ref(false);
const searchInputRef = ref<HTMLInputElement>();

const matchCount = ref(0);
const currentIndex = ref(0);

function open(opts?: { showReplace?: boolean }) {
  showReplace.value = opts?.showReplace ?? false;
  nextTick(() => {
    searchInputRef.value?.focus();
    searchInputRef.value?.select();
  });
}

function close() {
  props.editor.commands.clearSearch();
  searchTerm.value = '';
  replaceTerm.value = '';
  emit('close');
}

function syncResults() {
  const storage = props.editor.storage.searchReplace;
  if (storage) {
    matchCount.value = storage.results?.length ?? 0;
    currentIndex.value = storage.currentIndex ?? 0;
  }
}

function doSearch() {
  props.editor.commands.setSearchTerm(searchTerm.value);
  syncResults();
  scrollToCurrent();
}

function goNext() {
  props.editor.commands.nextSearchResult();
  syncResults();
  scrollToCurrent();
}

function goPrev() {
  props.editor.commands.previousSearchResult();
  syncResults();
  scrollToCurrent();
}

function toggleCaseSensitive() {
  caseSensitive.value = !caseSensitive.value;
  props.editor.commands.setCaseSensitive(caseSensitive.value);
  syncResults();
  scrollToCurrent();
}

function replaceCurrent() {
  props.editor.commands.replaceCurrentResult();
  syncResults();
  scrollToCurrent();
}

function replaceAll() {
  props.editor.commands.replaceAllResults();
  syncResults();
}

function scrollToCurrent() {
  const storage = props.editor.storage.searchReplace;
  const match = storage?.results?.[storage.currentIndex];
  if (match) {
    scrollToResult(props.editor, match);
  }
}

function preventBrowserFind(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && (e.key === 'f' || e.key === 'h')) {
    e.preventDefault();
    if (e.key === 'f') {
      searchInputRef.value?.focus();
      searchInputRef.value?.select();
    }
    if (e.key === 'h') {
      showReplace.value = true;
    }
  }
}

function onSearchKeydown(e: KeyboardEvent) {
  preventBrowserFind(e);
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      goPrev();
    } else {
      goNext();
    }
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
}

function onReplaceKeydown(e: KeyboardEvent) {
  preventBrowserFind(e);
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    replaceCurrent();
  }
}

watch(searchTerm, () => {
  doSearch();
});

watch(replaceTerm, (val) => {
  props.editor.commands.setReplaceTerm(val);
});

defineExpose({ open });
</script>

<template>
  <div class="zq-search-panel" @mousedown.stop @keydown.stop>
    <!-- Search row -->
    <div class="zq-search-panel__row">
      <button
        class="zq-search-panel__toggle"
        :title="showReplace ? $t('zq-editor.search.hideReplace') : $t('zq-editor.search.showReplace')"
        @click="showReplace = !showReplace"
      >
        <ChevronDown v-if="showReplace" class="h-3.5 w-3.5" />
        <ChevronUp v-else class="h-3.5 w-3.5" />
      </button>

      <div class="zq-search-panel__input-wrap">
        <Search class="zq-search-panel__input-icon" />
        <input
          ref="searchInputRef"
          v-model="searchTerm"
          class="zq-search-panel__input"
          :placeholder="$t('zq-editor.search.findPlaceholder')"
          @keydown="onSearchKeydown"
        />
        <button
          class="zq-search-panel__btn-icon"
          :class="{ 'is-active': caseSensitive }"
          :title="$t('zq-editor.search.caseSensitive')"
          @click="toggleCaseSensitive"
        >
          <CaseSensitive class="h-3.5 w-3.5" />
        </button>
      </div>

      <span class="zq-search-panel__count">
        <template v-if="searchTerm && matchCount > 0">
          {{ currentIndex + 1 }} / {{ matchCount }}
        </template>
        <template v-else-if="searchTerm">
          {{ $t('zq-editor.search.noResults') }}
        </template>
      </span>

      <button
        class="zq-search-panel__btn-icon"
        :disabled="matchCount === 0"
        :title="$t('zq-editor.search.previousMatch')"
        @click="goPrev"
      >
        <ArrowUp class="h-3.5 w-3.5" />
      </button>
      <button
        class="zq-search-panel__btn-icon"
        :disabled="matchCount === 0"
        :title="$t('zq-editor.search.nextMatch')"
        @click="goNext"
      >
        <ArrowDown class="h-3.5 w-3.5" />
      </button>
      <button
        class="zq-search-panel__btn-icon"
        :title="$t('zq-editor.search.close')"
        @click="close"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- Replace row -->
    <div v-if="showReplace" class="zq-search-panel__row">
      <div class="zq-search-panel__spacer" />

      <div class="zq-search-panel__input-wrap">
        <input
          v-model="replaceTerm"
          class="zq-search-panel__input zq-search-panel__input--replace"
          :placeholder="$t('zq-editor.search.replacePlaceholder')"
          @keydown="onReplaceKeydown"
        />
      </div>

      <button
        class="zq-search-panel__btn-text"
        :disabled="matchCount === 0"
        @click="replaceCurrent"
      >
        {{ $t('zq-editor.search.replace') }}
      </button>
      <button
        class="zq-search-panel__btn-text"
        :disabled="matchCount === 0"
        @click="replaceAll"
      >
        {{ $t('zq-editor.search.replaceAll') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.zq-search-panel {
  position: fixed;
  top: 82px;
  right: 24px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.1),
    0 2px 4px rgba(0, 0, 0, 0.06);
  min-width: 360px;
}

.zq-search-panel__row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zq-search-panel__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.zq-search-panel__toggle:hover {
  background: var(--el-fill-color-light);
}

.zq-search-panel__spacer {
  width: 24px;
  flex-shrink: 0;
}

.zq-search-panel__input-wrap {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 4px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  transition: border-color 0.2s;
}

.zq-search-panel__input-wrap:focus-within {
  border-color: var(--el-color-primary);
}

.zq-search-panel__input-icon {
  width: 14px;
  height: 14px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.zq-search-panel__input {
  flex: 1;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--el-text-color-primary);
  min-width: 0;
}

.zq-search-panel__input::placeholder {
  color: var(--el-text-color-placeholder);
}

.zq-search-panel__count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  min-width: 50px;
  text-align: center;
  flex-shrink: 0;
}

.zq-search-panel__btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.12s;
}

.zq-search-panel__btn-icon:hover:not(:disabled) {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.zq-search-panel__btn-icon:disabled {
  color: var(--el-text-color-disabled);
  cursor: not-allowed;
}

.zq-search-panel__btn-icon.is-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.zq-search-panel__btn-text {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 5px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.12s;
}

.zq-search-panel__btn-text:hover:not(:disabled) {
  background: var(--el-fill-color-light);
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}

.zq-search-panel__btn-text:disabled {
  color: var(--el-text-color-disabled);
  cursor: not-allowed;
}
</style>
