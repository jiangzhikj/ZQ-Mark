<script setup lang="ts">
import { computed } from 'vue';

import {
  Download,
  ExternalLink,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  File as GenericFile,
  Trash2,
} from '@/components/icons';
import { ZqMessage } from '@/components/ui';
import { $t } from '../../utils/i18n';

import { NodeViewWrapper } from '@tiptap/vue-3';

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

const props = defineProps<{
  deleteNode: () => void;
  node: any;
  selected: boolean;
}>();

const name = computed(() => props.node.attrs.name || $t('zq-editor.attachment.untitled'));
const size = computed(() => formatFileSize(props.node.attrs.size || 0));
const fileType = computed(() => props.node.attrs.type || '');

const resolvedUrl = computed(() => props.node.attrs.url || '');

const extFromName = computed(() => {
  const n = name.value;
  const i = n.lastIndexOf('.');
  return i >= 0 ? n.slice(i + 1).toLowerCase() : '';
});

const fileIconMap: Record<string, any> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  pdf: FileText,
  doc: FileText,
  xls: FileSpreadsheet,
  zip: FileArchive,
  code: FileCode,
};

const fileIcon = computed(() => {
  const t = fileType.value.toLowerCase();
  if (t.startsWith('image')) return fileIconMap.image;
  if (t.startsWith('video')) return fileIconMap.video;
  if (t.startsWith('audio')) return fileIconMap.audio;
  if (t.includes('pdf')) return fileIconMap.pdf;
  if (t.includes('doc') || t.includes('word')) return fileIconMap.doc;
  if (t.includes('xls') || t.includes('sheet')) return fileIconMap.xls;
  if (t.includes('zip') || t.includes('rar') || t.includes('7z')) return fileIconMap.zip;

  const ex = extFromName.value;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ex))
    return fileIconMap.image;
  if (['mp4', 'webm', 'mov', 'm4v', 'ogv', 'mkv'].includes(ex)) return fileIconMap.video;
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'].includes(ex))
    return fileIconMap.audio;
  if (ex === 'pdf') return fileIconMap.pdf;
  if (['doc', 'docx', 'odt', 'rtf'].includes(ex)) return fileIconMap.doc;
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ex)) return fileIconMap.xls;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz'].includes(ex)) return fileIconMap.zip;
  if (
    ['js', 'ts', 'tsx', 'jsx', 'vue', 'py', 'json', 'html', 'css', 'md', 'c', 'cpp', 'h', 'rs', 'go'].includes(ex)
  )
    return fileIconMap.code;
  return GenericFile;
});

async function handleDownload() {
  const url = resolvedUrl.value;
  const fileName = name.value;
  if (!url) return;

  if (url.startsWith('blob:') || url.startsWith('data:')) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.click();
    return;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = fileName;
    a.rel = 'noopener';
    a.click();
    URL.revokeObjectURL(objUrl);
  } catch {
    // fetch 失败时不再调用 window.open（非法 URL 会抛 SyntaxError）
  }
}

async function handleOpen() {
  const url = resolvedUrl.value;
  if (!url) return;

  try {
    const api = window.electron?.openAssetUrl;
    if (api) {
      const r = await api(url);
      if (r?.ok) return;
      ZqMessage.warning($t('zq-editor.attachment.openFailed'));
      return;
    }
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    ZqMessage.warning($t('zq-editor.attachment.openFailed'));
  } catch {
    ZqMessage.error($t('zq-editor.attachment.openFailed'));
  }
}
</script>

<template>
  <NodeViewWrapper
    class="zq-attachment"
    :class="{ 'is-selected': selected }"
    data-type="attachment"
  >
    <div class="zq-attachment__body" contenteditable="false">
      <div class="zq-attachment__main" @dblclick="handleOpen">
        <div class="zq-attachment__icon">
          <component :is="fileIcon" class="h-5 w-5" />
        </div>
        <div class="zq-attachment__info">
          <span class="zq-attachment__name">{{ name }}</span>
          <span class="zq-attachment__size">{{ size }}</span>
        </div>
      </div>
      <div class="zq-attachment__actions">
        <button
          type="button"
          class="zq-attachment__btn"
          :title="$t('zq-editor.attachment.open')"
          @click="handleOpen"
        >
          <ExternalLink class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="zq-attachment__btn"
          :title="$t('zq-editor.attachment.download')"
          @click="handleDownload"
        >
          <Download class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="zq-attachment__btn zq-attachment__btn--danger"
          :title="$t('zq-editor.attachment.delete')"
          @click="deleteNode"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </div>
    </div>
  </NodeViewWrapper>
</template>

<style scoped>
.zq-attachment {
  margin: 0.5rem 0;
}

.zq-attachment__body {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  transition: all 0.15s;
}

.zq-attachment.is-selected .zq-attachment__body {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5);
}

.zq-attachment__body:hover {
  background: var(--el-fill-color-light);
}

.zq-attachment__main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.zq-attachment__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.zq-attachment__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.zq-attachment__name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zq-attachment__size {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}

.zq-attachment__actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.zq-attachment__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.zq-attachment__btn:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.zq-attachment__btn--danger:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
</style>
