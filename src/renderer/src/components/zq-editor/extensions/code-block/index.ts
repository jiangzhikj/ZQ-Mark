import type { AnyExtension } from '@tiptap/core';

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import { common, createLowlight } from 'lowlight';

import CodeBlockComponent from './CodeBlockComponent.vue';

const lowlight = createLowlight(common);

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return VueNodeViewRenderer(CodeBlockComponent as any);
  },
}).configure({
  lowlight,
  defaultLanguage: 'plaintext',
}) as unknown as AnyExtension;

export default CodeBlock;
