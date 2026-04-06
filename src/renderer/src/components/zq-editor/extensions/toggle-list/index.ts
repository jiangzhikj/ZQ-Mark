import { mergeAttributes, Node } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import ToggleComponent from './ToggleComponent.vue';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleBlock: {
      setToggleBlock: () => ReturnType;
    };
  }
}

export const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-open') !== 'false',
        renderHTML: (attributes) => ({
          'data-open': String(attributes.open),
        }),
      },
      summary: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-summary') || '',
        renderHTML: (attributes) => ({
          'data-summary': attributes.summary,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'toggle',
        class: 'toggle-block',
      }),
      0,
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(ToggleComponent as any);
  },

  addCommands() {
    return {
      setToggleBlock:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { open: true, summary: '' },
            content: [{ type: 'paragraph' }],
          });
        },
    };
  },
});

export default ToggleBlock;
