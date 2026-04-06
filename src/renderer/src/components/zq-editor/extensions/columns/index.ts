import { mergeAttributes, Node } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import ColumnsComponent from './ColumnsComponent.vue';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (attrs?: { count?: number }) => ReturnType;
    };
  }
}

export const ColumnBlock = Node.create({
  name: 'columnBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'column',
        class: 'column-block',
      }),
      0,
    ];
  },
});

export const ColumnsBlock = Node.create({
  name: 'columnsBlock',
  group: 'block',
  content: 'columnBlock{2,4}',
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (element) =>
          Number.parseInt(element.getAttribute('data-columns') || '2', 10),
        renderHTML: (attributes) => ({
          'data-columns': attributes.count,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'columns',
        class: 'columns-block',
      }),
      0,
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(ColumnsComponent as any);
  },

  addCommands() {
    return {
      setColumns:
        (attrs) =>
        ({ commands }) => {
          const count = attrs?.count || 2;
          const columns = Array.from({ length: count }, () => ({
            type: 'columnBlock',
            content: [{ type: 'paragraph' }],
          }));
          return commands.insertContent({
            type: this.name,
            attrs: { count },
            content: columns,
          });
        },
    };
  },
});

export default ColumnsBlock;
