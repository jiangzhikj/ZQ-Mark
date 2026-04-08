<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import katex from 'katex';
import { nextTick, onMounted, ref, watch } from 'vue';

import { $t } from '../utils/i18n';

interface Props {
  editor: Editor;
  /** 斜杠触发片段区间，确认时再删除并插入公式；取消则保留原文 */
  range: { from: number; to: number };
  onClosed?: () => void;
}

const props = defineProps<Props>();

const latex = ref('');
const mode = ref<'inline' | 'block'>('inline');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const previewRef = ref<HTMLDivElement | null>(null);

function notifyClose() {
  props.onClosed?.();
}

function renderPreview() {
  const el = previewRef.value;
  if (!el) return;
  const s = latex.value.trim();
  el.innerHTML = '';
  el.classList.remove('zq-math-formula-editor__preview--empty', 'zq-math-formula-editor__preview--error');
  if (!s) {
    el.textContent = '—';
    el.classList.add('zq-math-formula-editor__preview--empty');
    return;
  }
  try {
    katex.render(s, el, {
      throwOnError: false,
      displayMode: mode.value === 'block',
    });
  } catch {
    el.textContent = s;
    el.classList.add('zq-math-formula-editor__preview--error');
  }
}

watch([latex, mode], () => {
  void nextTick(() => renderPreview());
});

onMounted(() => {
  textareaRef.value?.focus();
  void nextTick(() => renderPreview());
});

function apply() {
  const s = latex.value.trim();
  if (!s) {
    notifyClose();
    return;
  }
  props.editor.chain().focus().deleteRange(props.range).run();
  if (mode.value === 'inline') {
    props.editor.chain().focus().insertInlineMath({ latex: s }).run();
  } else {
    props.editor.chain().focus().insertBlockMath({ latex: s }).run();
  }
  notifyClose();
}

function onRootKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    notifyClose();
  }
}
</script>

<template>
  <div class="zq-math-formula-editor" @keydown="onRootKeydown">
    <div class="zq-math-formula-editor__title">{{ $t('zq-editor.math.title') }}</div>
    <div class="zq-math-formula-editor__mode">
      <button
        type="button"
        class="zq-math-formula-editor__mode-btn"
        :class="{ 'is-active': mode === 'inline' }"
        @click="mode = 'inline'"
      >
        {{ $t('zq-editor.math.modeInline') }}
      </button>
      <button
        type="button"
        class="zq-math-formula-editor__mode-btn"
        :class="{ 'is-active': mode === 'block' }"
        @click="mode = 'block'"
      >
        {{ $t('zq-editor.math.modeBlock') }}
      </button>
    </div>
    <label class="zq-math-formula-editor__label">{{ $t('zq-editor.math.latexLabel') }}</label>
    <textarea
      ref="textareaRef"
      v-model="latex"
      class="zq-math-formula-editor__textarea"
      rows="4"
      :placeholder="$t('zq-editor.math.placeholder')"
      spellcheck="false"
      @keydown.ctrl.enter.prevent="apply"
      @keydown.meta.enter.prevent="apply"
    />
    <div class="zq-math-formula-editor__hint">{{ $t('zq-editor.math.hint') }}</div>
    <label class="zq-math-formula-editor__label">{{ $t('zq-editor.math.previewLabel') }}</label>
    <div ref="previewRef" class="zq-math-formula-editor__preview" />
    <div class="zq-math-formula-editor__actions">
      <button type="button" class="zq-math-formula-editor__btn zq-math-formula-editor__btn--primary" @click="apply">
        {{ $t('zq-editor.math.insert') }}
      </button>
      <button type="button" class="zq-math-formula-editor__btn zq-math-formula-editor__btn--cancel" @click="notifyClose">
        {{ $t('zq-editor.math.cancel') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.zq-math-formula-editor {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  min-width: 320px;
  max-width: min(420px, 92vw);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1),
    0 8px 24px rgb(0 0 0 / 0.08);
}

.zq-math-formula-editor__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.zq-math-formula-editor__mode {
  display: flex;
  gap: 6px;
}

.zq-math-formula-editor__mode-btn {
  flex: 1;
  padding: 6px 10px;
  font-size: 0.8rem;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.zq-math-formula-editor__mode-btn:hover {
  border-color: var(--el-color-primary-light-5);
}

.zq-math-formula-editor__mode-btn.is-active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.zq-math-formula-editor__label {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}

.zq-math-formula-editor__textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 88px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 0.8125rem;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, monospace;
  line-height: 1.45;
  resize: vertical;
  outline: none;
}

.zq-math-formula-editor__textarea:focus {
  border-color: var(--el-color-primary);
}

.zq-math-formula-editor__hint {
  font-size: 0.7rem;
  color: var(--el-text-color-placeholder);
}

.zq-math-formula-editor__preview {
  min-height: 48px;
  padding: 10px 12px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  font-size: 1rem;
  overflow-x: auto;
}

.zq-math-formula-editor__preview--empty {
  color: var(--el-text-color-placeholder);
  font-style: italic;
}

.zq-math-formula-editor__preview--error {
  color: var(--el-color-danger);
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
}

.zq-math-formula-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.zq-math-formula-editor__btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.zq-math-formula-editor__btn--primary {
  background: var(--el-color-primary);
  color: #fff;
}

.zq-math-formula-editor__btn--cancel {
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
}

.zq-math-formula-editor__btn:hover {
  opacity: 0.9;
}
</style>
