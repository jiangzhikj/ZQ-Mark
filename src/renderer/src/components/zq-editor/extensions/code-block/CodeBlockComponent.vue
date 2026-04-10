<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

import { NodeSelection } from '@tiptap/pm/state';

import { Check, ChevronDown, Copy } from '@/components/icons';
import { resolvedTheme } from '@/composables/useTheme';
import { $t } from '../../utils/i18n';

import { NodeViewContent, NodeViewWrapper } from '@tiptap/vue-3';

import { renderMermaidToSvg } from './mermaid-render';

const props = defineProps<{
  deleteNode: () => void;
  editor: any;
  node: any;
  selected: boolean;
  updateAttributes: (attrs: Record<string, any>) => void;
  extension: any;
  getPos?: () => number | undefined;
}>();

const showDropdown = ref(false);
const copied = ref(false);
const searchQuery = ref('');
let clickOutsideCleanup: (() => void) | null = null;

const LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'xml', label: 'XML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'mermaid', label: 'Mermaid' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'lua', label: 'Lua' },
  { value: 'r', label: 'R' },
  { value: 'perl', label: 'Perl' },
  { value: 'wasm', label: 'WebAssembly' },
  { value: 'diff', label: 'Diff' },
  { value: 'ini', label: 'INI' },
  { value: 'makefile', label: 'Makefile' },
];

const currentLanguage = computed(() => {
  const lang = props.node.attrs.language || 'plaintext';
  return LANGUAGES.find((l) => l.value === lang)?.label || lang;
});

const filteredLanguages = computed(() => {
  if (!searchQuery.value) return LANGUAGES;
  const q = searchQuery.value.toLowerCase();
  return LANGUAGES.filter(
    (l) =>
      l.label.toLowerCase().includes(q) ||
      l.value.toLowerCase().includes(q),
  );
});

function selectLanguage(lang: string) {
  props.updateAttributes({ language: lang });
  showDropdown.value = false;
  searchQuery.value = '';
}

function toggleDropdown() {
  showDropdown.value = !showDropdown.value;
  searchQuery.value = '';
}

function closeDropdown() {
  showDropdown.value = false;
  searchQuery.value = '';
}

async function copyCode() {
  const text = props.node.textContent;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // fallback
  }
}

const isMermaid = computed(
  () => (props.node.attrs.language || 'plaintext') === 'mermaid',
);

/** Mermaid：选区在块内或正在用头部下拉时才显示源码区（失焦仅保留渲染） */
const mermaidEditing = ref(true);

function syncMermaidEditing() {
  if (!isMermaid.value) {
    mermaidEditing.value = true;
    return;
  }
  if (showDropdown.value) {
    mermaidEditing.value = true;
    return;
  }
  const pos = props.getPos?.();
  if (typeof pos !== 'number') {
    mermaidEditing.value = false;
    return;
  }
  const { state, isFocused } = props.editor;
  const sel = state.selection;
  if (sel instanceof NodeSelection && sel.from === pos) {
    mermaidEditing.value = true;
    return;
  }
  if (!isFocused) {
    mermaidEditing.value = false;
    return;
  }
  const innerStart = pos + 1;
  const innerEnd = pos + props.node.nodeSize - 1;
  const from = sel.from;
  mermaidEditing.value = from >= innerStart && from <= innerEnd;
}

function focusMermaidSource() {
  const pos = props.getPos?.();
  if (typeof pos !== 'number') return;
  const innerEnd = pos + props.node.nodeSize - 1;
  props.editor.chain().focus().setTextSelection(innerEnd).run();
}

watch(showDropdown, (val) => {
  if (val) {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.zq-codeblock__dropdown') && !target.closest('.zq-codeblock__lang-btn')) {
        closeDropdown();
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', handler), 50);
    clickOutsideCleanup = () => document.removeEventListener('pointerdown', handler);
  } else {
    clickOutsideCleanup?.();
    clickOutsideCleanup = null;
  }
  queueMicrotask(() => {
    if (isMermaid.value) syncMermaidEditing();
  });
});

watch(isMermaid, () => {
  syncMermaidEditing();
});

const showMermaidChrome = computed(
  () => !isMermaid.value || mermaidEditing.value,
);

function onMermaidPreviewPointerDown() {
  if (isMermaid.value && !mermaidEditing.value) {
    focusMermaidSource();
  }
}

let editorMermaidSyncCleanup: (() => void) | null = null;

onMounted(() => {
  const ed = props.editor;
  if (!ed) return;
  const run = () => {
    if (isMermaid.value) syncMermaidEditing();
  };
  ed.on('transaction', run);
  ed.on('focus', run);
  ed.on('blur', run);
  run();
  editorMermaidSyncCleanup = () => {
    ed.off('transaction', run);
    ed.off('focus', run);
    ed.off('blur', run);
  };
});

const mermaidSvg = shallowRef('');
const mermaidError = ref('');
let mermaidDebounce: ReturnType<typeof setTimeout> | null = null;
let mermaidSeq = 0;

async function refreshMermaidPreview() {
  if (!isMermaid.value) {
    mermaidSvg.value = '';
    mermaidError.value = '';
    return;
  }
  const seq = ++mermaidSeq;
  const raw = props.node.textContent || '';
  const trimmed = raw.trim();
  if (!trimmed) {
    mermaidSvg.value = '';
    mermaidError.value = '';
    return;
  }
  const theme = resolvedTheme.value === 'dark' ? 'dark' : 'default';
  const result = await renderMermaidToSvg(raw, theme);
  if (seq !== mermaidSeq) return;
  if ('error' in result) {
    mermaidSvg.value = '';
    mermaidError.value = result.error;
    return;
  }
  mermaidError.value = '';
  mermaidSvg.value = result.svg;
}

function scheduleMermaidRefresh() {
  if (!isMermaid.value) return;
  if (mermaidDebounce) clearTimeout(mermaidDebounce);
  mermaidDebounce = setTimeout(() => {
    mermaidDebounce = null;
    void refreshMermaidPreview();
  }, 380);
}

watch(
  isMermaid,
  (m) => {
    if (!m) {
      mermaidSeq += 1;
      mermaidSvg.value = '';
      mermaidError.value = '';
      if (mermaidDebounce) {
        clearTimeout(mermaidDebounce);
        mermaidDebounce = null;
      }
    } else {
      scheduleMermaidRefresh();
    }
  },
  { immediate: true },
);

watch(
  () => [props.node.textContent, props.node.attrs.language, resolvedTheme.value] as const,
  () => {
    scheduleMermaidRefresh();
  },
);

onBeforeUnmount(() => {
  editorMermaidSyncCleanup?.();
  editorMermaidSyncCleanup = null;
  clickOutsideCleanup?.();
  if (mermaidDebounce) {
    clearTimeout(mermaidDebounce);
    mermaidDebounce = null;
  }
});
</script>

<template>
  <NodeViewWrapper
    class="zq-codeblock"
    :class="{
      'is-selected': selected,
      'zq-codeblock--mermaid-solo': isMermaid && !showMermaidChrome,
    }"
  >
    <div
      v-show="showMermaidChrome"
      class="zq-codeblock__chrome"
    >
    <div
      class="zq-codeblock__header"
      contenteditable="false"
      @mousedown.prevent
    >
      <div class="zq-codeblock__lang-wrapper">
        <button class="zq-codeblock__lang-btn" @click.stop="toggleDropdown">
          <span>{{ currentLanguage }}</span>
          <ChevronDown class="h-3 w-3" />
        </button>

        <div
          v-if="showDropdown"
          class="zq-codeblock__dropdown"
          @click.stop
        >
          <input
            v-model="searchQuery"
            class="zq-codeblock__search"
            :placeholder="$t('zq-editor.codeBlock.searchLanguage')"
            @keydown.stop
          />
          <div class="zq-codeblock__lang-list">
            <button
              v-for="lang in filteredLanguages"
              :key="lang.value"
              class="zq-codeblock__lang-item"
              :class="{ 'is-active': node.attrs.language === lang.value }"
              @click="selectLanguage(lang.value)"
            >
              {{ lang.label }}
            </button>
            <div
              v-if="filteredLanguages.length === 0"
              class="zq-codeblock__no-result"
            >
              {{ $t('zq-editor.codeBlock.noLanguage') }}
            </div>
          </div>
        </div>
      </div>

      <button
        class="zq-codeblock__copy-btn"
        :title="copied ? $t('zq-editor.codeBlock.copied') : $t('zq-editor.codeBlock.copyCode')"
        @click="copyCode"
      >
        <Check v-if="copied" class="h-3.5 w-3.5" />
        <Copy v-else class="h-3.5 w-3.5" />
      </button>
    </div>
    <pre
      class="zq-codeblock__pre"
      :class="{ 'zq-codeblock__pre--mermaid': isMermaid }"
    ><NodeViewContent as="code" /></pre>
    </div>
    <div
      v-if="isMermaid"
      class="zq-codeblock__mermaid"
      :class="{ 'zq-codeblock__mermaid--solo': !showMermaidChrome }"
      contenteditable="false"
      @pointerdown="onMermaidPreviewPointerDown"
    >
      <div
        v-if="mermaidError"
        class="zq-codeblock__mermaid-error"
      >
        {{ mermaidError }}
      </div>
      <div
        v-else-if="!(node.textContent || '').trim()"
        class="zq-codeblock__mermaid-placeholder"
      >
        {{ $t('zq-editor.codeBlock.mermaidEmpty') }}
      </div>
      <div
        v-else-if="mermaidSvg"
        class="zq-codeblock__mermaid-svg"
        v-html="mermaidSvg"
      />
      <div
        v-else
        class="zq-codeblock__mermaid-placeholder"
      >
        {{ $t('zq-editor.codeBlock.mermaidRendering') }}
      </div>
    </div>
  </NodeViewWrapper>
</template>

<style scoped>
.zq-codeblock {
  position: relative;
  margin: 0.75rem 0;
  border-radius: 8px;
  border: 1px solid var(--zq-code-border, var(--el-border-color-light));
  background: var(--zq-code-bg, var(--el-fill-color-lighter));
  overflow: visible;
}

.zq-codeblock.is-selected {
  border-color: var(--el-color-primary);
}

/* Mermaid 仅预览：只保留图，无外框与底 */
.zq-codeblock.zq-codeblock--mermaid-solo {
  border: none;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
}

.zq-codeblock.zq-codeblock--mermaid-solo.is-selected {
  border: none;
  box-shadow: none;
}

.zq-codeblock__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--zq-code-border, var(--el-border-color-lighter));
  background: var(--zq-code-header-bg, var(--el-fill-color-light));
  border-radius: 8px 8px 0 0;
  user-select: none;
}

.zq-codeblock__lang-wrapper {
  position: relative;
}

.zq-codeblock__lang-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--zq-code-text, var(--el-text-color-secondary));
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  opacity: 0.7;
}

.zq-codeblock__lang-btn:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.zq-codeblock__copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--zq-code-text, var(--el-text-color-secondary));
  cursor: pointer;
  transition: all 0.15s;
  opacity: 0.7;
}

.zq-codeblock__copy-btn:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.zq-codeblock__pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, Monaco, 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  tab-size: 2;
  border-radius: 0 0 8px 8px;
  background: var(--zq-code-bg, var(--el-fill-color-lighter));
}

.zq-codeblock__pre--mermaid {
  border-radius: 0;
  border-bottom: none;
}

.zq-codeblock__pre :deep(code) {
  font-family: inherit;
  background: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
  color: var(--zq-code-text, var(--el-text-color-primary));
}

.zq-codeblock__mermaid {
  border-top: 1px solid var(--zq-code-border, var(--el-border-color-lighter));
  padding: 12px 16px 16px;
  background: var(--zq-code-bg, var(--el-fill-color-lighter));
  border-radius: 0 0 8px 8px;
  overflow-x: auto;
}

.zq-codeblock__mermaid--solo {
  border: none;
  border-top: none;
  background: transparent;
  border-radius: 0;
  padding: 0;
  cursor: text;
}

.zq-codeblock__mermaid-placeholder {
  font-size: 0.8125rem;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}

.zq-codeblock__mermaid-error {
  font-size: 0.8125rem;
  color: var(--el-color-danger, #f56c6c);
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, Monaco, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.zq-codeblock__mermaid-svg :deep(svg) {
  display: block;
  max-width: 100%;
  height: auto;
}

.zq-codeblock__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 100;
  width: 200px;
  max-height: 300px;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.zq-codeblock__search {
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 0.8125rem;
  outline: none;
}

.zq-codeblock__search::placeholder {
  color: var(--el-text-color-placeholder);
}

.zq-codeblock__lang-list {
  overflow-y: auto;
  padding: 4px;
  max-height: 240px;
}

.zq-codeblock__lang-list::-webkit-scrollbar {
  width: 4px;
}

.zq-codeblock__lang-list::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 2px;
}

.zq-codeblock__lang-item {
  display: block;
  width: 100%;
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 0.8125rem;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s;
}

.zq-codeblock__lang-item:hover {
  background: var(--el-fill-color-light);
}

.zq-codeblock__lang-item.is-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}

.zq-codeblock__no-result {
  padding: 12px;
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 0.8125rem;
}
</style>
