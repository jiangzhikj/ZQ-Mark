<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { ref } from 'vue';

import { $t } from '../utils/i18n';

interface Props {
  editor: Editor;
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const linkUrl = ref(props.editor.getAttributes('link').href || '');

function setLink() {
  if (linkUrl.value) {
    props.editor
      .chain()
      .focus()
      .setLink({ href: linkUrl.value })
      .run();
  } else {
    props.editor.chain().focus().unsetLink().run();
  }
  emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    setLink();
  } else if (e.key === 'Escape') {
    emit('close');
  }
}
</script>

<template>
  <div class="zq-link-editor" @keydown="onKeydown">
    <input
      v-model="linkUrl"
      type="text"
      class="zq-link-editor__input"
      :placeholder="$t('zq-editor.link.placeholder')"
      autofocus
    />
    <button class="zq-link-editor__btn zq-link-editor__btn--primary" @click="setLink">
      {{ $t('zq-editor.link.confirm') }}
    </button>
    <button class="zq-link-editor__btn zq-link-editor__btn--cancel" @click="emit('close')">
      {{ $t('zq-editor.link.cancel') }}
    </button>
  </div>
</template>

<style scoped>
.zq-link-editor {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
}

.zq-link-editor__input {
  width: 260px;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s;
}

.zq-link-editor__input:focus {
  border-color: var(--el-color-primary);
}

.zq-link-editor__btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.zq-link-editor__btn:hover {
  opacity: 0.85;
}

.zq-link-editor__btn--primary {
  background: var(--el-color-primary);
  color: #fff;
}

.zq-link-editor__btn--cancel {
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
}
</style>
