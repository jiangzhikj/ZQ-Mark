<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Trash2,
} from '@/components/icons';

import { NodeViewWrapper } from '@tiptap/vue-3';

const props = defineProps<{
  deleteNode: () => void;
  node: any;
  selected: boolean;
  updateAttributes: (attrs: Record<string, any>) => void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const isSelected = ref(false);
const showMenu = ref(false);
const menuPosition = ref({ x: 0, y: 0 });
const isResizing = ref(false);
const resizeStartX = ref(0);
const resizeStartWidth = ref(0);
const resizeCorner = ref('se');
const originalRatio = ref(16 / 9);

const displaySrc = computed(() => props.node.attrs.src || '');

const alignment = computed(() => props.node.attrs.alignment || 'center');
const nodeStyle = computed(() => {
  const justifyMap: Record<string, string> = {
    left: 'flex-start', center: 'center', right: 'flex-end',
  };
  return { display: 'flex', justifyContent: justifyMap[alignment.value] || 'center' };
});

const containerStyle = computed(() => {
  const w = props.node.attrs.width;
  return {
    width: typeof w === 'number' ? `${w}px` : (w || '100%'),
  };
});

function handleVideoLoaded() {
  if (videoRef.value) {
    originalRatio.value = videoRef.value.videoWidth / videoRef.value.videoHeight;
  }
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  isSelected.value = true;
  menuPosition.value = { x: e.clientX, y: e.clientY };
  showMenu.value = true;
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

function closeMenu() {
  showMenu.value = false;
  document.removeEventListener('click', closeMenu);
}

function setAlignment(align: 'center' | 'left' | 'right') {
  props.updateAttributes({ alignment: align });
  closeMenu();
}

function startResize(e: MouseEvent, corner: string) {
  e.preventDefault();
  e.stopPropagation();
  isResizing.value = true;
  resizeCorner.value = corner;
  resizeStartX.value = e.clientX;
  const wrapper = (e.target as HTMLElement).closest('.zq-video-wrapper') as HTMLElement;
  resizeStartWidth.value = wrapper?.offsetWidth || 400;
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
}

function onResize(e: MouseEvent) {
  if (!isResizing.value) return;
  const delta = e.clientX - resizeStartX.value;
  const isLeft = resizeCorner.value === 'sw';
  const newWidth = Math.max(100, isLeft
    ? resizeStartWidth.value - delta
    : resizeStartWidth.value + delta);
  const newHeight = Math.round(newWidth / originalRatio.value);
  props.updateAttributes({ width: newWidth, height: newHeight });
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.zq-video-node') && !target.closest('.zq-video-menu')) {
    isSelected.value = false;
    closeMenu();
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside));
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
});
</script>

<template>
  <NodeViewWrapper class="zq-video-node" :style="nodeStyle">
    <div
      class="zq-video-wrapper"
      :class="{ 'is-selected': isSelected || selected }"
      :style="containerStyle"
      @click="isSelected = true"
      @contextmenu="handleContextMenu"
    >
      <video
        ref="videoRef"
        :src="displaySrc"
        controls
        class="zq-video"
        @loadedmetadata="handleVideoLoaded"
      />
      <template v-if="isSelected || selected">
        <div class="zq-resize-handle zq-resize-se" @mousedown="startResize($event, 'se')" />
        <div class="zq-resize-handle zq-resize-sw" @mousedown="startResize($event, 'sw')" />
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="showMenu"
        class="zq-video-menu"
        :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }"
        @click.stop
      >
        <div class="zq-video-menu__row">
          <button
            v-for="a in (['left', 'center', 'right'] as const)"
            :key="a"
            class="zq-video-menu__icon-btn"
            :class="{ 'is-active': alignment === a }"
            @click="setAlignment(a)"
          >
            <component :is="{ left: AlignLeft, center: AlignCenter, right: AlignRight }[a]" class="h-4 w-4" />
          </button>
        </div>
        <div class="zq-video-menu__divider" />
        <button class="zq-video-menu__item zq-video-menu__item--danger" @click="deleteNode(); closeMenu()">
          <Trash2 class="h-4 w-4" />
          <span>{{ $t('common.delete') }}</span>
        </button>
      </div>
    </Teleport>
  </NodeViewWrapper>
</template>

<style scoped>
.zq-video-node { display: block; margin: 0.75rem 0; }
.zq-video-wrapper {
  position: relative; display: inline-block; max-width: 100%;
  border-radius: 8px; transition: box-shadow 0.2s;
}
.zq-video-wrapper:hover { box-shadow: 0 0 0 2px var(--el-color-primary-light-5); }
.zq-video-wrapper.is-selected { box-shadow: 0 0 0 2px var(--el-color-primary); }
.zq-video { display: block; width: 100%; height: auto; border-radius: 8px; background: var(--el-fill-color-darker); }

.zq-resize-handle {
  position: absolute; z-index: 10; width: 12px; height: 12px;
  background: var(--el-color-primary); border: 2px solid var(--el-bg-color); border-radius: 50%;
}
.zq-resize-se { right: -6px; bottom: -6px; cursor: se-resize; }
.zq-resize-sw { bottom: -6px; left: -6px; cursor: sw-resize; }

.zq-video-menu {
  position: fixed; z-index: 9999; min-width: 140px; padding: 6px;
  background: var(--el-bg-color); border: 1px solid var(--el-border-color-light);
  border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.zq-video-menu__row { display: flex; gap: 4px; padding: 4px; }
.zq-video-menu__divider { height: 1px; background: var(--el-border-color-lighter); margin: 4px; }
.zq-video-menu__icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 26px; border: 1px solid var(--el-border-color);
  border-radius: 4px; background: transparent; cursor: pointer; color: var(--el-text-color-regular);
}
.zq-video-menu__icon-btn:hover { border-color: var(--el-color-primary); color: var(--el-color-primary); }
.zq-video-menu__icon-btn.is-active { background: var(--el-color-primary); color: var(--el-color-white); border-color: var(--el-color-primary); }
.zq-video-menu__item {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 6px 8px; border: none; background: transparent; cursor: pointer;
  font-size: 0.8125rem; color: var(--el-text-color-regular); border-radius: 5px;
}
.zq-video-menu__item:hover { background: var(--el-fill-color-light); }
.zq-video-menu__item--danger { color: var(--el-color-danger); }
.zq-video-menu__item--danger:hover { background: var(--el-color-danger-light-9); }
</style>
