<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { onMounted, ref } from 'vue';

import { ZqMessage } from '@/components/ui';
import { $t } from '../utils/i18n';

const props = defineProps<{
  editor: Editor;
}>();

const emit = defineEmits<{ close: [] }>();

const urlInputRef = ref<HTMLInputElement | null>(null);
const imageUrl = ref('');

function normalizeImageUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (t.startsWith('//')) return `https:${t}`;
  return t;
}

function isValidRemoteImageUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^data:image\//i.test(t)) return true;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function notifyClose() {
  emit('close');
}

function insertFromUrl() {
  const normalized = normalizeImageUrl(imageUrl.value);
  if (!isValidRemoteImageUrl(normalized)) {
    ZqMessage.warning($t('zq-editor.imageInsert.invalidUrl'));
    return;
  }
  props.editor.chain().focus().setImageBlock({ src: normalized }).run();
  notifyClose();
}

async function pickLocalFile() {
  try {
    const result = await window.electron.openLocalFile({
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }],
    });
    if (result) {
      props.editor.chain().focus().setImageBlock({ src: result.url, fileId: result.id }).run();
      notifyClose();
    }
  } catch {
    ZqMessage.error($t('zq-editor.upload.imageUploadFailed'));
  }
}

function onFormKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    notifyClose();
  }
}

onMounted(() => {
  urlInputRef.value?.focus();
});
</script>

<template>
  <form class="zq-image-insert" @submit.prevent="insertFromUrl" @keydown="onFormKeydown">
    <div class="zq-image-insert__title">{{ $t('zq-editor.imageInsert.title') }}</div>
    <div class="zq-image-insert__fields">
      <label class="zq-image-insert__label">{{ $t('zq-editor.imageInsert.urlLabel') }}</label>
      <input
        ref="urlInputRef"
        v-model="imageUrl"
        type="text"
        class="zq-image-insert__input"
        autocomplete="off"
        :placeholder="$t('zq-editor.imageInsert.urlPlaceholder')"
      />
    </div>
    <div class="zq-image-insert__actions">
      <button type="button" class="zq-image-insert__btn zq-image-insert__btn--primary" @click="pickLocalFile">
        {{ $t('zq-editor.imageInsert.pickLocal') }}
      </button>
      <button type="submit" class="zq-image-insert__btn zq-image-insert__btn--secondary">
        {{ $t('zq-editor.imageInsert.insertFromUrl') }}
      </button>
      <button type="button" class="zq-image-insert__btn zq-image-insert__btn--cancel" @click="notifyClose">
        {{ $t('zq-editor.imageInsert.cancel') }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.zq-image-insert {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  min-width: 320px;
  max-width: min(420px, calc(100vw - 32px));
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1),
    0 8px 24px rgb(0 0 0 / 0.08);
}

.zq-image-insert__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.zq-image-insert__fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.zq-image-insert__label {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}

.zq-image-insert__input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s;
}

.zq-image-insert__input:focus {
  border-color: var(--el-color-primary);
}

.zq-image-insert__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.zq-image-insert__btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.zq-image-insert__btn:hover {
  opacity: 0.85;
}

.zq-image-insert__btn--primary {
  background: var(--el-color-primary);
  color: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
  font-weight: 600;
}

.zq-image-insert__btn--secondary {
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
  border: 1px solid var(--el-border-color);
}

.zq-image-insert__btn--cancel {
  background: transparent;
  color: var(--el-text-color-secondary);
}
</style>
