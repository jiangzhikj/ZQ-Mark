import type { Editor } from '@tiptap/vue-3';

import { $t } from '../utils/i18n';

export interface BlockAction {
  key: string;
  label: string;
  icon: string;
  action: (editor: Editor) => void;
  disabled?: boolean;
  danger?: boolean;
}

export function getBlockActions(editor: Editor): BlockAction[] {
  return [
    {
      key: 'duplicate',
      label: $t('common.copy'),
      icon: 'Copy',
      action: (e) => {
        const { from, to } = e.state.selection;
        const slice = e.state.doc.slice(from, to);
        e.chain().focus().insertContentAt(to, slice.content.toJSON()).run();
      },
    },
    {
      key: 'delete',
      label: $t('common.delete'),
      icon: 'Trash2',
      danger: true,
      action: (e) => {
        const { from, to } = e.state.selection;
        e.chain().focus().deleteRange({ from, to }).run();
      },
    },
  ];
}

export function turnIntoBlock(editor: Editor, type: string) {
  const actions: Record<string, () => void> = {
    paragraph: () => editor.chain().focus().setParagraph().run(),
    h1: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    h2: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    h3: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    bulletList: () => editor.chain().focus().toggleBulletList().run(),
    orderedList: () => editor.chain().focus().toggleOrderedList().run(),
    taskList: () => editor.chain().focus().toggleTaskList().run(),
    blockquote: () => editor.chain().focus().toggleBlockquote().run(),
    codeBlock: () => editor.chain().focus().toggleCodeBlock().run(),
  };
  actions[type]?.();
}
