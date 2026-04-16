<script setup lang="ts">
import { computed } from 'vue';

import { ChevronDown, ChevronRight } from '@/components/icons';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/vue-3';

import { $t } from '../../utils/i18n';

const props = defineProps<{
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
}>();

const level = computed(() => {
  const l = Number(props.node.attrs.level) || 1;
  return Math.min(6, Math.max(1, l));
});

const headingTag = computed(
  () => `h${level.value}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
);

const collapsed = computed(() => props.node.attrs.collapsed === true);

function toggleCollapsed() {
  props.updateAttributes({ collapsed: !collapsed.value });
}
</script>

<template>
  <NodeViewWrapper
    :as="headingTag"
    class="zq-heading-fold"
    :class="{ 'zq-heading-fold--is-collapsed': collapsed }"
    :data-collapsed="collapsed ? 'true' : undefined"
  >
    <button
      type="button"
      class="zq-heading-fold__btn"
      contenteditable="false"
      tabindex="-1"
      :title="
        collapsed
          ? $t('zq-editor.headingFold.expand')
          : $t('zq-editor.headingFold.collapse')
      "
      @mousedown.prevent
      @click.stop="toggleCollapsed"
    >
      <ChevronRight v-if="collapsed" class="zq-heading-fold__icon" />
      <ChevronDown v-else class="zq-heading-fold__icon" />
    </button>
    <NodeViewContent as="span" class="zq-heading-fold__content" />
  </NodeViewWrapper>
</template>

<style scoped>
/*
 * 全局手柄用 dragHandleWidth=46：左缘在正文左缘左侧 46px，折叠按钮紧挨手柄右侧（占 22px +4px 与正文间距）
 * 与 tiptap 插件一致：垂直方向对齐 (lineHeight - 24) / 2，此处用 1lh 与 22px 按钮近似
 */
.zq-heading-fold {
  position: relative;
}

.zq-heading-fold__btn {
  position: absolute;
  top: 0.5em;
  left: calc(-1 * (var(--zq-heading-fold-btn, 22px) + var(--zq-heading-fold-gap, 4px)));
  z-index: 51;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--zq-heading-fold-btn, 22px);
  height: var(--zq-heading-fold-btn, 22px);
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  opacity: 0.65;
  /* 与 .drag-handle 一致：隐藏时仍参与命中，才能从标题移入按钮而不丢 hover */
  pointer-events: auto;
  transition:
    opacity 0.12s ease,
    background-color 0.15s;
}

/* 略扩大热区，避免从正文移入图标时经过缝隙丢悬停 */
.zq-heading-fold__btn::after {
  content: '';
  position: absolute;
  inset: -6px;
}

@supports (top: 1lh) {
  .zq-heading-fold__btn {
    top: calc((1lh - var(--zq-heading-fold-btn, 22px)) / 2);
  }
}

/* 展开：视觉上隐藏但保持可命中；仅透明度变化，不用 visibility/pointer-events:none（否则会像丢手柄 hover 一样提前消失） */
.zq-heading-fold:not(.zq-heading-fold--is-collapsed):not(:hover):not(:focus-within)
  .zq-heading-fold__btn {
  opacity: 0;
}

.zq-heading-fold:not(.zq-heading-fold--is-collapsed):hover .zq-heading-fold__btn,
.zq-heading-fold:not(.zq-heading-fold--is-collapsed):focus-within .zq-heading-fold__btn,
.zq-heading-fold:not(.zq-heading-fold--is-collapsed) .zq-heading-fold__btn:hover {
  opacity: 0.65;
}

.zq-heading-fold--is-collapsed .zq-heading-fold__btn {
  opacity: 0.65;
}

.zq-heading-fold__btn:hover {
  opacity: 1;
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.zq-heading-fold__icon {
  width: 14px;
  height: 14px;
}

.zq-heading-fold__content {
  display: inline;
}
</style>
