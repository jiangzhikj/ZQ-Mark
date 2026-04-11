import { mergeAttributes, Node } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import ExcalidrawBlockComponent from './ExcalidrawBlockComponent.vue';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    excalidrawBlock: {
      setExcalidrawBlock: (attrs?: {
        scene?: string | null;
        preview?: string | null;
      }) => ReturnType;
    };
  }
}

export const ExcalidrawBlock = Node.create({
  name: 'excalidrawBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      /** JSON：{ elements, appState } */
      scene: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-excalidraw-scene'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.scene || typeof attributes.scene !== 'string') return {};
          return { 'data-excalidraw-scene': attributes.scene };
        },
      },
      preview: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="excalidraw"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const preview = node.attrs.preview;
    const hasPreview = typeof preview === 'string' && preview.length > 0;

    if (hasPreview) {
      return [
        'div',
        mergeAttributes(
          { 'data-type': 'excalidraw', class: 'excalidraw-block-node' },
          HTMLAttributes,
        ),
        ['img', { src: preview, alt: 'Excalidraw', style: 'max-width: 100%; height: auto;' }],
      ];
    }

    return [
      'div',
      mergeAttributes(
        { 'data-type': 'excalidraw', class: 'excalidraw-block-node' },
        HTMLAttributes,
      ),
      ['div', { class: 'excalidraw-block-placeholder' }, 'Excalidraw'],
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(ExcalidrawBlockComponent as any);
  },

  addCommands() {
    return {
      setExcalidrawBlock:
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

export default ExcalidrawBlock;
