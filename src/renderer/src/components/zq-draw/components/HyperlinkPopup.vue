<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Link, ExternalLink, Trash2, X } from '@/components/icons';
import { useDrawStore } from '../store/draw-store';

const { t } = useI18n();
const store = useDrawStore();

const linkValue = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

const isVisible = computed(() => store.showHyperlinkPopup !== false);
const isEditor = computed(() => store.showHyperlinkPopup === 'editor');
const isInfo = computed(() => store.showHyperlinkPopup === 'info');

const selectedElement = computed(() => {
  if (store.selectedElements.length !== 1) return null;
  return store.selectedElements[0]!;
});

const currentLink = computed(() => selectedElement.value?.link || '');

watch(
  () => store.showHyperlinkPopup,
  (val) => {
    if (val === 'editor') {
      linkValue.value = currentLink.value;
      nextTick(() => {
        inputRef.value?.focus();
      });
    }
  },
);

function saveLink() {
  if (!selectedElement.value) return;
  const link = linkValue.value.trim() || null;
  store.setElementLink(selectedElement.value.id, link);
  store.showHyperlinkPopup = link ? 'info' : false;
}

function removeLink() {
  if (!selectedElement.value) return;
  store.setElementLink(selectedElement.value.id, null);
  store.showHyperlinkPopup = false;
}

function openLink() {
  if (currentLink.value) {
    window.open(currentLink.value, '_blank', 'noopener,noreferrer');
  }
}

function editLink() {
  store.showHyperlinkPopup = 'editor';
}

function close() {
  store.showHyperlinkPopup = false;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveLink();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
}
</script>

<template>
  <div
    v-if="isVisible && selectedElement"
    class="absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-lg border border-border bg-card p-3 shadow-lg"
    @click.stop
  >
    <!-- Editor mode -->
    <div v-if="isEditor" class="flex items-center gap-2">
      <Link class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <input
        ref="inputRef"
        v-model="linkValue"
        :placeholder="t('draw.property.linkPlaceholder')"
        class="zq-draw-link-input"
        @keydown="onKeyDown"
      />
      <button
        class="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90"
        @click="saveLink"
      >
        OK
      </button>
      <button
        class="rounded-md p-1 text-muted-foreground hover:bg-accent"
        @click="close"
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <!-- Info mode -->
    <div v-if="isInfo" class="flex items-center gap-2">
      <Link class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <a
        :href="currentLink"
        class="max-w-60 truncate text-sm text-primary underline"
        target="_blank"
        rel="noopener noreferrer"
        @click.prevent="openLink"
      >
        {{ currentLink }}
      </a>
      <button
        class="rounded-md p-1 text-muted-foreground hover:bg-accent"
        :title="t('draw.menu.editLink')"
        @click="editLink"
      >
        <ExternalLink class="h-3.5 w-3.5" />
      </button>
      <button
        class="rounded-md p-1 text-destructive hover:bg-accent"
        :title="t('draw.menu.removeLink')"
        @click="removeLink"
      >
        <Trash2 class="h-3.5 w-3.5" />
      </button>
      <button
        class="rounded-md p-1 text-muted-foreground hover:bg-accent"
        @click="close"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.zq-draw-link-input {
  width: 240px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.zq-draw-link-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-shadow);
}
</style>
