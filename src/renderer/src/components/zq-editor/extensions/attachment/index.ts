import { mergeAttributes, Node } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import AttachmentComponent from './AttachmentComponent.vue';

export interface AttachmentBlockAttributes {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachmentBlock: {
      setAttachmentBlock: (options: AttachmentBlockAttributes) => ReturnType;
    };
  }
}

export const AttachmentBlock = Node.create({
  name: 'attachmentBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-id'),
      },
      name: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-name'),
      },
      size: {
        default: 0,
        parseHTML: (el: HTMLElement) => {
          const val = el.getAttribute('data-size');
          return val ? Number(val) : 0;
        },
      },
      type: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-file-type'),
      },
      url: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-url'),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="attachment"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { id, name, size, type, url } = HTMLAttributes;
    return [
      'div',
      mergeAttributes({
        'data-type': 'attachment',
        'data-id': id,
        'data-name': name,
        'data-size': size,
        'data-file-type': type,
        'data-url': url,
        class: 'attachment-node',
      }),
      [
        'a',
        { href: url, target: '_blank', download: name, class: 'attachment-link' },
        ['span', { class: 'attachment-name' }, name || ''],
        ['span', { class: 'attachment-size' }, formatFileSize(size)],
      ],
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(AttachmentComponent as any);
  },

  addCommands() {
    return {
      setAttachmentBlock:
        (options: AttachmentBlockAttributes) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});

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

export { formatFileSize };
export default AttachmentBlock;
