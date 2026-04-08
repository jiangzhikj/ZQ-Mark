import type { AnyExtension } from '@tiptap/core';
import { BlockMath, InlineMath } from '@tiptap/extension-mathematics';

/**
 * 使用 InlineMath + BlockMath 分别配置 KaTeX：
 * - 不要用 Mathematics 包一层再传顶层 katexOptions，会覆盖 block/inline 各自的配置。
 * - 块级公式需 displayMode: true，行内需 displayMode: false。
 */
const katexBase = { throwOnError: false } as const;

export const mathExtensions: AnyExtension[] = [
  InlineMath.configure({
    katexOptions: {
      ...katexBase,
      displayMode: false,
    },
  }),
  BlockMath.configure({
    katexOptions: {
      ...katexBase,
      displayMode: true,
    },
  }),
];

export default mathExtensions;
