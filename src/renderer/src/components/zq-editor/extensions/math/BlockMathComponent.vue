<script setup lang="ts">
import { NodeViewWrapper } from '@tiptap/vue-3';
import katex from 'katex';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { $t } from '../../utils/i18n';

const props = defineProps<{
  editor: { isEditable: boolean };
  node: { attrs: { latex?: string } };
  updateAttributes: (attrs: Record<string, unknown>) => void;
  selected: boolean;
  extension?: { options?: { katexOptions?: Record<string, unknown> } };
}>();

/** 有内容时默认仅预览；空块默认展开编辑（首帧即正确，不依赖 onMounted 竞态） */
const showEditor = ref(!String(props.node.attrs.latex ?? '').trim());

const localLatex = ref(String(props.node.attrs.latex ?? ''));
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const previewRef = ref<HTMLDivElement | null>(null);
const shellRef = ref<HTMLElement | null>(null);

let commitTimer: ReturnType<typeof setTimeout> | null = null;
/** 斜杠菜单关闭等会抢走焦点，避免刚插入公式块时 blur 立刻收起编辑区 */
let blurCollapseTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.node.attrs.latex,
  (v) => {
    const s = String(v ?? '');
    if (s !== localLatex.value) localLatex.value = s;
  },
);

function commit() {
  props.updateAttributes({ latex: localLatex.value });
}

function scheduleCommit() {
  if (commitTimer) clearTimeout(commitTimer);
  commitTimer = setTimeout(() => {
    commitTimer = null;
    commit();
  }, 40);
}

onBeforeUnmount(() => {
  if (commitTimer) clearTimeout(commitTimer);
  if (blurCollapseTimer) clearTimeout(blurCollapseTimer);
});

const katexOptions = computed(() => ({
  throwOnError: false,
  displayMode: true,
  ...(props.extension?.options?.katexOptions ?? {}),
}));

function renderPreview() {
  const el = previewRef.value;
  if (!el) return;
  const s = localLatex.value.trim();
  el.innerHTML = '';
  el.classList.remove(
    'zq-block-math__preview--empty',
    'zq-block-math__preview--error',
  );
  if (!s) {
    el.textContent = '—';
    el.classList.add('zq-block-math__preview--empty');
    return;
  }
  try {
    katex.render(s, el, katexOptions.value as import('katex').KatexOptions);
  } catch {
    el.textContent = s;
    el.classList.add('zq-block-math__preview--error');
  }
}

watch(localLatex, () => void nextTick(() => renderPreview()));
watch(
  katexOptions,
  () => void nextTick(() => renderPreview()),
  { deep: true },
);

watch(showEditor, () => void nextTick(() => renderPreview()));

function enterEditMode() {
  if (!props.editor.isEditable) return;
  onTextareaFocus();
  showEditor.value = true;
  void nextTick(() => {
    textareaRef.value?.focus();
  });
}

function onPreviewMouseDown(e: MouseEvent) {
  if (!props.editor.isEditable) return;
  if (showEditor.value) {
    e.preventDefault();
    textareaRef.value?.focus();
    return;
  }
  e.preventDefault();
  enterEditMode();
}

function flushCommit() {
  if (commitTimer) {
    clearTimeout(commitTimer);
    commitTimer = null;
  }
  commit();
}

function onTextareaFocus() {
  if (blurCollapseTimer) {
    clearTimeout(blurCollapseTimer);
    blurCollapseTimer = null;
  }
}

function onTextareaBlur(e: FocusEvent) {
  flushCommit();
  const related = e.relatedTarget as Node | null;
  if (related && shellRef.value?.contains(related)) return;

  // 空块不收起，避免菜单/编辑器抢焦点时误关编辑区
  if (!localLatex.value.trim()) return;

  if (blurCollapseTimer) clearTimeout(blurCollapseTimer);
  blurCollapseTimer = setTimeout(() => {
    blurCollapseTimer = null;
    const shell = shellRef.value;
    const active = document.activeElement;
    if (shell?.contains(active)) return;
    showEditor.value = false;
    void nextTick(() => renderPreview());
  }, 200);
}

onMounted(() => {
  void nextTick(() => {
    renderPreview();
    if (!props.editor.isEditable || !showEditor.value) return;
    void nextTick(() => {
      onTextareaFocus();
      textareaRef.value?.focus();
      requestAnimationFrame(() => {
        if (!showEditor.value) return;
        textareaRef.value?.focus();
      });
    });
  });
});
</script>

<template>
  <NodeViewWrapper
    class="zq-block-math tiptap-mathematics-render"
    :class="{
      'is-selected': selected,
      'tiptap-mathematics-render--editable': editor.isEditable,
      'zq-block-math--render-only': !showEditor,
    }"
    data-type="block-math"
    contenteditable="false"
  >
    <div
      v-if="editor.isEditable"
      ref="shellRef"
      class="zq-block-math__shell"
      :class="{ 'zq-block-math__shell--editing': showEditor }"
    >
      <div v-show="showEditor" class="zq-block-math__editor">
        <label class="zq-block-math__label">{{ $t('zq-editor.math.latexLabel') }}</label>
        <textarea
          ref="textareaRef"
          v-model="localLatex"
          class="zq-block-math__textarea"
          rows="3"
          spellcheck="false"
          :placeholder="$t('zq-editor.math.placeholder')"
          @focus="onTextareaFocus"
          @input="scheduleCommit"
          @blur="onTextareaBlur"
        />
      </div>
      <label v-if="showEditor" class="zq-block-math__label">{{
        $t('zq-editor.math.previewLabel')
      }}</label>
      <div
        ref="previewRef"
        class="zq-block-math__preview"
        :class="{ 'zq-block-math__preview--solo': !showEditor }"
        :title="!showEditor ? $t('zq-editor.math.clickToEdit') : undefined"
        @mousedown="onPreviewMouseDown"
      />
    </div>
    <div v-else class="zq-block-math__readonly">
      <div ref="previewRef" class="zq-block-math__preview zq-block-math__preview--solo" />
    </div>
  </NodeViewWrapper>
</template>

<style scoped>
.zq-block-math {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.zq-block-math.is-selected {
  //border-color: var(--el-color-primary-light-5);
  //box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}

/* 仅预览（可编辑折叠态 / 只读）：外层不要卡片边框与底色，选中态也不画组件级描边 */
.zq-block-math--render-only {
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}

.zq-block-math--render-only.is-selected {
  border: none;
  box-shadow: none;
}

.zq-block-math__shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zq-block-math__editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.zq-block-math__label {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}

.zq-block-math__textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 72px;
  padding: 8px 10px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 0.8125rem;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, monospace;
  line-height: 1.45;
  resize: vertical;
  outline: none;
}

.zq-block-math__textarea:focus {
  //border-color: var(--el-color-primary);
}

.zq-block-math__preview {
  min-height: 44px;
  padding: 10px 12px;
  border: none;
  //border-radius: 6px;
  background: transparent;
  font-size: 1rem;
  overflow-x: auto;
  text-align: center;
}

/* 编辑态：下方预览略作底色，无边框 */
.zq-block-math__shell--editing .zq-block-math__preview {
  //background: var(--el-fill-color-lighter);
}

.zq-block-math__preview--solo {
  cursor: pointer;
  transition: background-color 0.15s;
}

.tiptap-mathematics-render--editable .zq-block-math__preview--solo:hover {
  //background: var(--el-fill-color-lighter);
}

.zq-block-math__preview :deep(.katex-display) {
  margin: 0;
}

.zq-block-math__preview--empty {
  color: var(--el-text-color-placeholder);
  font-style: italic;
}

.zq-block-math__preview--error {
  color: var(--el-color-danger);
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
  text-align: left;
}

.zq-block-math__readonly .zq-block-math__preview {
  cursor: default;
}
</style>
