<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useDrawStore } from '../store/draw-store';
import { FONT_FAMILY_FALLBACKS } from '../constants';
import { sceneCoordsToViewport } from '../core/renderer/helpers';
import type { DrawTextElement, DrawElement, DrawLinearElement } from '../types';
import {
  getContainerElement,
  getBoundTextMaxWidth,
  getBoundTextMaxHeight,
  measureText,
  computeBoundTextPosition,
  computeContainerDimensionForBoundText,
  getContainerTextCoords,
  getArrowLabelPosition,
  redrawTextBoundingBox,
  getLineHeightInPx,
  BOUND_TEXT_PADDING,
} from '../elements/bound-text';

const store = useDrawStore();
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const isEditing = computed(() => !!store.editingTextElement);

const editingElement = computed<DrawTextElement | null>(() => {
  if (!store.editingTextElement) return null;
  const el = store.scene.getElement(store.editingTextElement.id);
  return (el as DrawTextElement) ?? store.editingTextElement;
});

const container = computed<DrawElement | null>(() => {
  const el = editingElement.value;
  if (!el?.containerId) return null;
  return getContainerElement(el, store.scene);
});

const isArrowLabel = computed(() => {
  const c = container.value;
  return c?.type === 'arrow' || c?.type === 'line';
});

const editorPosition = computed(() => {
  const el = editingElement.value;
  if (!el) return { x: 0, y: 0 };

  const c = container.value;

  if (c && isArrowLabel.value) {
    const arrow = c as DrawLinearElement;
    const center = getArrowLabelPosition(arrow);
    const textW = el.width || 0;
    const minW = el.fontSize * 2;
    const editorW = Math.max(textW, minW);
    return {
      x: center.x - editorW / 2,
      y: center.y - (el.height || 0) / 2,
    };
  }

  if (c) {
    const maxHeight = getBoundTextMaxHeight(c, el);
    const textHeight = el.height || 0;

    let coords: { x: number; y: number };
    if (c.type === 'ellipse' || c.type === 'diamond') {
      const cx = c.x + c.width / 2;
      const cy = c.y + c.height / 2;
      const maxW = getBoundTextMaxWidth(c);
      coords = {
        x: cx - maxW / 2,
        y: cy - maxHeight / 2,
      };
    } else {
      coords = getContainerTextCoords(c);
    }

    let offsetY = 0;
    if (el.verticalAlign === 'middle') {
      offsetY = (maxHeight - textHeight) / 2;
    } else if (el.verticalAlign === 'bottom') {
      offsetY = maxHeight - textHeight;
    }

    return {
      x: coords.x,
      y: coords.y + offsetY,
    };
  }

  return { x: el.x, y: el.y };
});

const style = computed(() => {
  const el = editingElement.value;
  if (!el) return {};

  const pos = editorPosition.value;
  const { x, y } = sceneCoordsToViewport(pos.x, pos.y, {
    scrollX: store.scrollX,
    scrollY: store.scrollY,
    zoom: store.zoom,
  });

  const fontFamily = FONT_FAMILY_FALLBACKS[el.fontFamily] ?? 'sans-serif';
  const fontSize = el.fontSize * store.zoom.value;
  const lineHeightPx = getLineHeightInPx(el.fontSize, el.lineHeight);
  const lineHeightRatio = lineHeightPx / el.fontSize;

  const c = container.value;
  const isBound = !!c;
  const isArrow = isArrowLabel.value;

  let width: string;
  let whiteSpace: string;
  let wordBreak: string;
  let textAlign: string;

  if (isBound && !isArrow) {
    const maxW = getBoundTextMaxWidth(c!) * store.zoom.value;
    width = `${maxW}px`;
    whiteSpace = 'pre-wrap';
    wordBreak = 'break-word';
    textAlign = el.textAlign;
  } else if (isArrow) {
    const textW = el.width || 0;
    const minW = el.fontSize * 2;
    width = `${Math.max(textW, minW) * store.zoom.value}px`;
    whiteSpace = 'pre';
    wordBreak = 'normal';
    textAlign = 'center';
  } else {
    width = el.autoResize ? 'auto' : `${el.width * store.zoom.value}px`;
    whiteSpace = el.autoResize ? 'pre' : 'pre-wrap';
    wordBreak = el.autoResize ? 'normal' : 'break-word';
    textAlign = el.textAlign;
  }

  const angle = (isArrow ? 0 : (c?.angle ?? el.angle)) || 0;

  const bgColor = isArrow
    ? (store.viewBackgroundColor || '#ffffff')
    : 'transparent';

  const pad = isArrow ? `${BOUND_TEXT_PADDING * store.zoom.value}px` : '0';

  return {
    position: 'absolute' as const,
    left: `${x}px`,
    top: `${y}px`,
    fontSize: `${fontSize}px`,
    fontFamily,
    color: el.strokeColor,
    textAlign,
    lineHeight: String(lineHeightRatio),
    opacity: el.opacity / 100,
    border: 'none',
    outline: 'none',
    background: bgColor,
    resize: 'none' as const,
    overflow: 'hidden',
    minWidth: isArrow ? undefined : '1em',
    minHeight: `${fontSize + 4}px`,
    padding: pad,
    margin: isArrow ? `-${pad}` : '0',
    zIndex: 100,
    whiteSpace: whiteSpace as any,
    wordBreak: wordBreak as any,
    width,
    transformOrigin: '0 0',
    transform: angle ? `rotate(${angle}rad)` : undefined,
  };
});

watch(isEditing, async (val) => {
  if (val) {
    await nextTick();
    const textarea = textareaRef.value;
    if (textarea) {
      textarea.focus();
      const len = textarea.value.length;
      textarea.setSelectionRange(len, len);
    }
  }
});

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  const text = target.value;
  const el = editingElement.value;
  if (!el) return;

  const c = container.value;
  const isBound = !!c;
  const isArrow = isArrowLabel.value;

  if (isBound && !isArrow) {
    const maxWidth = getBoundTextMaxWidth(c!);
    const metrics = measureText(
      text,
      el.fontSize,
      el.fontFamily,
      el.lineHeight,
      maxWidth,
    );

    store.updateElement(el.id, {
      originalText: text,
      text: metrics.wrappedText,
      width: metrics.width,
      height: metrics.height,
    } as any);

    const maxHeight = getBoundTextMaxHeight(c!, el);
    if (metrics.height > maxHeight) {
      const nextHeight = computeContainerDimensionForBoundText(
        metrics.height,
        c!.type,
      );
      store.updateElement(c!.id, { height: nextHeight } as any);
    }

    const updatedContainer = store.scene.getElement(c!.id) || c!;
    const updatedText = store.scene.getElement(el.id) as DrawTextElement;
    if (updatedText) {
      const pos = computeBoundTextPosition(updatedContainer, {
        ...updatedText,
        width: metrics.width,
        height: metrics.height,
      } as DrawTextElement, store.scene);
      store.updateElement(el.id, { x: pos.x, y: pos.y } as any);
    }
  } else if (isArrow) {
    const metrics = measureText(
      text,
      el.fontSize,
      el.fontFamily,
      el.lineHeight,
    );

    const arrow = c as DrawLinearElement;
    const center = getArrowLabelPosition(arrow);

    store.updateElement(el.id, {
      originalText: text,
      text,
      width: metrics.width,
      height: metrics.height,
      x: center.x - metrics.width / 2,
      y: center.y - metrics.height / 2,
    } as any);
  } else {
    const metrics = measureText(
      text,
      el.fontSize,
      el.fontFamily,
      el.lineHeight,
      el.autoResize ? undefined : el.width,
    );

    const updates: Record<string, any> = {
      originalText: text,
      text: el.autoResize ? text : metrics.wrappedText,
      height: metrics.height,
    };

    if (el.autoResize) {
      updates.width = metrics.width;
    }

    store.updateElement(el.id, updates as any);
  }

  store.requestRender();
}

function handleBlur() {
  requestAnimationFrame(() => {
    if (textareaRef.value && document.activeElement === textareaRef.value) {
      return;
    }
    finishEditing();
  });
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    finishEditing();
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey && isArrowLabel.value) {
    e.preventDefault();
    finishEditing();
    return;
  }

  e.stopPropagation();
}

function finishEditing() {
  const el = editingElement.value;
  if (!el) return;

  const c = container.value;
  const latestEl = store.scene.getElement(el.id) as DrawTextElement | undefined;
  const textContent = latestEl?.originalText ?? el.originalText ?? el.text;

  if (!textContent || !textContent.trim()) {
    if (c && c.boundElements) {
      const newBound = c.boundElements.filter((b) => b.id !== el.id);
      store.updateElement(c.id, {
        boundElements: newBound.length > 0 ? newBound : null,
      } as any);
    }
    store.scene.deleteElement(el.id);
  } else {
    if (c) {
      const updatedText = (store.scene.getElement(el.id) as DrawTextElement) || el;
      redrawTextBoundingBox(updatedText, c, store.scene);
    }
    store.recordHistory();
  }

  store.editingTextElement = null;
  if (c) {
    store.selectElement(c.id);
  }
  store.requestRender();
}
</script>

<template>
  <textarea
    v-if="isEditing"
    ref="textareaRef"
    :value="editingElement?.originalText ?? editingElement?.text ?? ''"
    :style="style"
    class="zq-draw-text-editor"
    spellcheck="false"
    wrap="off"
    @input="handleInput"
    @blur="handleBlur"
    @keydown="handleKeyDown"
  />
</template>

<style scoped>
.zq-draw-text-editor {
  position: absolute;
  z-index: 100;
  box-sizing: content-box;
  letter-spacing: 0;
}
</style>
