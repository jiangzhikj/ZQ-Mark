import Image from '@tiptap/extension-image';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import ImageComponent from './ImageComponent.vue';

export interface ImageBlockAttributes {
  src: string;
  alt?: string;
  title?: string;
  width?: number | null;
  height?: number | null;
  alignment?: 'center' | 'left' | 'right';
  caption?: string;
  fileId?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      setImageBlock: (attrs: ImageBlockAttributes) => ReturnType;
    };
  }
}

export const ImageBlock = Image.extend({
  name: 'imageBlock',

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('width') ||
          element.style.width?.replace('px', '') ||
          null,
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('height') ||
          element.style.height?.replace('px', '') ||
          null,
        renderHTML: (attributes) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
      alignment: {
        default: 'center',
        parseHTML: (element) => element.dataset.alignment || 'center',
        renderHTML: (attributes) => {
          const alignment = attributes.alignment || 'center';
          const styleMap: Record<string, string> = {
            left: 'display: block; margin-left: 0; margin-right: auto;',
            center: 'display: block; margin-left: auto; margin-right: auto;',
            right: 'display: block; margin-left: auto; margin-right: 0;',
          };
          return {
            'data-alignment': alignment,
            style: styleMap[alignment] || styleMap.center,
          };
        },
      },
      caption: {
        default: '',
        parseHTML: (element) => element.dataset.caption || '',
        renderHTML: (attributes) => {
          if (!attributes.caption) return {};
          return { 'data-caption': attributes.caption };
        },
      },
      fileId: {
        default: null,
        parseHTML: (element) => element.dataset.fileId || null,
        renderHTML: (attributes) => {
          if (!attributes.fileId) return {};
          return { 'data-file-id': attributes.fileId };
        },
      },
    };
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageComponent as any);
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageBlock:
        (attrs: ImageBlockAttributes) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});

export default ImageBlock;
