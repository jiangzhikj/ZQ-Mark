<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Code,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Trash2,
  Type,
} from '@/components/icons';
import { $t } from '../utils/i18n';

import { Fragment } from '@tiptap/pm/model';

const props = defineProps<{ editor: Editor }>();

const visible = ref(false);
const menuStyle = ref<Record<string, string>>({});
const showTurnInto = ref(false);
const turnIntoStyle = ref<Record<string, string>>({});
const turnIntoTriggerRef = ref<HTMLElement>();

let currentNodePos: number | null = null;
let clickOutsideCleanup: (() => void) | null = null;
let pointerDownInfo: { x: number; y: number; handle: HTMLElement } | null =
  null;

const DRAG_HANDLE_WIDTH = 20;
const CLICK_THRESHOLD = 5;

function findBlockAtHandle(
  handleEl: HTMLElement,
): { pos: number } | null {
  if (!props.editor) return null;

  const rect = handleEl.getBoundingClientRect();
  const x = rect.left + 50 + DRAG_HANDLE_WIDTH;
  const y = rect.top + rect.height / 2;

  const selectors =
    'li, p, pre, blockquote, h1, h2, h3, h4, h5, h6';

  const blockDom = document
    .elementsFromPoint(x, y)
    .find(
      (el) =>
        el.parentElement?.matches?.('.ProseMirror') || el.matches(selectors),
    );
  if (!blockDom) return null;

  const view = props.editor.view;
  const blockRect = blockDom.getBoundingClientRect();
  const posResult = view.posAtCoords({
    left: blockRect.left + 50 + DRAG_HANDLE_WIDTH,
    top: blockRect.top + 1,
  });
  if (!posResult || posResult.inside < 0) return null;

  let pos = posResult.inside;
  const $pos = view.state.doc.resolve(pos);
  if ($pos.depth > 1) {
    pos = $pos.before($pos.depth);
  }
  return { pos };
}

function onPointerDown(e: PointerEvent) {
  const target = e.target as Element;
  if (!target?.closest?.('[data-drag-handle]')) return;

  const handleEl = target.closest('[data-drag-handle]') as HTMLElement;
  const wrapper = props.editor?.view?.dom?.parentElement;
  if (!wrapper?.contains(handleEl)) return;

  pointerDownInfo = { x: e.clientX, y: e.clientY, handle: handleEl };
}

function onPointerUp(e: PointerEvent) {
  if (!pointerDownInfo) return;

  const { x, y, handle } = pointerDownInfo;
  pointerDownInfo = null;

  const dx = Math.abs(e.clientX - x);
  const dy = Math.abs(e.clientY - y);
  if (dx > CLICK_THRESHOLD || dy > CLICK_THRESHOLD) return;

  if (visible.value) {
    close();
    return;
  }

  const block = findBlockAtHandle(handle);
  if (!block) return;

  currentNodePos = block.pos;

  const handleRect = handle.getBoundingClientRect();
  menuStyle.value = {
    position: 'fixed',
    top: `${handleRect.bottom + 4}px`,
    left: `${handleRect.left}px`,
    zIndex: '9999',
  };
  visible.value = true;
  showTurnInto.value = false;

  nextTick(() => {
    adjustMenuPosition();
    addClickOutside();
  });
}

function adjustMenuPosition() {
  const el = document.querySelector(
    '.zq-drag-menu:not(.zq-drag-menu__turn-into)',
  ) as HTMLElement | null;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (rect.bottom > vh) {
    menuStyle.value.top = `${vh - rect.height - 8}px`;
  }
  if (rect.right > vw) {
    menuStyle.value.left = `${vw - rect.width - 8}px`;
  }
}

function close() {
  visible.value = false;
  showTurnInto.value = false;
  currentNodePos = null;
  removeClickOutside();
}

function addClickOutside() {
  removeClickOutside();
  const handler = (e: MouseEvent) => {
    const target = e.target as Element;
    if (
      target.closest('[data-drag-handle]') ||
      target.closest('.zq-drag-menu') ||
      target.closest('.zq-drag-menu__turn-into')
    ) {
      return;
    }
    close();
  };
  setTimeout(
    () => document.addEventListener('pointerdown', handler),
    50,
  );
  clickOutsideCleanup = () =>
    document.removeEventListener('pointerdown', handler);
}

function removeClickOutside() {
  clickOutsideCleanup?.();
  clickOutsideCleanup = null;
}

// --- Block Operations ---

function getNode() {
  if (currentNodePos === null || !props.editor) return null;
  return props.editor.state.doc.nodeAt(currentNodePos);
}

function deleteBlock() {
  const node = getNode();
  if (!node || currentNodePos === null) return;
  const { state, dispatch } = props.editor.view;
  dispatch(state.tr.delete(currentNodePos, currentNodePos + node.nodeSize));
  close();
}

function duplicateBlock() {
  const node = getNode();
  if (!node || currentNodePos === null) return;
  const { state, dispatch } = props.editor.view;
  const insertPos = currentNodePos + node.nodeSize;
  dispatch(state.tr.insert(insertPos, node.copy(node.content)));
  close();
}

function moveUp() {
  const node = getNode();
  if (!node || currentNodePos === null) return;
  const { state, dispatch } = props.editor.view;
  const $pos = state.doc.resolve(currentNodePos);
  if ($pos.index() === 0) return;

  const prevNode = $pos.parent.child($pos.index() - 1);
  const prevPos = currentNodePos - prevNode.nodeSize;
  const endPos = currentNodePos + node.nodeSize;

  dispatch(
    state.tr.replaceWith(
      prevPos,
      endPos,
      Fragment.from([node.copy(node.content), prevNode.copy(prevNode.content)]),
    ),
  );
  close();
}

function moveDown() {
  const node = getNode();
  if (!node || currentNodePos === null) return;
  const { state, dispatch } = props.editor.view;
  const $pos = state.doc.resolve(currentNodePos);
  if ($pos.index() >= $pos.parent.childCount - 1) return;

  const nextNode = $pos.parent.child($pos.index() + 1);
  const endPos = currentNodePos + node.nodeSize + nextNode.nodeSize;

  dispatch(
    state.tr.replaceWith(
      currentNodePos,
      endPos,
      Fragment.from([
        nextNode.copy(nextNode.content),
        node.copy(node.content),
      ]),
    ),
  );
  close();
}

const canMoveUp = computed(() => {
  if (currentNodePos === null || !visible.value) return false;
  try {
    const $pos = props.editor.state.doc.resolve(currentNodePos);
    return $pos.index() > 0;
  } catch {
    return false;
  }
});

const canMoveDown = computed(() => {
  if (currentNodePos === null || !visible.value) return false;
  try {
    const $pos = props.editor.state.doc.resolve(currentNodePos);
    return $pos.index() < $pos.parent.childCount - 1;
  } catch {
    return false;
  }
});

// --- Turn Into ---

function openTurnInto() {
  showTurnInto.value = true;
  nextTick(() => {
    const triggerEl = turnIntoTriggerRef.value;
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const subWidth = 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.right + 4;
    let top = rect.top;

    if (left + subWidth > vw) {
      left = rect.left - subWidth - 4;
    }
    const subHeight = 320;
    if (top + subHeight > vh) {
      top = vh - subHeight - 8;
    }

    turnIntoStyle.value = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: '10000',
    };
  });
}

function turnInto(type: string, attrs?: Record<string, any>) {
  if (currentNodePos === null || !props.editor) return;

  props.editor.chain().setTextSelection(currentNodePos + 1).run();

  const chain = props.editor.chain().focus();
  switch (type) {
    case 'paragraph': {
      chain.clearNodes().run();
      break;
    }
    case 'heading': {
      chain.clearNodes().setHeading(attrs as any).run();
      break;
    }
    case 'bulletList': {
      chain.clearNodes().toggleBulletList().run();
      break;
    }
    case 'orderedList': {
      chain.clearNodes().toggleOrderedList().run();
      break;
    }
    case 'taskList': {
      chain.clearNodes().toggleTaskList().run();
      break;
    }
    case 'blockquote': {
      chain.clearNodes().toggleBlockquote().run();
      break;
    }
    case 'codeBlock': {
      chain.clearNodes().toggleCodeBlock().run();
      break;
    }
  }
  close();
}

// --- Lifecycle ---

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerup', onPointerUp, true);

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    removeClickOutside();
  });
});
</script>

<template>
  <Teleport to="body">
    <!-- Main menu -->
    <Transition name="zq-drag-menu-fade">
      <div v-if="visible" class="zq-drag-menu" :style="menuStyle">
        <button class="zq-drag-menu__item" @click="deleteBlock">
          <Trash2 class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.blockMenu.delete') }}</span>
        </button>
        <button class="zq-drag-menu__item" @click="duplicateBlock">
          <Copy class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.blockMenu.duplicate') }}</span>
        </button>

        <div class="zq-drag-menu__divider" />

        <button
          class="zq-drag-menu__item"
          :disabled="!canMoveUp"
          @click="moveUp"
        >
          <ArrowUp class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.blockMenu.moveUp') }}</span>
        </button>
        <button
          class="zq-drag-menu__item"
          :disabled="!canMoveDown"
          @click="moveDown"
        >
          <ArrowDown class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.blockMenu.moveDown') }}</span>
        </button>

        <div class="zq-drag-menu__divider" />

        <button
          ref="turnIntoTriggerRef"
          class="zq-drag-menu__item zq-drag-menu__item--sub"
          @mouseenter="openTurnInto"
        >
          <Type class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.blockMenu.turnInto') }}</span>
          <ChevronRight class="zq-drag-menu__arrow" />
        </button>
      </div>
    </Transition>

    <!-- Turn Into submenu -->
    <Transition name="zq-drag-menu-fade">
      <div
        v-if="visible && showTurnInto"
        class="zq-drag-menu zq-drag-menu__turn-into"
        :style="turnIntoStyle"
        @mouseleave="showTurnInto = false"
      >
        <button
          class="zq-drag-menu__item"
          @click="turnInto('paragraph')"
        >
          <Type class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.turnInto.text') }}</span>
        </button>
        <button
          class="zq-drag-menu__item"
          @click="turnInto('heading', { level: 1 })"
        >
          <Heading1 class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.turnInto.heading1') }}</span>
        </button>
        <button
          class="zq-drag-menu__item"
          @click="turnInto('heading', { level: 2 })"
        >
          <Heading2 class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.turnInto.heading2') }}</span>
        </button>
        <button
          class="zq-drag-menu__item"
          @click="turnInto('heading', { level: 3 })"
        >
          <Heading3 class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.turnInto.heading3') }}</span>
        </button>

        <div class="zq-drag-menu__divider" />

        <button
          class="zq-drag-menu__item"
          @click="turnInto('bulletList')"
        >
          <List class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.turnInto.bulletList') }}</span>
        </button>
        <button
          class="zq-drag-menu__item"
          @click="turnInto('orderedList')"
        >
          <ListOrdered class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.turnInto.orderedList') }}</span>
        </button>
        <button
          class="zq-drag-menu__item"
          @click="turnInto('taskList')"
        >
          <ListChecks class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.turnInto.taskList') }}</span>
        </button>

        <div class="zq-drag-menu__divider" />

        <button
          class="zq-drag-menu__item"
          @click="turnInto('blockquote')"
        >
          <Quote class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.turnInto.blockquote') }}</span>
        </button>
        <button
          class="zq-drag-menu__item"
          @click="turnInto('codeBlock')"
        >
          <Code class="zq-drag-menu__icon" />
          <span>{{ $t('zq-editor.turnInto.codeBlock') }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss">
.zq-drag-menu {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-light);
  padding: 4px;
  min-width: 180px;
  user-select: none;

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--el-text-color-primary);
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.15s;

    &:hover:not(:disabled) {
      background: var(--el-fill-color-light);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &--sub {
      position: relative;
    }
  }

  &__icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--el-text-color-secondary);
  }

  &__arrow {
    width: 14px;
    height: 14px;
    margin-left: auto;
    color: var(--el-text-color-placeholder);
  }

  &__divider {
    height: 1px;
    margin: 4px 6px;
    background: var(--el-border-color-lighter);
  }
}

.zq-drag-menu-fade-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.zq-drag-menu-fade-leave-active {
  transition: opacity 0.1s ease;
}

.zq-drag-menu-fade-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.zq-drag-menu-fade-leave-to {
  opacity: 0;
}
</style>
