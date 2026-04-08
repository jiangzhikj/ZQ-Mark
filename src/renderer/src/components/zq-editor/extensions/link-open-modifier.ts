import { Extension } from '@tiptap/core';
import { isAllowedUri } from '@tiptap/extension-link';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * 与常见编辑器一致：普通单击可放置光标、编辑；Ctrl（Win/Linux）或 Cmd（macOS）+ 单击打开链接。
 * Link 扩展需保持 openOnClick: false，避免与这里重复。
 */
export const LinkOpenModifier = Extension.create({
  name: 'linkOpenModifier',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('linkOpenModifier'),
        props: {
          handleClick(view, _pos, event) {
            if (!(event instanceof MouseEvent)) return false;
            if (event.button !== 0) return false;
            if (!event.ctrlKey && !event.metaKey) return false;

            const el = event.target as HTMLElement | null;
            if (!el) return false;

            const anchor = el.closest('a[href]') as HTMLAnchorElement | null;
            if (!anchor || !view.dom.contains(anchor)) return false;

            const href = anchor.getAttribute('href');
            if (!href || !isAllowedUri(href)) return false;

            event.preventDefault();
            event.stopPropagation();
            const target = anchor.getAttribute('target') || '_blank';
            window.open(href, target);
            return true;
          },
        },
      }),
    ];
  },
});
