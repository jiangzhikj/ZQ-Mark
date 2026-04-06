import { Node } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import TocComponent from './TocComponent.vue';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableOfContents: {
      setTableOfContents: () => ReturnType;
    };
  }
}

export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="toc"]' }];
  },

  renderHTML() {
    return ['div', { 'data-type': 'toc', class: 'toc-block' }];
  },

  addNodeView() {
    return VueNodeViewRenderer(TocComponent as any);
  },

  addCommands() {
    return {
      setTableOfContents:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
          });
        },
    };
  },
});

export default TableOfContents;
