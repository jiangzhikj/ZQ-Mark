import { mergeAttributes, Node } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import WisemappingBlockComponent from './WisemappingBlockComponent.vue';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wisemappingBlock: {
      setWisemappingBlock: (attrs?: {
        mapXml?: string | null;
        preview?: string | null;
      }) => ReturnType;
    };
  }
}

export const WisemappingBlock = Node.create({
  name: 'wisemappingBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      /** WiseMapping .wxml / map XML */
      mapXml: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-wisemapping-xml'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.mapXml || typeof attributes.mapXml !== 'string') return {};
          return { 'data-wisemapping-xml': attributes.mapXml };
        },
      },
      preview: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="wisemapping"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const preview = node.attrs.preview;
    const hasPreview = typeof preview === 'string' && preview.length > 0;

    if (hasPreview) {
      return [
        'div',
        mergeAttributes(
          { 'data-type': 'wisemapping', class: 'wisemapping-block-node' },
          HTMLAttributes,
        ),
        ['img', { src: preview, alt: 'WiseMapping', style: 'max-width: 100%; height: auto;' }],
      ];
    }

    return [
      'div',
      mergeAttributes(
        { 'data-type': 'wisemapping', class: 'wisemapping-block-node' },
        HTMLAttributes,
      ),
      ['div', { class: 'wisemapping-block-placeholder' }, 'WiseMapping'],
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(WisemappingBlockComponent as any);
  },

  addCommands() {
    return {
      setWisemappingBlock:
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

export default WisemappingBlock;
