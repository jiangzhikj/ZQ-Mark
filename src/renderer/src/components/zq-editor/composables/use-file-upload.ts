import type { Editor } from '@tiptap/vue-3';

import type { FileUploadOptions } from '../types';

import { $t } from '../utils/i18n';
import { ZqMessage } from '@/components/ui';
import { normalizeMdAssetSettings, mdAssetStoredSrc } from '../../../../../shared/markdown-assets';

const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];
const VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
];
const AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
  'audio/webm',
  'audio/x-m4a',
  'audio/m4a',
];
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024;

export function useFileUpload(
  editor: () => Editor | undefined,
  _options?: FileUploadOptions,
) {
  const maxSize = _options?.maxSize || DEFAULT_MAX_SIZE;

  async function saveFileLocally(file: File) {
    const buffer = await file.arrayBuffer();
    const docPath = _options?.getDocPath?.() ?? null;
    const isMd = _options?.isMdDocument?.() ?? true;

    if (docPath && isMd) {
      const settings = await window.electron.getSettings();
      const assetSettings = normalizeMdAssetSettings(settings);
      if (assetSettings.mdAssetMode === 'relative' && window.electron.saveMdAsset) {
        const result = await window.electron.saveMdAsset({
          buffer,
          fileName: file.name,
          docPath,
          settings: assetSettings,
        });
        if (result) return result;
      }
    }

    return window.electron.saveDroppedFile(buffer, file.name);
  }

  async function handleFile(file: File): Promise<void> {
    const e = editor();
    if (!e) return;

    if (file.size > maxSize) {
      ZqMessage.warning($t('zq-editor.upload.fileSizeExceeds'));
      return;
    }

    if (IMAGE_TYPES.includes(file.type)) {
      await uploadImage(e, file);
    } else if (VIDEO_TYPES.includes(file.type)) {
      await uploadVideo(e, file);
    } else if (AUDIO_TYPES.includes(file.type)) {
      await uploadAudio(e, file);
    } else {
      await uploadAttachment(e, file);
    }
  }

  async function uploadImage(e: Editor, file: File) {
    try {
      const result = await saveFileLocally(file);
      const src = mdAssetStoredSrc(result);
      e.chain().focus().setImageBlock({ src, fileId: result.id }).run();
    } catch {
      ZqMessage.error($t('zq-editor.upload.imageUploadFailed'));
    }
  }

  async function uploadVideo(e: Editor, file: File) {
    try {
      const result = await saveFileLocally(file);
      const src = mdAssetStoredSrc(result);
      e.chain().focus().setVideoBlock({ src, id: result.id }).run();
    } catch {
      ZqMessage.error($t('zq-editor.upload.videoUploadFailed'));
    }
  }

  async function uploadAudio(e: Editor, file: File) {
    try {
      const result = await saveFileLocally(file);
      const src = mdAssetStoredSrc(result);
      e.chain().focus().setAudioBlock({ src, id: result.id }).run();
    } catch {
      ZqMessage.error($t('zq-editor.upload.audioUploadFailed'));
    }
  }

  async function uploadAttachment(e: Editor, file: File) {
    try {
      const result = await saveFileLocally(file);
      e.chain().focus().setAttachmentBlock({
        id: result.id,
        name: file.name,
        size: file.size,
        type: file.type,
        url: mdAssetStoredSrc(result),
      }).run();
    } catch {
      ZqMessage.error($t('zq-editor.upload.attachmentUploadFailed'));
    }
  }

  function handleDrop(event: DragEvent) {
    const files = event.dataTransfer?.files;
    if (!files?.length) return;

    event.preventDefault();
    const fileArray = Array.from(files);
    (async () => {
      for (const file of fileArray) {
        await handleFile(file);
      }
    })();
  }

  function handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          handleFile(file);
          return;
        }
      }
    }
  }

  return {
    handleFile,
    handleDrop,
    handlePaste,
    saveFileLocally,
  };
}
