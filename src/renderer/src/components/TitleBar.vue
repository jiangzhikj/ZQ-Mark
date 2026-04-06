<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  fileName: string
  isModified: boolean
  sidebarVisible: boolean
}>()

const emit = defineEmits<{
  toggleSidebar: []
}>()

const { t } = useI18n()

const platform = ref('darwin')
const isMaximized = ref(false)
const isMac = ref(true)

let cleanupMaximize: (() => void) | null = null

onMounted(async () => {
  platform.value = await window.electron.getPlatform()
  isMac.value = platform.value === 'darwin'

  if (!isMac.value) {
    isMaximized.value = await window.electron.windowIsMaximized()
    cleanupMaximize = window.electron.onMaximizeChange((val) => {
      isMaximized.value = val
    })
  }
})

onUnmounted(() => {
  cleanupMaximize?.()
})

function onMenuClick() {
  window.electron.popupMenu()
}

function onMinimize() {
  window.electron.windowMinimize()
}

function onMaximizeToggle() {
  window.electron.windowMaximizeToggle()
}

function onClose() {
  window.electron.windowClose()
}
</script>

<template>
  <header class="titlebar" :class="{ 'titlebar--win': !isMac }">
    <!-- Win/Linux: hamburger menu button on left -->
    <div v-if="!isMac" class="titlebar-left">
      <button class="menu-btn" :title="t('titlebar.menu')" @click="onMenuClick">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <div class="titlebar-center">
      <span class="file-name">{{ fileName || t('editor.untitled') }}</span>
      <span v-if="isModified" class="modified-indicator">&mdash; {{ t('status.modified') }}</span>
    </div>

    <!-- Win/Linux: window control buttons on right -->
    <div v-if="!isMac" class="window-controls">
      <button class="win-btn win-btn--minimize" :title="t('titlebar.minimize')" @click="onMinimize">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 5h8" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
      <button class="win-btn win-btn--maximize" :title="t('titlebar.maximize')" @click="onMaximizeToggle">
        <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
          <rect x="1" y="1" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.2" fill="none" />
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10">
          <path d="M3 1h5a1 1 0 0 1 1 1v5M1 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.1" fill="none" />
        </svg>
      </button>
      <button class="win-btn win-btn--close" :title="t('titlebar.close')" @click="onClose">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- macOS: empty right slot to balance layout -->
    <div v-else class="titlebar-right" />
  </header>
</template>

<style scoped>
.titlebar {
  height: var(--titlebar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  -webkit-app-region: drag;
  user-select: none;
  backdrop-filter: blur(20px);
  flex-shrink: 0;
  position: relative;
}

.titlebar--win {
  padding: 0 0 0 4px;
}

.titlebar-left {
  display: flex;
  align-items: center;
  min-width: 40px;
  z-index: 1;
}

.titlebar-center {
  display: flex;
  align-items: center;
  gap: 6px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.modified-indicator {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 400;
}

.titlebar-right {
  min-width: 40px;
}

/* ─── Hamburger menu button (Win/Linux) ─── */
.menu-btn {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.menu-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* ─── Window control buttons (Win/Linux) ─── */
.window-controls {
  display: flex;
  align-items: stretch;
  height: 100%;
  z-index: 1;
  -webkit-app-region: no-drag;
}

.win-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.win-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.win-btn--close:hover {
  background: #e81123;
  color: #ffffff;
}
</style>
