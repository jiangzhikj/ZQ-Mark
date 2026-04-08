<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { onMounted, ref } from 'vue';

import { $t } from '../utils/i18n';

interface Props {
  editor: Editor;
  /** 关闭时额外回调（例如斜杠命令用 VueRenderer 挂载时需回收 tippy） */
  onClosed?: () => void;
  /** insert：斜杠在光标处插入；replace：替换当前选区（气泡栏） */
  mode?: 'insert' | 'replace';
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'replace',
});

const emit = defineEmits<{ close: [] }>();

const sel = props.editor.state.selection;
const rangeFrom = sel.from;
const rangeTo = sel.to;

const displayText = ref('');
const linkUrl = ref('');

if (props.mode === 'insert') {
  displayText.value = '';
  linkUrl.value = '';
} else {
  displayText.value = props.editor.state.doc.textBetween(
    rangeFrom,
    rangeTo,
    '\0',
    '\0',
  );
  linkUrl.value = props.editor.getAttributes('link').href || '';
}

const textInputRef = ref<HTMLInputElement | null>(null);

onMounted(() => {
  textInputRef.value?.focus();
});

function notifyClose() {
  emit('close');
  props.onClosed?.();
}

function applyLink() {
  const href = linkUrl.value.trim();
  const label = displayText.value;

  if (props.mode === 'insert') {
    if (!href) {
      notifyClose();
      return;
    }
    const text = label.trim() || href;
    props.editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text,
        marks: [{ type: 'link', attrs: { href } }],
      })
      .run();
    notifyClose();
    return;
  }

  if (!href) {
    props.editor
      .chain()
      .focus()
      .setTextSelection({ from: rangeFrom, to: rangeTo })
      .unsetLink()
      .run();
    notifyClose();
    return;
  }

  const text = label.trim() || href;
  props.editor
    .chain()
    .focus()
    .setTextSelection({ from: rangeFrom, to: rangeTo })
    .insertContent({
      type: 'text',
      text,
      marks: [{ type: 'link', attrs: { href } }],
    })
    .run();
  notifyClose();
}

function onFormKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    notifyClose();
  }
}
</script>

<template>
  <form class="zq-link-editor" @submit.prevent="applyLink" @keydown="onFormKeydown">
    <div class="zq-link-editor__fields">
      <label class="zq-link-editor__label">{{ $t('zq-editor.link.textLabel') }}</label>
      <input
        ref="textInputRef"
        v-model="displayText"
        type="text"
        class="zq-link-editor__input"
        :placeholder="$t('zq-editor.link.textPlaceholder')"
      />
      <label class="zq-link-editor__label">{{ $t('zq-editor.link.urlLabel') }}</label>
      <input
        v-model="linkUrl"
        type="text"
        class="zq-link-editor__input"
        :placeholder="$t('zq-editor.link.placeholder')"
      />
    </div>
    <div class="zq-link-editor__actions">
      <button type="submit" class="zq-link-editor__btn zq-link-editor__btn--primary">
        {{ $t('zq-editor.link.confirm') }}
      </button>
      <button type="button" class="zq-link-editor__btn zq-link-editor__btn--cancel" @click="notifyClose">
        {{ $t('zq-editor.link.cancel') }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.zq-link-editor {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  min-width: 300px;
  /* 根节点必须有实底：tippy 默认外壳透明，且 zq-slash 主题会强制 tippy-box 透明 */
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1),
    0 8px 24px rgb(0 0 0 / 0.08);
}

.zq-link-editor__fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.zq-link-editor__label {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}

.zq-link-editor__input {
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

.zq-link-editor__input:focus {
  border-color: var(--el-color-primary);
}

.zq-link-editor__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
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
