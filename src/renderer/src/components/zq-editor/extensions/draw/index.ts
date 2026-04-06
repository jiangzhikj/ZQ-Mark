import { mergeAttributes, Node } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import DrawBlockComponent from './DrawBlockComponent.vue';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawBlock: {
      setDrawBlock: (attrs?: { data?: string }) => ReturnType;
    };
  }
}

export const DrawBlock = Node.create({
  name: 'drawBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      data: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-draw'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.data) return {};
          return { 'data-draw': attributes.data };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="draw"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        { 'data-type': 'draw', class: 'draw-block-node' },
        HTMLAttributes,
      ),
      ['div', { class: 'draw-block-placeholder' }, 'Drawing'],
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(DrawBlockComponent as any);
  },

  addCommands() {
    return {
      setDrawBlock:
        (attrs = {}) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});

export default DrawBlock;
