<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Menu,
  FolderOpen,
  Save,
  Download,
  FileImage,
  FileJson,
  FileCode,
  Copy,
  ChevronRight,
} from '@/components/icons';

const { t: $t } = useI18n();
import { useDrawStore } from '../store/draw-store';
import { serializeAsJSON, deserializeFromJSON } from '../data/json';
import { exportToBlob } from '../data/export-canvas';
import { exportToSvgString } from '../data/export-svg';

const store = useDrawStore();

const exportSubOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);

function toggleMenu() {
  store.mainMenuOpen = !store.mainMenuOpen;
  if (!store.mainMenuOpen) {
    exportSubOpen.value = false;
  }
}

function closeMenu() {
  store.mainMenuOpen = false;
  exportSubOpen.value = false;
}

function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
});

function handleOpen() {
  closeMenu();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.excalidraw';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = deserializeFromJSON(text);
    if (data) {
      store.loadDrawData(data);
    }
  };
  input.click();
}

function handleSaveTo() {
  closeMenu();
  const json = serializeAsJSON(
    store.scene.getElements(),
    store.getAppState(),
    store.files,
  );
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${store.getAppState().name || 'drawing'}.zqdraw.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleExportPng() {
  closeMenu();
  const appState = store.getAppState();
  const blob = await exportToBlob(
    store.scene.getNonDeletedElements(),
    appState,
    store.files,
    store.imageCache,
    { scale: appState.exportScale, background: appState.exportBackground },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${appState.name || 'drawing'}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleExportSvg() {
  closeMenu();
  const appState = store.getAppState();
  const svgStr = exportToSvgString(
    store.scene.getNonDeletedElements(),
    appState,
    store.files,
    { background: appState.exportBackground },
  );
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${appState.name || 'drawing'}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleExportJson() {
  closeMenu();
  handleSaveTo();
}

async function handleCopyPng() {
  closeMenu();
  const appState = store.getAppState();
  const blob = await exportToBlob(
    store.scene.getNonDeletedElements(),
    appState,
    store.files,
    store.imageCache,
    { scale: appState.exportScale, background: appState.exportBackground },
  );
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
}

async function handleCopySvg() {
  closeMenu();
  const appState = store.getAppState();
  const svgStr = exportToSvgString(
    store.scene.getNonDeletedElements(),
    appState,
    store.files,
    { background: appState.exportBackground },
  );
  await navigator.clipboard.writeText(svgStr);
}
</script>

<template>
  <div ref="menuRef" class="zq-draw-main-menu">
    <button
      class="zq-draw-main-menu-trigger"
      :title="$t('draw.menu.openFile')"
      @click="toggleMenu"
    >
      <Menu class="h-[18px] w-[18px]" />
    </button>

    <Transition name="zq-menu-fade">
      <div v-if="store.mainMenuOpen" class="zq-draw-main-menu-dropdown">
        <button class="zq-menu-item" @click="handleOpen">
          <FolderOpen class="zq-menu-item-icon" />
          <span>{{ $t('draw.menu.openFile') }}</span>
          <span class="zq-menu-item-shortcut">Ctrl+O</span>
        </button>

        <button class="zq-menu-item" @click="handleSaveTo">
          <Save class="zq-menu-item-icon" />
          <span>{{ $t('draw.menu.saveTo') }}</span>
          <span class="zq-menu-item-shortcut">Ctrl+Shift+S</span>
        </button>

        <div class="zq-menu-separator" />

        <div
          class="zq-menu-sub"
          @mouseenter="exportSubOpen = true"
          @mouseleave="exportSubOpen = false"
        >
          <button class="zq-menu-item">
            <Download class="zq-menu-item-icon" />
            <span>{{ $t('draw.menu.export') }}</span>
            <ChevronRight class="zq-menu-item-arrow" />
          </button>

          <Transition name="zq-menu-fade">
            <div v-if="exportSubOpen" class="zq-draw-main-menu-submenu">
              <button class="zq-menu-item" @click="handleExportPng">
                <FileImage class="zq-menu-item-icon" />
                <span>{{ $t('draw.menu.exportPng') }}</span>
              </button>
              <button class="zq-menu-item" @click="handleExportSvg">
                <FileCode class="zq-menu-item-icon" />
                <span>{{ $t('draw.menu.exportSvg') }}</span>
              </button>
              <button class="zq-menu-item" @click="handleExportJson">
                <FileJson class="zq-menu-item-icon" />
                <span>{{ $t('draw.menu.exportJson') }}</span>
              </button>

              <div class="zq-menu-separator" />

              <button class="zq-menu-item" @click="handleCopyPng">
                <Copy class="zq-menu-item-icon" />
                <span>{{ $t('draw.menu.exportCopyPng') }}</span>
              </button>
              <button class="zq-menu-item" @click="handleCopySvg">
                <Copy class="zq-menu-item-icon" />
                <span>{{ $t('draw.menu.exportCopySvg') }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.zq-draw-main-menu {
  position: relative;
}

.zq-draw-main-menu-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-editor);
  cursor: pointer;
  color: var(--text-secondary);
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
  transition: all 0.15s;

  &:hover {
    background: var(--bg-hover);
  }
}

.zq-draw-main-menu-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 220px;
  padding: 4px;
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
  z-index: 100;
}

.zq-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;

  &:hover {
    background: var(--bg-hover);
  }
}

.zq-menu-item-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.zq-menu-item-shortcut {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-placeholder);
}

.zq-menu-item-arrow {
  width: 14px;
  height: 14px;
  margin-left: auto;
  flex-shrink: 0;
  color: var(--text-placeholder);
}

.zq-menu-separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--border-color);
}

.zq-menu-sub {
  position: relative;
}

.zq-draw-main-menu-submenu {
  position: absolute;
  top: -4px;
  left: calc(100% + 4px);
  min-width: 200px;
  padding: 4px;
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
  z-index: 101;
}

.zq-menu-fade-enter-active,
.zq-menu-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.zq-menu-fade-enter-from,
.zq-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
