<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Menu, Minus, Square, SquareStack, X } from '@/components/icons'

const props = withDefaults(
  defineProps<{
    fileName: string
    isModified: boolean
    sidebarVisible: boolean
    /** 为 true 且 fileName 为空时，中间不显示「未命名」（如欢迎页） */
    hideDefaultTitle?: boolean
  }>(),
  { hideDefaultTitle: false }
)

const emit = defineEmits<{
  toggleSidebar: []
}>()

const { t } = useI18n()

const centerTitle = computed(() => {
  if (props.hideDefaultTitle && !props.fileName) return ''
  return props.fileName || t('editor.untitled')
})

const platform = ref('darwin')
const isMaximized = ref(false)
const isMac = ref(true)
const isWeb = ref(false)
const menuBtnRef = ref<HTMLButtonElement | null>(null)

let cleanupMaximize: (() => void) | null = null

onMounted(async () => {
  platform.value = await window.electron.getPlatform()
  isMac.value = platform.value === 'darwin'
  isWeb.value = platform.value === 'web'

  if (!isMac.value && !isWeb.value) {
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
  if (platform.value === 'web') {
    const el = menuBtnRef.value
    const rect = el?.getBoundingClientRect()
    window.dispatchEvent(new CustomEvent('web:app-menu-open', { detail: rect }))
    return
  }
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
    <!-- Win/Linux/Web: hamburger menu on left -->
    <div v-if="!isMac" class="titlebar-left">
      <button
        ref="menuBtnRef"
        class="menu-btn"
        type="button"
        :title="t('titlebar.menu')"
        @click="onMenuClick"
      >
        <Menu :size="16" :stroke-width="1.4" />
      </button>
    </div>
    <!-- macOS: traffic-light placeholder on left -->
    <div v-else class="titlebar-left titlebar-left--mac" />

    <div class="titlebar-center">
      <span class="file-name">{{ centerTitle }}</span>
      <span v-if="isModified" class="modified-indicator">&mdash; {{ t('status.modified') }}</span>
    </div>

    <!-- Win/Linux: window control buttons on right -->
    <div v-if="!isMac && !isWeb" class="window-controls">
      <button class="win-btn win-btn--minimize" :title="t('titlebar.minimize')" @click="onMinimize">
        <Minus :size="10" :stroke-width="1.2" />
      </button>
      <button class="win-btn win-btn--maximize" :title="t('titlebar.maximize')" @click="onMaximizeToggle">
        <Square v-if="!isMaximized" :size="10" :stroke-width="1.2" />
        <SquareStack v-else :size="10" :stroke-width="1.1" />
      </button>
      <button class="win-btn win-btn--close" :title="t('titlebar.close')" @click="onClose">
        <X :size="10" :stroke-width="1.2" />
      </button>
    </div>

    <!-- macOS: hamburger menu on right -->
    <div v-else-if="isMac" class="titlebar-right">
      <button
        ref="menuBtnRef"
        class="menu-btn"
        type="button"
        :title="t('titlebar.menu')"
        @click="onMenuClick"
      >
        <Menu :size="16" :stroke-width="1.4" />
      </button>
    </div>

    <!-- Web: empty right slot -->
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

.titlebar-left--mac {
  margin-left: 68px;
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 40px;
  z-index: 1;
}

/* ─── Hamburger menu button (Win/Linux) ─── */
.menu-btn {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
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
