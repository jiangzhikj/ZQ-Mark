import { mergeAttributes, Node } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import AudioComponent from './AudioComponent.vue';

export interface AudioBlockAttributes {
  src: string;
  id?: string;
  width?: number | string;
  alignment?: 'center' | 'left' | 'right';
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    audioBlock: {
      setAudioBlock: (options: AudioBlockAttributes) => ReturnType;
    };
  }
}

export const AudioBlock = Node.create({
  name: 'audioBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-id'),
      },
      src: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const audio = el.querySelector('audio');
          return audio?.getAttribute('src') || null;
        },
      },
      alignment: { default: 'center' },
      width: {
        default: 480,
        parseHTML: (el: HTMLElement) => {
          const raw = el.getAttribute('data-width');
          if (raw) {
            const n = Number(raw);
            return Number.isFinite(n) ? n : 480;
          }
          return 480;
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="audio"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { id, src, alignment, width } = HTMLAttributes;
    let marginStyle = 'margin-left: auto; margin-right: auto;';
    if (alignment === 'left') marginStyle = 'margin-right: auto;';
    else if (alignment === 'right') marginStyle = 'margin-left: auto;';

    const w =
      typeof width === 'number' && Number.isFinite(width)
        ? width
        : typeof width === 'string'
          ? Number.parseFloat(width) || 480
          : 480;
    const wPx = `${w}px`;

    return [
      'div',
      mergeAttributes({
        'data-type': 'audio',
        'data-id': id,
        'data-width': w,
        class: 'audio-node',
        style: `width: ${wPx}; max-width: 100%; box-sizing: border-box; ${marginStyle}`,
      }),
      [
        'audio',
        {
          src,
          controls: true,
          preload: 'metadata',
          style: `width: 100%; border-radius: 8px;`,
        },
      ],
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(AudioComponent as any);
  },

  addCommands() {
    return {
      setAudioBlock:
        (options: AudioBlockAttributes) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});

export default AudioBlock;
