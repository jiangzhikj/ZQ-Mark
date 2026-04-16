import { mergeAttributes } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import HeadingComponent from './HeadingComponent.vue';

export const headingFoldPluginKey = new PluginKey('zqHeadingFold');

function createHeadingFoldPlugin(headingTypeName: string) {
  return new Plugin({
    key: headingFoldPluginKey,
    props: {
      decorations(state) {
        const { doc } = state;
        const list: Decoration[] = [];

        doc.descendants((node, pos) => {
          if (node.type.name !== headingTypeName || !node.attrs.collapsed) {
            return true;
          }

          const level = node.attrs.level as number;
          const $h = doc.resolve(pos);
          const depth = $h.depth;
          const parentEnd = $h.end(depth);
          let p = pos + node.nodeSize;

          while (p < parentEnd) {
            const n = doc.nodeAt(p);
            if (!n) break;
            if (n.type.name === headingTypeName && n.attrs.level <= level) {
              break;
            }
            list.push(
              Decoration.node(p, p + n.nodeSize, {
                class: 'zq-heading-fold--hidden',
              }),
            );
            p += n.nodeSize;
          }

          return true;
        });

        return DecorationSet.create(doc, list);
      },
    },
  });
}

export const ZqHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-collapsed') === 'true',
        renderHTML: (attributes) => {
          if (!attributes.collapsed) return {};
          return { 'data-collapsed': 'true' };
        },
      },
    };
  },

  parseHTML() {
    return this.options.levels.map((level) => ({
      tag: `h${level}`,
      getAttrs: (element: HTMLElement) => ({
        level,
        collapsed: element.getAttribute('data-collapsed') === 'true',
      }),
    }));
  },

  renderHTML({ node, HTMLAttributes }) {
    const hasLevel = this.options.levels.includes(node.attrs.level);
    const level = hasLevel ? node.attrs.level : this.options.levels[0];
    return [
      `h${level}`,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        ...(node.attrs.collapsed ? { 'data-collapsed': 'true' } : {}),
      }),
      0,
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(HeadingComponent as any);
  },

  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), createHeadingFoldPlugin(this.name)];
  },
});

export default ZqHeading;
