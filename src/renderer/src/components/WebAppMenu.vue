<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { dispatchWebMenuAction } from '@/platform/web-electron'
import { ZqScrollbar } from '@/components/ui'

const { t } = useI18n()

const visible = ref(false)
/** 汉堡按钮位置，用于像 Win/Linux 原生菜单一样在按钮下方弹出 */
const anchorRect = ref<DOMRect | null>(null)

const PANEL_MIN_WIDTH = 240
const PANEL_MAX_WIDTH = 300

const panelStyle = computed(() => {
  const margin = 4
  const r = anchorRect.value
  if (!r) {
    return {
      top: `calc(var(--titlebar-height, 40px) + ${margin}px)`,
      left: `${margin}px`,
      maxWidth: `${PANEL_MAX_WIDTH}px`
    }
  }
  let left = r.left
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600
  if (left + PANEL_MAX_WIDTH > vw - 8) {
    left = Math.max(8, vw - PANEL_MAX_WIDTH - 8)
  }
  let top = r.bottom + margin
  const estHeight = Math.min(vh * 0.72, 520)
  if (top + estHeight > vh - 8) {
    const above = r.top - estHeight - margin
    if (above >= 8) {
      top = above
    } else {
      top = Math.max(8, vh - estHeight - 8)
    }
  }
  return {
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${PANEL_MIN_WIDTH}px`,
    maxWidth: `${PANEL_MAX_WIDTH}px`
  }
})

function openMenu(e: Event) {
  const ce = e as CustomEvent<DOMRect | undefined>
  anchorRect.value = ce.detail ?? null
  visible.value = true
}

function close() {
  visible.value = false
  anchorRect.value = null
}

function run(action: string) {
  dispatchWebMenuAction(action)
  close()
}

function exec(cmd: string) {
  try {
    document.execCommand(cmd)
  } catch {
    /* ignore */
  }
  close()
}

function onFullscreen() {
  document.documentElement.requestFullscreen?.().catch(() => {})
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('web:app-menu-open', openMenu)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('web:app-menu-open', openMenu)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="web-menu-root"
        aria-hidden="false"
      >
        <!-- 轻量遮罩：点击关闭，不盖住标题栏区域的高对比度块 -->
        <div class="web-menu-dismiss" @click="close" />
        <div
          class="web-menu-panel"
          :style="panelStyle"
          @click.stop
        >
          <ZqScrollbar class="web-menu-scroll" height="min(72vh, 520px)" role="menu">
          <!-- 与 Electron Win/Linux 弹出菜单一致：无「文件」大标题，仅用分隔线分组 -->
          <button type="button" class="web-menu-item" @click="run('file:new')">
            {{ t('menu.file.new') }}
          </button>
          <button type="button" class="web-menu-item" @click="run('file:newLibrary')">
            {{ t('menu.file.newLibrary') }}
          </button>
          <button type="button" class="web-menu-item" @click="run('file:open')">
            {{ t('menu.file.open') }}
          </button>
          <button type="button" class="web-menu-item" @click="run('file:save')">
            {{ t('menu.file.save') }}
          </button>

          <div class="web-menu-subgroup">
            <span class="web-menu-subgroup-label">{{ t('menu.file.saveAs') }}</span>
            <button type="button" class="web-menu-item web-menu-item--sub" @click="run('file:saveAsZq')">
              {{ t('menu.file.saveAsZq') }}
            </button>
            <button type="button" class="web-menu-item web-menu-item--sub" @click="run('file:saveAsMd')">
              {{ t('menu.file.saveAsMd') }}
            </button>
          </div>

          <hr class="web-menu-sep" />

          <div class="web-menu-subgroup">
            <span class="web-menu-subgroup-label">{{ t('menu.file.export') }}</span>
            <button type="button" class="web-menu-item web-menu-item--sub" @click="run('export:pdf')">
              {{ t('menu.file.exportPDF') }}
            </button>
            <button type="button" class="web-menu-item web-menu-item--sub" @click="run('export:html')">
              {{ t('menu.file.exportHTML') }}
            </button>
            <button type="button" class="web-menu-item web-menu-item--sub" @click="run('export:word')">
              {{ t('menu.file.exportWord') }}
            </button>
            <button type="button" class="web-menu-item web-menu-item--sub" @click="run('export:image')">
              {{ t('menu.file.exportImage') }}
            </button>
          </div>

          <hr class="web-menu-sep" />

          <button type="button" class="web-menu-item" @click="exec('undo')">
            {{ t('menu.edit.undo') }}
          </button>
          <button type="button" class="web-menu-item" @click="exec('redo')">
            {{ t('menu.edit.redo') }}
          </button>
          <button type="button" class="web-menu-item" @click="exec('cut')">
            {{ t('menu.edit.cut') }}
          </button>
          <button type="button" class="web-menu-item" @click="exec('copy')">
            {{ t('menu.edit.copy') }}
          </button>
          <button type="button" class="web-menu-item" @click="exec('paste')">
            {{ t('menu.edit.paste') }}
          </button>
          <button type="button" class="web-menu-item" @click="exec('selectAll')">
            {{ t('menu.edit.selectAll') }}
          </button>
          <button type="button" class="web-menu-item" @click="run('edit:find')">
            {{ t('menu.edit.find') }}
          </button>
          <button type="button" class="web-menu-item" @click="run('edit:replace')">
            {{ t('menu.edit.replace') }}
          </button>

          <hr class="web-menu-sep" />

          <button type="button" class="web-menu-item" @click="run('view:toggleSidebar')">
            {{ t('menu.view.toggleSidebar') }}
          </button>
          <button type="button" class="web-menu-item" @click="run('view:sourceCode')">
            {{ t('menu.view.sourceCode') }}
          </button>
          <button type="button" class="web-menu-item" @click="onFullscreen">
            {{ t('menu.view.fullscreen') }}
          </button>

          <hr class="web-menu-sep" />

          <button type="button" class="web-menu-item web-menu-item--accent" @click="run('app:preferences')">
            {{ t('menu.app.preferences') }}
          </button>

          <hr class="web-menu-sep" />

          <a
            class="web-menu-item web-menu-item--link"
            href="https://www.markdownguide.org/basic-syntax/"
            target="_blank"
            rel="noopener noreferrer"
            @click="close"
          >
            {{ t('menu.help.markdownReference') }}
          </a>
          <button type="button" class="web-menu-item" @click="run('help:about')">
            {{ t('menu.help.about') }}
          </button>
          </ZqScrollbar>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.web-menu-root {
  position: fixed;
  inset: 0;
  z-index: 10050;
  pointer-events: none;
}

/* 透明点击层：用于点击外部关闭，无背景变暗 */
.web-menu-dismiss {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  background: transparent;
  cursor: default;
}

.web-menu-panel {
  position: fixed;
  z-index: 10051;
  pointer-events: auto;
  padding: 4px 0;
  /* 使用全局主题变量（--bg-elevated/--bg-primary 未定义会导致整块透明） */
  background: var(--bg-editor);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.08),
    0 10px 24px -4px rgba(0, 0, 0, 0.15);
}

.web-menu-scroll {
  width: 100%;
  min-height: 0;
}

.web-menu-sep {
  border: none;
  height: 1px;
  margin: 4px 8px;
  background: var(--border-subtle, var(--border-color));
  opacity: 0.85;
}

.web-menu-subgroup {
  padding: 2px 0 4px;
}

.web-menu-subgroup-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  padding: 6px 12px 2px 14px;
  letter-spacing: 0.02em;
}

.web-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  font-size: 13px;
  line-height: 1.35;
  color: var(--text-primary);
  padding: 6px 14px;
  cursor: pointer;
  transition: background 0.08s;
}

.web-menu-item:hover {
  background: var(--bg-hover);
}

.web-menu-item--sub {
  padding-left: 22px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.web-menu-item--link {
  text-decoration: none;
}

.web-menu-item--accent {
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.12s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
