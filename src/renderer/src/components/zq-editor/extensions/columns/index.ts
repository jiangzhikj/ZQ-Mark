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

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { $anchor } = this.editor.state.selection;
        // 必须在 columnBlock 内
        if ($anchor.parent.type.name !== 'columnBlock') return false;
        // 光标必须在开头位置（pos 0）
        if ($anchor.parentOffset !== 0) return false;
        // 必须是 columnsBlock 的第一个子节点
        const colsNode = $anchor.node($anchor.depth - 1);
        if (colsNode?.type.name !== 'columnsBlock') return false;
        if (colsNode.firstChild !== $anchor.parent) return false;
        // 删除整个 columnsBlock
        const colsPos = $anchor.before($anchor.depth - 1);
        const tr = this.editor.state.tr.delete(colsPos, colsPos + colsNode.nodeSize);
        this.editor.view.dispatch(tr);
        return true;
      },
    };
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
