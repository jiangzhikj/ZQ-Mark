<script setup lang="ts">
import { ref, watch } from 'vue';
import type { DrawData, DrawProps } from './types';
import { useDrawStore } from './store/draw-store';
import { useDrawEngine } from './composables/use-draw-engine';
import { useKeyboard } from './composables/use-keyboard';
import DrawCanvas from './components/DrawCanvas.vue';
import DrawToolbar from './components/DrawToolbar.vue';
import ZoomControls from './components/ZoomControls.vue';
import UndoRedoControls from './components/UndoRedoControls.vue';
import TextEditor from './components/TextEditor.vue';
import PropertyPanel from './components/PropertyPanel.vue';
import ContextMenu from './components/ContextMenu.vue';
import HyperlinkPopup from './components/HyperlinkPopup.vue';
import StatsPanel from './components/StatsPanel.vue';
import MainMenu from './components/MainMenu.vue';
import { useI18n } from 'vue-i18n';
import { Magnet, BarChart, Minimize2 } from '@/components/icons';

const { t: $t } = useI18n();
import { exportToBlob } from './data/export-canvas';
import { exportToSvgString } from './data/export-svg';
import { serializeAsJSON } from './data/json';
import { loadDrawFonts } from './fonts';

const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null);

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  contextMenuRef.value?.show(e);
}

const props = withDefaults(defineProps<DrawProps>(), {
  readonly: false,
  width: '100%',
  height: '100%',
});

const emit = defineEmits<{
  (e: 'update:modelValue', data: DrawData): void;
  (e: 'change', elements: any[], appState: any): void;
  (e: 'save', data: DrawData): void;
}>();

const store = useDrawStore();

useDrawEngine({
  initialData: props.modelValue ?? null,
  readonly: props.readonly,
});

useKeyboard();

loadDrawFonts().then(() => {
  store.requestRender();
});

// sync props
watch(
  () => props.theme,
  (val) => {
    if (val) store.theme = val;
  },
  { immediate: true },
);

watch(
  () => props.gridMode,
  (val) => {
    if (val !== undefined) store.gridModeEnabled = val;
  },
  { immediate: true },
);

watch(
  () => props.zenMode,
  (val) => {
    if (val !== undefined) store.zenModeEnabled = val;
  },
  { immediate: true },
);

watch(
  () => props.readonly,
  (val) => {
    store.viewModeEnabled = !!val;
    store.requestRender();
  },
);

// watch model value changes from outside
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      store.loadDrawData(val);
    }
  },
);

// emit changes
watch(
  () => store.sceneVersion,
  () => {
    const data = store.getDrawData();
    emit('update:modelValue', data);
    emit('change', [...data.elements], data.appState);
  },
);

const containerStyle = ref({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
});

// Exposed API
function getJSON(): string {
  return serializeAsJSON(
    store.scene.getElements(),
    store.getAppState(),
    store.files,
  );
}

async function getThumbnail(
  opts: { scale?: number; maxWidth?: number } = {},
): Promise<string> {
  const blob = await exportToBlob(
    store.scene.getNonDeletedElements(),
    store.getAppState(),
    store.files,
    store.imageCache,
    { scale: opts.scale ?? 1 },
  );
  return URL.createObjectURL(blob);
}

function save(): void {
  const data = store.getDrawData();
  emit('save', data);
}

function getElements() {
  return store.scene.getNonDeletedElements();
}

function getDrawData(): DrawData {
  return store.getDrawData();
}

async function exportToPng(
  opts: { background?: boolean; scale?: number; darkMode?: boolean } = {},
): Promise<Blob> {
  const appState = store.getAppState();
  const background = opts.background ?? appState.exportBackground;
  const scale = opts.scale ?? appState.exportScale;
  if (opts.darkMode ?? appState.exportWithDarkMode) {
    appState.viewBackgroundColor = '#121212';
  }
  return exportToBlob(
    store.scene.getNonDeletedElements(),
    appState,
    store.files,
    store.imageCache,
    { background, scale },
  );
}

function exportToSvg(
  opts: { background?: boolean } = {},
): string {
  const appState = store.getAppState();
  const background = opts.background ?? appState.exportBackground;
  return exportToSvgString(
    store.scene.getNonDeletedElements(),
    appState,
    store.files,
    { background },
  );
}

async function copyAsPng(
  opts: { background?: boolean; scale?: number } = {},
): Promise<void> {
  const blob = await exportToPng(opts);
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
}

async function copyAsSvg(
  opts: { background?: boolean } = {},
): Promise<void> {
  const svgStr = exportToSvg(opts);
  await navigator.clipboard.writeText(svgStr);
}

defineExpose({
  getJSON,
  getThumbnail,
  save,
  getElements,
  getDrawData,
  exportToPng,
  exportToSvg,
  copyAsPng,
  copyAsSvg,
  store,
});
</script>

<template>
  <div class="zq-draw" :style="containerStyle" @contextmenu="onContextMenu">
    <DrawCanvas />

    <TextEditor />
    <PropertyPanel
      :class="{ 'zq-draw-zen-hidden': store.zenModeEnabled }"
    />
    <HyperlinkPopup />
    <ContextMenu ref="contextMenuRef" />
    <StatsPanel
      :class="{ 'zq-draw-zen-hidden': store.zenModeEnabled }"
    />

    <template v-if="!props.readonly">
      <div
        class="zq-draw-top-toolbar"
        :class="{ 'zq-draw-zen-hidden': store.zenModeEnabled }"
      >
        <DrawToolbar />
      </div>

      <div
        class="zq-draw-top-left"
        :class="{ 'zq-draw-zen-hidden': store.zenModeEnabled }"
      >
        <MainMenu />
      </div>

      <div
        class="zq-draw-bottom-left"
        :class="{ 'zq-draw-zen-hidden': store.zenModeEnabled }"
      >
        <UndoRedoControls />
        <ZoomControls />
        <div class="zq-draw-toggle-group">
          <button
            class="zq-draw-toggle-btn"
            :class="{ 'is-active': store.objectsSnapModeEnabled }"
            :title="$t('draw.action.toggleSnap') + ' (Alt+S)'"
            @click="store.objectsSnapModeEnabled = !store.objectsSnapModeEnabled"
          >
            <Magnet class="zq-draw-toggle-icon" />
          </button>
          <button
            class="zq-draw-toggle-btn"
            :class="{ 'is-active': store.showStats }"
            :title="$t('draw.action.toggleStats') + ' (Alt+I)'"
            @click="store.showStats = !store.showStats"
          >
            <BarChart class="zq-draw-toggle-icon" />
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="zq-draw-bottom-left">
        <ZoomControls />
      </div>
    </template>

    <!-- Zen Mode exit hint -->
    <div
      v-if="store.zenModeEnabled && !props.readonly"
      class="zq-draw-zen-exit"
      :title="$t('draw.action.toggleZenMode') + ' (Alt+Z)'"
      @click="store.zenModeEnabled = false"
    >
      <Minimize2 class="h-4 w-4" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.zq-draw {
  position: relative;
  overflow: hidden;
  background: var(--bg-editor);
}

.zq-draw-top-toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.zq-draw-top-left {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
}

.zq-draw-bottom-left {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.zq-draw-toggle-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.zq-draw-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s;

  &:hover {
    background: var(--bg-hover);
  }

  &.is-active {
    background: var(--accent-shadow);
    color: var(--accent-color);
  }
}

.zq-draw-toggle-icon {
  width: 16px;
  height: 16px;
}

.zq-draw-zen-hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.zq-draw-top-toolbar,
.zq-draw-top-left,
.zq-draw-bottom-left,
.zq-draw-property-panel {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.zq-draw-zen-exit {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  cursor: pointer;
  color: var(--text-secondary);
  opacity: 0.15;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
    box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
  }
}
</style>
