import type { AnyExtension } from '@tiptap/core';
import { Extension } from '@tiptap/core';
import { BlockMath as BlockMathBase, InlineMath as InlineMathBase } from '@tiptap/extension-mathematics';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import BlockMathComponent from './BlockMathComponent.vue';
import { zqMathMarkdownItPlugin, type MarkdownItRuler } from './markdown-it-zq-math';

const zqBlockMathEnterKey = new PluginKey('zqBlockMathDollarEnter');

function paragraphPlainText(p: PMNode): string {
  let t = '';
  p.forEach((child) => {
    if (child.isText) t += child.text;
  });
  return t;
}

/**
 * 使用 InlineMath + BlockMath 分别配置 KaTeX：
 * - 不要用 Mathematics 包一层再传顶层 katexOptions，会覆盖 block/inline 各自的配置。
 * - 块级公式需 displayMode: true，行内需 displayMode: false。
 */
const katexBase = { throwOnError: false } as const;

/**
 * tiptap-markdown 只认 extension.storage.markdown.serialize；
 * 上游数学扩展的 renderMarkdown 不会被用到，未配置时会退化成 HTML 片段，导致 .md 里是 div/span。
 */
const InlineMath = InlineMathBase.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void }, node: { attrs?: { latex?: string } }) {
          const latex = String(node.attrs?.latex ?? '');
          state.write(`$${latex}$`);
        },
      },
    };
  },
}).configure({
  katexOptions: {
    ...katexBase,
    displayMode: false,
  },
});

const BlockMath = BlockMathBase.extend({
  addNodeView() {
    return VueNodeViewRenderer(BlockMathComponent as any);
  },

  /**
   * 上游 insertBlockMath 使用 if (!latex) return false，latex 为 '' 时无法插入；
   * 斜杠菜单与 $$+Enter 需要插入空块再编辑。
   */
  addCommands() {
    return {
      ...this.parent?.(),
      insertBlockMath:
        (options?: { latex?: string; pos?: number }) =>
        ({ commands, editor }) => {
          const latex = options?.latex ?? '';
          const pos = options?.pos ?? editor.state.selection.from;
          return commands.insertContentAt(pos, {
            type: this.name,
            attrs: { latex },
          });
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: zqBlockMathEnterKey,
        props: {
          handleKeyDown: (view, event) => {
            if (!view.editable) return false;
            if (event.key !== 'Enter' || event.shiftKey) return false;
            if (event.isComposing) return false;
            const { state } = view;
            if (!state.selection.empty) return false;
            const { $from } = state.selection;
            if ($from.parent.type.name !== 'paragraph') return false;
            if (paragraphPlainText($from.parent).trim() !== '$$') return false;
            const blockMathType = state.schema.nodes.blockMath;
            if (!blockMathType) return false;
            event.preventDefault();
            const from = $from.before($from.depth);
            const to = $from.after($from.depth);
            view.dispatch(
              state.tr.replaceWith(from, to, blockMathType.create({ latex: '' })),
            );
            return true;
          },
        },
      }),
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; closeBlock: (node: unknown) => void },
          node: { attrs?: { latex?: string } },
        ) {
          const latex = String(node.attrs?.latex ?? '');
          state.write(`$$\n${latex}\n$$`);
          state.closeBlock(node);
        },
      },
    };
  },
}).configure({
  katexOptions: {
    ...katexBase,
    displayMode: true,
  },
});

/**
 * 在 markdown-it 中识别 $ / $$，输出与 parseHTML 一致的 data-type，供 tiptap-markdown 转 ProseMirror。
 */
export const ZqMarkdownMath = Extension.create({
  name: 'zqMarkdownMath',
  addStorage() {
    return {
      markdown: {
        parse: {
          setup(md: MarkdownItRuler) {
            zqMathMarkdownItPlugin(md);
          },
        },
      },
    };
  },
});

export const mathExtensions: AnyExtension[] = [InlineMath, BlockMath];

export default mathExtensions;
