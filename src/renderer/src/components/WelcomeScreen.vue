<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderOpen, FilePlus, Library, FileText, Clock } from 'lucide-vue-next'
import ZqScrollbar from '@/components/ui/ZqScrollbar.vue'

import logoIcon from '@/assets/icon/icon.svg'

const emit = defineEmits<{
  'open-file': []
  'new-document': []
  'new-library': []
  'open-recent': [filePath: string]
}>()

const { t } = useI18n()
const recentFiles = ref<string[]>([])

async function refreshRecentList() {
  try {
    recentFiles.value = await window.electron.getRecentFiles()
  } catch {
    recentFiles.value = []
  }
}

let offRecentChanged: (() => void) | undefined

onMounted(async () => {
  await refreshRecentList()
  offRecentChanged = window.electron.onRecentFilesChanged(() => {
    void refreshRecentList()
  })
})

onUnmounted(() => {
  offRecentChanged?.()
})

function getFileName(fp: string): string {
  return fp.split('/').pop() || fp
}

function getFileDir(fp: string): string {
  const parts = fp.split('/')
  parts.pop()
  const dir = parts.join('/')
  const home = dir.replace(/^\/Users\/[^/]+/, '~')
  return home
}
</script>

<template>
  <div class="welcome-screen">
    <ZqScrollbar height="100%">
    <div class="welcome-content">
      <div class="welcome-logo">
        <img :src="logoIcon" class="logo-icon" width="56" height="56" alt="ZQ Mark" />
        <h1 class="welcome-title">ZQ Mark</h1>
      </div>

      <div class="welcome-main">
        <div class="welcome-actions">
          <button class="welcome-card" @click="emit('open-file')">
            <div class="card-icon">
              <FolderOpen :size="28" :stroke-width="1.5" />
            </div>
            <div class="card-text">
              <span class="card-label">{{ t('welcome.openFile') }}</span>
              <span class="card-desc">{{ t('welcome.openFileDesc') }}</span>
            </div>
          </button>

          <button class="welcome-card" @click="emit('new-document')">
            <div class="card-icon">
              <FilePlus :size="28" :stroke-width="1.5" />
            </div>
            <div class="card-text">
              <span class="card-label">{{ t('welcome.newDocument') }}</span>
              <span class="card-desc">{{ t('welcome.newDocumentDesc') }}</span>
            </div>
          </button>

          <button class="welcome-card" @click="emit('new-library')">
            <div class="card-icon">
              <Library :size="28" :stroke-width="1.5" />
            </div>
            <div class="card-text">
              <span class="card-label">{{ t('welcome.newLibrary') }}</span>
              <span class="card-desc">{{ t('welcome.newLibraryDesc') }}</span>
            </div>
          </button>
        </div>

        <div v-if="recentFiles.length > 0" class="recent-section">
          <div class="recent-header">
            <Clock :size="14" />
            <span>{{ t('welcome.recentProjects') }}</span>
          </div>
          <div class="recent-list">
            <ZqScrollbar height="250px">
              <button
                v-for="fp in recentFiles"
                :key="fp"
                class="recent-item"
                @click="emit('open-recent', fp)"
              >
                <FileText :size="16" class="recent-icon" />
                <div class="recent-info">
                  <span class="recent-name">{{ getFileName(fp) }}</span>
                  <span class="recent-path">{{ getFileDir(fp) }}</span>
                </div>
              </button>
            </ZqScrollbar>
          </div>
        </div>
      </div>
    </div>
    </ZqScrollbar>
  </div>
</template>

<style scoped>
.welcome-screen {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.welcome-screen :deep(.zq-scrollbar) {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.welcome-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100%;
  padding: 48px 24px 64px;
  box-sizing: border-box;
}

.welcome-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 40px;
}

.logo-icon {
  border-radius: 14px;
}

.welcome-title {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.welcome-main {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

.welcome-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 48px;
}

@media (max-width: 720px) {
  .welcome-main {
    max-width: 320px;
  }

  .welcome-actions {
    grid-template-columns: 1fr;
  }
}

.welcome-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 28px 20px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.welcome-card:hover {
  border-color: var(--accent-color);
  background: var(--bg-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.welcome-card:hover .card-icon {
  background: color-mix(in srgb, var(--accent-color) 12%, transparent);
  color: var(--accent-color);
}

.card-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.recent-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.recent-list {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  overflow: hidden;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.recent-item:hover {
  background: var(--bg-hover);
}

.recent-icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.recent-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.recent-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-path {
  font-size: 11px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
