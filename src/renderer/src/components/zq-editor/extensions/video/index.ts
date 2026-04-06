import { mergeAttributes, Node } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import VideoComponent from './VideoComponent.vue';

export interface VideoBlockAttributes {
  src: string;
  id?: string;
  width?: number | string;
  height?: number | string;
  alignment?: 'center' | 'left' | 'right';
  poster?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoBlock: {
      setVideoBlock: (options: VideoBlockAttributes) => ReturnType;
    };
  }
}

export const VideoBlock = Node.create({
  name: 'videoBlock',
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
          const video = el.querySelector('video');
          return video?.getAttribute('src') || null;
        },
      },
      width: { default: '100%' },
      height: { default: 'auto' },
      alignment: { default: 'center' },
      poster: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const video = el.querySelector('video');
          return video?.getAttribute('poster') || null;
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="video"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { id, src, width, poster, alignment } = HTMLAttributes;
    let marginStyle = 'margin-left: auto; margin-right: auto;';
    if (alignment === 'left') marginStyle = 'margin-right: auto;';
    else if (alignment === 'right') marginStyle = 'margin-left: auto;';

    return [
      'div',
      mergeAttributes({
        'data-type': 'video',
        'data-id': id,
        class: 'video-node',
        style: `max-width: ${typeof width === 'number' ? `${width}px` : width}; ${marginStyle}`,
      }),
      [
        'video',
        {
          src,
          controls: true,
          poster,
          style: 'width: 100%; height: auto; border-radius: 8px;',
        },
      ],
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(VideoComponent as any);
  },

  addCommands() {
    return {
      setVideoBlock:
        (options: VideoBlockAttributes) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});

export default VideoBlock;
