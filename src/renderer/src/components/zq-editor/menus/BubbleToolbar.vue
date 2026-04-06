<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { ref } from 'vue';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Smile,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
} from '@/components/icons';
import { $t } from '../utils/i18n';

import ColorPicker from './ColorPicker.vue';
import EmojiPicker from './EmojiPicker.vue';
import LinkEditor from './LinkEditor.vue';

interface Props {
  editor: Editor;
}

const props = defineProps<Props>();

const showTurnIntoMenu = ref(false);
const showFontSizeMenu = ref(false);
const showColorPicker = ref(false);
const showEmojiPicker = ref(false);
const showLinkEditor = ref(false);

const dropdownRefs = {
  turnInto: showTurnIntoMenu,
  fontSize: showFontSizeMenu,
  color: showColorPicker,
  emoji: showEmojiPicker,
} as const;

function closeAllDropdowns(except?: keyof typeof dropdownRefs) {
  for (const [key, r] of Object.entries(dropdownRefs)) {
    if (key !== except) r.value = false;
  }
}

function toggleDropdown(name: keyof typeof dropdownRefs) {
  const r = dropdownRefs[name];
  const next = !r.value;
  closeAllDropdowns(name);
  r.value = next;
}

const fontSizeOptions = [
  { label: () => $t('zq-editor.bubble.fontSizeDefault'), value: null },
  { label: () => '14px', value: '14px' },
  { label: () => '16px', value: '16px' },
  { label: () => '18px', value: '18px' },
  { label: () => '20px', value: '20px' },
  { label: () => '24px', value: '24px' },
  { label: () => '28px', value: '28px' },
  { label: () => '32px', value: '32px' },
  { label: () => '36px', value: '36px' },
];

function getCurrentFontSize(): string {
  const size = props.editor.getAttributes('textStyle').fontSize;
  return size || $t('zq-editor.bubble.fontSizeDefault');
}

function setFontSize(value: null | string) {
  if (value === null) {
    props.editor.chain().focus().unsetFontSize().run();
  } else {
    props.editor.chain().focus().setFontSize(value).run();
  }
  showFontSizeMenu.value = false;
}

const turnIntoItems = [
  { label: () => $t('zq-editor.turnInto.text'), key: 'paragraph' },
  { label: () => $t('zq-editor.turnInto.heading1'), key: 'h1' },
  { label: () => $t('zq-editor.turnInto.heading2'), key: 'h2' },
  { label: () => $t('zq-editor.turnInto.heading3'), key: 'h3' },
  { label: () => $t('zq-editor.turnInto.bulletList'), key: 'bulletList' },
  { label: () => $t('zq-editor.turnInto.orderedList'), key: 'orderedList' },
  { label: () => $t('zq-editor.turnInto.taskList'), key: 'taskList' },
  { label: () => $t('zq-editor.turnInto.blockquote'), key: 'blockquote' },
  { label: () => $t('zq-editor.turnInto.codeBlock'), key: 'codeBlock' },
];

function getCurrentType(): string {
  const e = props.editor;
  if (e.isActive('heading', { level: 1 })) return $t('zq-editor.turnInto.heading1');
  if (e.isActive('heading', { level: 2 })) return $t('zq-editor.turnInto.heading2');
  if (e.isActive('heading', { level: 3 })) return $t('zq-editor.turnInto.heading3');
  if (e.isActive('bulletList')) return $t('zq-editor.turnInto.bulletList');
  if (e.isActive('orderedList')) return $t('zq-editor.turnInto.orderedList');
  if (e.isActive('taskList')) return $t('zq-editor.turnInto.taskList');
  if (e.isActive('blockquote')) return $t('zq-editor.turnInto.blockquote');
  if (e.isActive('codeBlock')) return $t('zq-editor.turnInto.codeBlock');
  return $t('zq-editor.turnInto.text');
}

function turnInto(key: string) {
  const e = props.editor;
  if (!e) return;
  const actions: Record<string, () => void> = {
    paragraph: () => e.chain().focus().setParagraph().run(),
    h1: () => e.chain().focus().toggleHeading({ level: 1 }).run(),
    h2: () => e.chain().focus().toggleHeading({ level: 2 }).run(),
    h3: () => e.chain().focus().toggleHeading({ level: 3 }).run(),
    bulletList: () => e.chain().focus().toggleBulletList().run(),
    orderedList: () => e.chain().focus().toggleOrderedList().run(),
    taskList: () => e.chain().focus().toggleTaskList().run(),
    blockquote: () => e.chain().focus().toggleBlockquote().run(),
    codeBlock: () => e.chain().focus().toggleCodeBlock().run(),
  };
  actions[key]?.();
  showTurnIntoMenu.value = false;
}

function openLinkEditor() {
  closeAllDropdowns();
  showLinkEditor.value = true;
}
</script>

<template>
  <div
    class="zq-bubble-toolbar"
    @mousedown.prevent
  >
    <!-- Turn Into -->
    <div class="zq-bubble-toolbar__group">
      <div class="zq-bubble-toolbar__turninto-wrapper">
        <button
          class="zq-bubble-toolbar__turninto-trigger"
          @click="toggleDropdown('turnInto')"
        >
          <span class="zq-bubble-toolbar__turninto-text">{{ getCurrentType() }}</span>
          <ChevronDown class="h-3 w-3" />
        </button>
        <div v-if="showTurnIntoMenu" class="zq-bubble-toolbar__turninto-dropdown">
          <div class="zq-bubble-toolbar__dropdown-header">
            {{ $t('zq-editor.bubble.turnInto') }}
          </div>
          <button
            v-for="item in turnIntoItems"
            :key="item.key"
            class="zq-bubble-toolbar__dropdown-item"
            :class="{ 'is-active': getCurrentType() === item.label() }"
            @click="turnInto(item.key)"
          >
            {{ item.label() }}
          </button>
        </div>
      </div>
    </div>

    <div class="zq-bubble-toolbar__divider" />

    <!-- Font Size -->
    <div class="zq-bubble-toolbar__group">
      <div class="zq-bubble-toolbar__fontsize-wrapper">
        <button
          class="zq-bubble-toolbar__fontsize-trigger"
          :title="$t('zq-editor.bubble.fontSize')"
          @click="toggleDropdown('fontSize')"
        >
          <span class="zq-bubble-toolbar__fontsize-text">{{ getCurrentFontSize() }}</span>
          <ChevronDown class="h-3 w-3" />
        </button>
        <div v-if="showFontSizeMenu" class="zq-bubble-toolbar__fontsize-dropdown">
          <button
            v-for="opt in fontSizeOptions"
            :key="opt.value ?? 'default'"
            class="zq-bubble-toolbar__dropdown-item"
            :class="{ 'is-active': getCurrentFontSize() === opt.label() }"
            :style="opt.value ? { fontSize: opt.value } : {}"
            @click="setFontSize(opt.value)"
          >
            {{ opt.label() }}
          </button>
        </div>
      </div>
    </div>

    <div class="zq-bubble-toolbar__divider" />

    <!-- Format buttons -->
    <div class="zq-bubble-toolbar__group">
      <button
        class="zq-bubble-toolbar__btn"
        :class="{ 'is-active': editor.isActive('bold') }"
        :title="$t('zq-editor.bubble.bold') + ' (Ctrl+B)'"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <Bold class="h-4 w-4" />
      </button>
      <button
        class="zq-bubble-toolbar__btn"
        :class="{ 'is-active': editor.isActive('italic') }"
        :title="$t('zq-editor.bubble.italic') + ' (Ctrl+I)'"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <Italic class="h-4 w-4" />
      </button>
      <button
        class="zq-bubble-toolbar__btn"
        :class="{ 'is-active': editor.isActive('underline') }"
        :title="$t('zq-editor.bubble.underline') + ' (Ctrl+U)'"
        @click="editor.chain().focus().toggleUnderline().run()"
      >
        <UnderlineIcon class="h-4 w-4" />
      </button>
      <button
        class="zq-bubble-toolbar__btn"
        :class="{ 'is-active': editor.isActive('strike') }"
        :title="$t('zq-editor.bubble.strikethrough')"
        @click="editor.chain().focus().toggleStrike().run()"
      >
        <Strikethrough class="h-4 w-4" />
      </button>
      <button
        class="zq-bubble-toolbar__btn"
        :class="{ 'is-active': editor.isActive('code') }"
        :title="$t('zq-editor.bubble.code')"
        @click="editor.chain().focus().toggleCode().run()"
      >
        <Code class="h-4 w-4" />
      </button>
    </div>

    <div class="zq-bubble-toolbar__divider" />

    <!-- Highlight & Link -->
    <div class="zq-bubble-toolbar__group">
      <button
        class="zq-bubble-toolbar__btn"
        :class="{ 'is-active': editor.isActive('highlight') }"
        :title="$t('zq-editor.bubble.highlight')"
        @click="editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()"
      >
        <Highlighter class="h-4 w-4" />
      </button>
      <button
        class="zq-bubble-toolbar__btn"
        :class="{ 'is-active': editor.isActive('link') }"
        :title="$t('zq-editor.bubble.link') + ' (Ctrl+K)'"
        @click="openLinkEditor"
      >
        <LinkIcon class="h-4 w-4" />
      </button>
    </div>

    <!-- Color picker -->
    <div class="zq-bubble-toolbar__group">
      <div class="zq-bubble-toolbar__color-wrapper">
        <button
          class="zq-bubble-toolbar__btn"
          @click="toggleDropdown('color')"
        >
          <Type
            class="h-4 w-4"
            :style="{ color: editor.getAttributes('textStyle').color || 'inherit' }"
          />
          <ChevronDown class="h-3 w-3" />
        </button>
        <div v-if="showColorPicker" class="zq-bubble-toolbar__color-dropdown">
          <ColorPicker :editor="editor" @close="showColorPicker = false" />
        </div>
      </div>
    </div>

    <!-- Emoji -->
    <div class="zq-bubble-toolbar__group">
      <div class="zq-bubble-toolbar__emoji-wrapper">
        <button
          class="zq-bubble-toolbar__btn"
          :title="$t('zq-editor.bubble.emoji')"
          @click="toggleDropdown('emoji')"
        >
          <Smile class="h-4 w-4" />
        </button>
        <div v-if="showEmojiPicker" class="zq-bubble-toolbar__emoji-dropdown">
          <EmojiPicker :editor="editor" @close="showEmojiPicker = false" />
        </div>
      </div>
    </div>

    <div class="zq-bubble-toolbar__divider" />

    <!-- Alignment -->
    <div class="zq-bubble-toolbar__group">
      <button
        class="zq-bubble-toolbar__btn"
        :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }"
        :title="$t('zq-editor.bubble.alignLeft')"
        @click="editor.chain().focus().setTextAlign('left').run()"
      >
        <AlignLeft class="h-4 w-4" />
      </button>
      <button
        class="zq-bubble-toolbar__btn"
        :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }"
        :title="$t('zq-editor.bubble.alignCenter')"
        @click="editor.chain().focus().setTextAlign('center').run()"
      >
        <AlignCenter class="h-4 w-4" />
      </button>
      <button
        class="zq-bubble-toolbar__btn"
        :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }"
        :title="$t('zq-editor.bubble.alignRight')"
        @click="editor.chain().focus().setTextAlign('right').run()"
      >
        <AlignRight class="h-4 w-4" />
      </button>
    </div>

    <!-- Link editor popover -->
    <Teleport to="body">
      <div v-if="showLinkEditor" class="zq-bubble-toolbar__link-overlay">
        <LinkEditor :editor="editor" @close="showLinkEditor = false" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.zq-bubble-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
}

.zq-bubble-toolbar__group {
  display: flex;
  align-items: center;
  gap: 1px;
}

.zq-bubble-toolbar__divider {
  width: 1px;
  height: 1rem;
  background: var(--el-border-color-lighter);
  margin: 0 2px;
}

.zq-bubble-toolbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.12s;
  gap: 1px;
}

.zq-bubble-toolbar__btn:hover {
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.zq-bubble-toolbar__btn.is-active {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

/* Turn Into */
.zq-bubble-toolbar__turninto-wrapper {
  position: relative;
}

.zq-bubble-toolbar__turninto-trigger {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}

.zq-bubble-toolbar__turninto-trigger:hover {
  background-color: var(--el-fill-color-light);
}

.zq-bubble-toolbar__turninto-text {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.zq-bubble-toolbar__turninto-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 2001;
  min-width: 160px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
  padding: 4px;
}

.zq-bubble-toolbar__dropdown-header {
  padding: 6px 10px 4px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.zq-bubble-toolbar__dropdown-item {
  display: block;
  width: 100%;
  padding: 6px 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 0.8125rem;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s;
}

.zq-bubble-toolbar__dropdown-item:hover {
  background-color: var(--el-fill-color-light);
}

.zq-bubble-toolbar__dropdown-item.is-active {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

/* Font Size */
.zq-bubble-toolbar__fontsize-wrapper {
  position: relative;
}

.zq-bubble-toolbar__fontsize-trigger {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}

.zq-bubble-toolbar__fontsize-trigger:hover {
  background-color: var(--el-fill-color-light);
}

.zq-bubble-toolbar__fontsize-text {
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.zq-bubble-toolbar__fontsize-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 2001;
  min-width: 100px;
  max-height: 260px;
  overflow-y: auto;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
  padding: 4px;
}

/* Color picker */
.zq-bubble-toolbar__color-wrapper {
  position: relative;
}

.zq-bubble-toolbar__color-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 2001;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
}

/* Emoji picker */
.zq-bubble-toolbar__emoji-wrapper {
  position: relative;
}

.zq-bubble-toolbar__emoji-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 2001;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
}

/* Link editor overlay */
.zq-bubble-toolbar__link-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2000;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.15);
}
</style>
