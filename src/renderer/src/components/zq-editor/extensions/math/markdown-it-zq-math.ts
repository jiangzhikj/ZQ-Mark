/**
 * 为 tiptap-markdown（markdown-it → HTML → ProseMirror）补齐 $ / $$ 数学语法，
 * 输出与 @tiptap/extension-mathematics 的 parseHTML 一致的 data-type / data-latex。
 */

/** 将 LaTeX 写入 HTML 属性（双引号包裹） */
export function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

type MdStateBlock = {
  src: string;
  bMarks: number[];
  eMarks: number[];
  tShift: number[];
  sCount: number[];
  blkIndent: number;
  line: number;
  md: { options: { html?: boolean } };
  push: (type: string, tag: string, nesting: number) => { map?: number[]; content: string };
};

type MdStateInline = {
  src: string;
  pos: number;
  posMax: number;
  push: (type: string, tag: string, nesting: number) => { content: string };
};

function pushBlockMath(state: MdStateBlock, startLine: number, endLine: number, latex: string) {
  const token = state.push('html_block', '', 0);
  token.map = [startLine, endLine];
  token.content = `<div data-type="block-math" data-latex="${escapeHtmlAttr(latex)}"></div>\n`;
}

/**
 * 块级：支持
 * - 单行 `$$\frac{a}{b}$$`
 * - 多行 GitHub 风格（首行仅 `$$`，末行仅 `$$`）
 */
function ruleBlockMath(
  state: MdStateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  if (!state.md.options.html) return false;

  const pos = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (pos + 2 > max) return false;
  if (state.src.slice(pos, pos + 2) !== '$$') return false;

  const lineAfter = state.src.slice(pos + 2, max).trim();

  if (lineAfter.includes('$$')) {
    const closeIdx = lineAfter.indexOf('$$');
    const latex = lineAfter.slice(0, closeIdx).trim();
    const afterClose = lineAfter.slice(closeIdx + 2).trim();
    if (afterClose !== '') return false;
    if (silent) return true;
    state.line = startLine + 1;
    pushBlockMath(state, startLine, state.line, latex);
    return true;
  }

  if (lineAfter !== '') return false;
  if (silent) return true;

  const body: string[] = [];
  let nextLine = startLine + 1;
  for (; nextLine < endLine; nextLine++) {
    const p = state.bMarks[nextLine] + state.tShift[nextLine];
    const m = state.eMarks[nextLine];
    const trimmed = state.src.slice(p, m).trim();
    if (trimmed === '$$') {
      const latex = body.join('\n').trim();
      state.line = nextLine + 1;
      pushBlockMath(state, startLine, state.line, latex);
      return true;
    }
    body.push(state.src.slice(p, m));
  }
  return false;
}

/**
 * 行内：`$...$`（非 `$$`）；支持 `\$` 与 `\\`；不换行。
 */
function ruleInlineMath(state: MdStateInline, silent: boolean): boolean {
  if (!state.src) return false;

  const src = state.src;
  let pos = state.pos;
  const max = state.posMax;

  if (src.charCodeAt(pos) !== 0x24 /* $ */) return false;
  if (pos + 1 < max && src.charCodeAt(pos + 1) === 0x24) return false;

  let i = pos + 1;
  let escaped = false;
  while (i < max) {
    const c = src.charCodeAt(i);
    if (escaped) {
      escaped = false;
      i++;
      continue;
    }
    if (c === 0x5c /* \ */) {
      escaped = true;
      i++;
      continue;
    }
    if (c === 0x0a /* \n */) return false;
    if (c === 0x24 /* $ */) {
      if (silent) return true;
      const raw = src.slice(pos + 1, i);
      const latex = raw.replace(/\\([\\$])/g, '$1');
      const token = state.push('html_inline', '', 0);
      token.content = `<span data-type="inline-math" data-latex="${escapeHtmlAttr(latex)}"></span>`;
      state.pos = i + 1;
      return true;
    }
    i++;
  }
  return false;
}

const INSTALLED = new WeakMap<object, true>();

/** markdown-it 实例（仅声明本插件用到的 ruler API） */
export type MarkdownItRuler = {
  block: {
    ruler: {
      before: (
        name: string,
        ruleName: string,
        fn: (state: MdStateBlock, startLine: number, endLine: number, silent: boolean) => boolean,
      ) => void;
    };
  };
  inline: {
    ruler: {
      before: (
        name: string,
        ruleName: string,
        fn: (state: MdStateInline, silent: boolean) => boolean,
      ) => void;
    };
  };
};

export function zqMathMarkdownItPlugin(md: MarkdownItRuler): void {
  if (INSTALLED.has(md as object)) return;
  INSTALLED.set(md as object, true);

  md.block.ruler.before('fence', 'zq_math_block', ruleBlockMath);
  md.inline.ruler.before('text', 'zq_math_inline', ruleInlineMath);
}
