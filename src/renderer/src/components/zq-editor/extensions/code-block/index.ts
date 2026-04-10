import type { AnyExtension } from '@tiptap/core';

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import plaintext from 'highlight.js/lib/languages/plaintext';
import { common, createLowlight } from 'lowlight';

import CodeBlockComponent from './CodeBlockComponent.vue';

const lowlight = createLowlight(common);
lowlight.register('mermaid', plaintext);

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return VueNodeViewRenderer(CodeBlockComponent as any);
  },
}).configure({
  lowlight,
  defaultLanguage: 'plaintext',
}) as unknown as AnyExtension;

export default CodeBlock;
