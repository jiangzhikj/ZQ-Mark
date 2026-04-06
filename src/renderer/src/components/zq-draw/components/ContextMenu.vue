<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  Layers,
  Lock,
  Unlock,
  Group,
  Ungroup,
  FlipHorizontal2,
  FlipVertical2,
  Link,
  ChevronRight,
  AlignLeft,
  Paintbrush,
} from '@/components/icons';
import { useDrawStore } from '../store/draw-store';

const { t } = useI18n();
const store = useDrawStore();

const visible = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const expandedSub = ref<string | null>(null);

const hasSelection = computed(() => store.selectedElements.length > 0);
const isMultiSelect = computed(() => store.selectedElements.length > 1);
const isLocked = computed(() => store.isSelectedLocked);

const hasGroup = computed(() => {
  return store.selectedElements.some((el) => el.groupIds.length > 0);
});

function show(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  visible.value = true;
  menuX.value = e.clientX;
  menuY.value = e.clientY;
  expandedSub.value = null;
}

function hide() {
  visible.value = false;
  expandedSub.value = null;
}

function handleAction(action: string) {
  hide();
  switch (action) {
    case 'copy':
      store.copySelectedElements();
      break;
    case 'cut':
      store.cutSelectedElements();
      break;
    case 'paste':
      store.pasteFromClipboard();
      break;
    case 'duplicate':
      store.duplicateSelectedElements();
      break;
    case 'delete':
      store.deleteSelectedElementsWithBindings();
      break;
    case 'selectAll':
      store.selectAll();
      break;
    case 'bringToFront':
      store.bringToFront();
      break;
    case 'sendToBack':
      store.sendToBack();
      break;
    case 'bringForward':
      store.bringForward();
      break;
    case 'sendBackward':
      store.sendBackward();
      break;
    case 'lock':
      store.lockSelected();
      break;
    case 'unlock':
      store.unlockSelected();
      break;
    case 'group':
      store.groupSelected();
      break;
    case 'ungroup':
      store.ungroupSelected();
      break;
    case 'flipH':
      store.flipSelectedHorizontal();
      break;
    case 'flipV':
      store.flipSelectedVertical();
      break;
    case 'addLink':
      store.showHyperlinkPopup = 'editor';
      break;
    case 'alignLeft':
      store.alignSelected({ position: 'start', axis: 'x' });
      break;
    case 'alignCenter':
      store.alignSelected({ position: 'center', axis: 'x' });
      break;
    case 'alignRight':
      store.alignSelected({ position: 'end', axis: 'x' });
      break;
    case 'alignTop':
      store.alignSelected({ position: 'start', axis: 'y' });
      break;
    case 'alignMiddle':
      store.alignSelected({ position: 'center', axis: 'y' });
      break;
    case 'alignBottom':
      store.alignSelected({ position: 'end', axis: 'y' });
      break;
    case 'distributeH':
      store.distributeSelected({ space: 'between', axis: 'x' });
      break;
    case 'distributeV':
      store.distributeSelected({ space: 'between', axis: 'y' });
      break;
    case 'copyStyle':
      store.copyStyle();
      break;
    case 'pasteStyle':
      store.pasteStyle();
      break;
    case 'toggleGrid':
      store.gridModeEnabled = !store.gridModeEnabled;
      store.requestRender();
      break;
  }
}

function onDocumentClick() {
  if (visible.value) hide();
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
});

defineExpose({ show });
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed z-[9999] min-w-48 rounded-lg border border-border bg-popover py-1 text-sm text-popover-foreground shadow-lg"
      :style="{ left: `${menuX}px`, top: `${menuY}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <!-- With selection -->
      <template v-if="hasSelection">
        <button class="menu-item" @click="handleAction('copy')">
          <Copy class="menu-icon" />
          {{ t('draw.menu.copy') }}
          <span class="menu-shortcut">Ctrl+C</span>
        </button>
        <button class="menu-item" @click="handleAction('cut')">
          <Scissors class="menu-icon" />
          {{ t('draw.menu.cut') }}
          <span class="menu-shortcut">Ctrl+X</span>
        </button>
        <button class="menu-item" @click="handleAction('paste')">
          <Clipboard class="menu-icon" />
          {{ t('draw.menu.paste') }}
          <span class="menu-shortcut">Ctrl+V</span>
        </button>
        <button class="menu-item" @click="handleAction('duplicate')">
          <Copy class="menu-icon" />
          {{ t('draw.menu.duplicate') }}
          <span class="menu-shortcut">Ctrl+D</span>
        </button>

        <div class="menu-separator" />

        <button class="menu-item" @click="handleAction('copyStyle')">
          <Paintbrush class="menu-icon" />
          {{ t('draw.menu.copyStyle') }}
          <span class="menu-shortcut">Ctrl+Alt+C</span>
        </button>
        <button
          class="menu-item"
          :class="{ 'opacity-50 pointer-events-none': !store.copiedStyle }"
          @click="handleAction('pasteStyle')"
        >
          <Paintbrush class="menu-icon" />
          {{ t('draw.menu.pasteStyle') }}
          <span class="menu-shortcut">Ctrl+Alt+V</span>
        </button>

        <div class="menu-separator" />

        <!-- Layer submenu -->
        <div
          class="menu-item-sub"
          @mouseenter="expandedSub = 'layer'"
          @mouseleave="expandedSub = null"
        >
          <button class="menu-item w-full">
            <Layers class="menu-icon" />
            {{ t('draw.menu.layer') }}
            <ChevronRight class="ml-auto h-3.5 w-3.5" />
          </button>
          <div v-if="expandedSub === 'layer'" class="submenu">
            <button class="menu-item" @click="handleAction('bringToFront')">
              {{ t('draw.menu.bringToFront') }}
              <span class="menu-shortcut">Ctrl+Shift+]</span>
            </button>
            <button class="menu-item" @click="handleAction('bringForward')">
              {{ t('draw.menu.bringForward') }}
              <span class="menu-shortcut">Ctrl+]</span>
            </button>
            <button class="menu-item" @click="handleAction('sendBackward')">
              {{ t('draw.menu.sendBackward') }}
              <span class="menu-shortcut">Ctrl+[</span>
            </button>
            <button class="menu-item" @click="handleAction('sendToBack')">
              {{ t('draw.menu.sendToBack') }}
              <span class="menu-shortcut">Ctrl+Shift+[</span>
            </button>
          </div>
        </div>

        <!-- Flip submenu -->
        <div
          class="menu-item-sub"
          @mouseenter="expandedSub = 'flip'"
          @mouseleave="expandedSub = null"
        >
          <button class="menu-item w-full">
            <FlipHorizontal2 class="menu-icon" />
            {{ t('draw.menu.flip') }}
            <ChevronRight class="ml-auto h-3.5 w-3.5" />
          </button>
          <div v-if="expandedSub === 'flip'" class="submenu">
            <button class="menu-item" @click="handleAction('flipH')">
              <FlipHorizontal2 class="menu-icon" />
              {{ t('draw.menu.flipH') }}
            </button>
            <button class="menu-item" @click="handleAction('flipV')">
              <FlipVertical2 class="menu-icon" />
              {{ t('draw.menu.flipV') }}
            </button>
          </div>
        </div>

        <!-- Align submenu (multi-select only) -->
        <div
          v-if="isMultiSelect"
          class="menu-item-sub"
          @mouseenter="expandedSub = 'align'"
          @mouseleave="expandedSub = null"
        >
          <button class="menu-item w-full">
            <AlignLeft class="menu-icon" />
            {{ t('draw.menu.align') }}
            <ChevronRight class="ml-auto h-3.5 w-3.5" />
          </button>
          <div v-if="expandedSub === 'align'" class="submenu">
            <button class="menu-item" @click="handleAction('alignLeft')">
              {{ t('draw.menu.alignLeft') }}
            </button>
            <button class="menu-item" @click="handleAction('alignCenter')">
              {{ t('draw.menu.alignCenter') }}
            </button>
            <button class="menu-item" @click="handleAction('alignRight')">
              {{ t('draw.menu.alignRight') }}
            </button>
            <div class="menu-separator" />
            <button class="menu-item" @click="handleAction('alignTop')">
              {{ t('draw.menu.alignTop') }}
            </button>
            <button class="menu-item" @click="handleAction('alignMiddle')">
              {{ t('draw.menu.alignMiddle') }}
            </button>
            <button class="menu-item" @click="handleAction('alignBottom')">
              {{ t('draw.menu.alignBottom') }}
            </button>
            <div class="menu-separator" />
            <button class="menu-item" @click="handleAction('distributeH')">
              {{ t('draw.menu.distributeH') }}
            </button>
            <button class="menu-item" @click="handleAction('distributeV')">
              {{ t('draw.menu.distributeV') }}
            </button>
          </div>
        </div>

        <div class="menu-separator" />

        <!-- Group / Ungroup -->
        <button
          v-if="isMultiSelect"
          class="menu-item"
          @click="handleAction('group')"
        >
          <Group class="menu-icon" />
          {{ t('draw.menu.group') }}
          <span class="menu-shortcut">Ctrl+G</span>
        </button>
        <button
          v-if="hasGroup"
          class="menu-item"
          @click="handleAction('ungroup')"
        >
          <Ungroup class="menu-icon" />
          {{ t('draw.menu.ungroup') }}
          <span class="menu-shortcut">Ctrl+Shift+G</span>
        </button>

        <!-- Lock / Unlock -->
        <button
          v-if="!isLocked"
          class="menu-item"
          @click="handleAction('lock')"
        >
          <Lock class="menu-icon" />
          {{ t('draw.menu.lock') }}
          <span class="menu-shortcut">Ctrl+L</span>
        </button>
        <button
          v-if="isLocked"
          class="menu-item"
          @click="handleAction('unlock')"
        >
          <Unlock class="menu-icon" />
          {{ t('draw.menu.unlock') }}
        </button>

        <!-- Hyperlink -->
        <button class="menu-item" @click="handleAction('addLink')">
          <Link class="menu-icon" />
          {{ t('draw.menu.addLink') }}
          <span class="menu-shortcut">Ctrl+K</span>
        </button>

        <div class="menu-separator" />

        <button class="menu-item text-destructive" @click="handleAction('delete')">
          <Trash2 class="menu-icon" />
          {{ t('draw.menu.delete') }}
          <span class="menu-shortcut">Del</span>
        </button>
      </template>

      <!-- No selection (canvas context menu) -->
      <template v-else>
        <button class="menu-item" @click="handleAction('paste')">
          <Clipboard class="menu-icon" />
          {{ t('draw.menu.paste') }}
          <span class="menu-shortcut">Ctrl+V</span>
        </button>
        <button class="menu-item" @click="handleAction('selectAll')">
          {{ t('draw.menu.selectAll') }}
          <span class="menu-shortcut">Ctrl+A</span>
        </button>
        <div class="menu-separator" />
        <button class="menu-item" @click="handleAction('toggleGrid')">
          {{ t('draw.menu.toggleGrid') }}
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  text-align: left;
  cursor: pointer;
  border: none;
  background: none;
  font-size: 13px;
  white-space: nowrap;
}

.menu-item:hover {
  background-color: hsl(var(--accent));
}

.menu-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.menu-shortcut {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.5;
}

.menu-separator {
  height: 1px;
  margin: 4px 0;
  background-color: hsl(var(--border));
}

.menu-item-sub {
  position: relative;
}

.submenu {
  position: absolute;
  left: 100%;
  top: 0;
  min-width: 180px;
  border-radius: 8px;
  border: 1px solid hsl(var(--border));
  background-color: hsl(var(--popover));
  padding: 4px 0;
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
  z-index: 1;
}
</style>
