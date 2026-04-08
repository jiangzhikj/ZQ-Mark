import { mergeAttributes, Node } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import DrawioBlockComponent from './DrawioBlockComponent.vue';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawioBlock: {
      setDrawioBlock: (attrs?: { xml?: string; preview?: string | null }) => ReturnType;
    };
  }
}

export const DrawioBlock = Node.create({
  name: 'drawioBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      xml: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-drawio-xml'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.xml || typeof attributes.xml !== 'string') return {};
          return { 'data-drawio-xml': attributes.xml };
        },
      },
      /** data:image/svg+xml Data URL，仅存文档 JSON，不写进 HTML 导出 */
      preview: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="drawio"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        { 'data-type': 'drawio', class: 'drawio-block-node' },
        HTMLAttributes,
      ),
      ['div', { class: 'drawio-block-placeholder' }, 'Diagram'],
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(DrawioBlockComponent as any);
  },

  addCommands() {
    return {
      setDrawioBlock:
        (attrs = {}) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});

export default DrawioBlock;
