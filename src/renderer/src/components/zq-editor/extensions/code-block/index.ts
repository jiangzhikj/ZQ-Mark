import type { AnyExtension } from '@tiptap/core';

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import type { NodeType } from '@tiptap/pm/model';
import { NodeSelection, type EditorState } from '@tiptap/pm/state';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import plaintext from 'highlight.js/lib/languages/plaintext';
import { common, createLowlight } from 'lowlight';

import CodeBlockComponent from './CodeBlockComponent.vue';

const lowlight = createLowlight(common);
lowlight.register('mermaid', plaintext);

function getCodeBlockInnerTextRange(
  state: EditorState,
  codeBlockType: NodeType,
): { from: number; to: number } | null {
  const { selection } = state;

  if (selection instanceof NodeSelection && selection.node.type === codeBlockType) {
    const pos = selection.from;
    const node = selection.node;
    return { from: pos + 1, to: pos + node.nodeSize - 1 };
  }

  const { $from } = selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type === codeBlockType) {
      const start = $from.before(d);
      return { from: start + 1, to: start + node.nodeSize - 1 };
    }
  }

  return null;
}

export const CodeBlock = CodeBlockLowlight.extend({
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      'Mod-a': ({ editor }) => {
        const range = getCodeBlockInnerTextRange(editor.state, this.type);
        if (!range) return false;
        return editor.chain().focus().setTextSelection(range).run();
      },
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-collapsed') === 'true',
        renderHTML: (attributes) => ({
          'data-collapsed': String(attributes.collapsed),
        }),
      },
    };
  },
  addNodeView() {
    return VueNodeViewRenderer(CodeBlockComponent as any);
  },
}).configure({
  lowlight,
  defaultLanguage: 'plaintext',
}) as unknown as AnyExtension;

export default CodeBlock;
