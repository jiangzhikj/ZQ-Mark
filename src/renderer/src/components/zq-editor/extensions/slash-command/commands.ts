import type { Instance as TippyInstance } from 'tippy.js';
import type { Editor } from '@tiptap/vue-3';

import { VueRenderer } from '@tiptap/vue-3';
import tippy from 'tippy.js';

import { $t } from '../../utils/i18n';
import { isSlashDrawioAvailable } from './slash-drawio-state';
import { isSlashExcalidrawAvailable } from './slash-excalidraw-state';
import LinkEditor from '../../menus/LinkEditor.vue';
import TableSizePicker from '../../menus/TableSizePicker.vue';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  category: string;
  aliases?: string[];
  /** 为 true 时不可选（如流程图资源未安装） */
  disabled?: boolean;
  command: (props: { editor: Editor; range: any }) => void;
}

function showTableSizePicker(editor: Editor) {
  const { view } = editor;
  const coords = view.coordsAtPos(view.state.selection.from);
  let popup: TippyInstance | null = null;

  const component = new VueRenderer(TableSizePicker, {
    props: {
      onSelect: (rows: number, cols: number) => {
        editor
          .chain()
          .focus()
          .insertTable({ rows, cols, withHeaderRow: true })
          .run();
        popup?.destroy();
        component.destroy();
      },
    },
    editor,
  });

  const ref = document.createElement('div');
  const instances = tippy(ref, {
    getReferenceClientRect: () =>
      new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top),
    appendTo: () => document.body,
    content: component.element as HTMLElement,
    showOnCreate: true,
    interactive: true,
    trigger: 'manual',
    placement: 'bottom-start',
    onClickOutside: () => {
      popup?.destroy();
      component.destroy();
    },
  });
  popup = Array.isArray(instances) ? instances[0]! : instances;
}

function showSlashLinkEditor(editor: Editor) {
  const { view } = editor;
  const coords = view.coordsAtPos(editor.state.selection.from);
  let popup: TippyInstance | null = null;

  const component = new VueRenderer(LinkEditor, {
    props: {
      editor,
      mode: 'insert',
      onClosed: () => {
        cleanup();
      },
    },
    editor,
  });

  function cleanup() {
    popup?.destroy();
    component.destroy();
  }

  const ref = document.createElement('div');
  const instances = tippy(ref, {
    getReferenceClientRect: () =>
      new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top),
    appendTo: () => document.body,
    content: component.element as HTMLElement,
    showOnCreate: true,
    interactive: true,
    trigger: 'manual',
    placement: 'bottom-start',
    onClickOutside: () => {
      cleanup();
    },
  });
  popup = Array.isArray(instances) ? instances[0]! : instances;
}

export function getSlashCommands(): SlashCommandItem[] {
  return [
    {
      title: $t('zq-editor.slash.text'),
      description: $t('zq-editor.slash.textDesc'),
      icon: 'AlignJustify',
      category: $t('zq-editor.slash.category.text'),
      aliases: ['paragraph', 'text', 'p'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    {
      title: $t('zq-editor.slash.heading1'),
      description: $t('zq-editor.slash.heading1Desc'),
      icon: 'Heading1',
      category: $t('zq-editor.slash.category.text'),
      aliases: ['h1', 'heading1'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
      },
    },
    {
      title: $t('zq-editor.slash.heading2'),
      description: $t('zq-editor.slash.heading2Desc'),
      icon: 'Heading2',
      category: $t('zq-editor.slash.category.text'),
      aliases: ['h2', 'heading2'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
      },
    },
    {
      title: $t('zq-editor.slash.heading3'),
      description: $t('zq-editor.slash.heading3Desc'),
      icon: 'Heading3',
      category: $t('zq-editor.slash.category.text'),
      aliases: ['h3', 'heading3'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
      },
    },
    {
      title: $t('zq-editor.slash.bulletList'),
      description: $t('zq-editor.slash.bulletListDesc'),
      icon: 'List',
      category: $t('zq-editor.slash.category.list'),
      aliases: ['ul', 'bullet'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: $t('zq-editor.slash.orderedList'),
      description: $t('zq-editor.slash.orderedListDesc'),
      icon: 'ListOrdered',
      category: $t('zq-editor.slash.category.list'),
      aliases: ['ol', 'numbered'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: $t('zq-editor.slash.taskList'),
      description: $t('zq-editor.slash.taskListDesc'),
      icon: 'ListChecks',
      category: $t('zq-editor.slash.category.list'),
      aliases: ['todo', 'task', 'checkbox'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: $t('zq-editor.slash.blockquote'),
      description: $t('zq-editor.slash.blockquoteDesc'),
      icon: 'Quote',
      category: $t('zq-editor.slash.category.text'),
      aliases: ['quote', 'blockquote'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: $t('zq-editor.slash.codeBlock'),
      description: $t('zq-editor.slash.codeBlockDesc'),
      icon: 'Code',
      category: $t('zq-editor.slash.category.text'),
      aliases: ['code', 'codeblock'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: $t('zq-editor.slash.mermaid'),
      description: $t('zq-editor.slash.mermaidDesc'),
      icon: 'Workflow',
      category: $t('zq-editor.slash.category.text'),
      aliases: ['mermaid', 'flowchart', 'diagram', 'sequence'],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleCodeBlock({ language: 'mermaid' })
          .run();
      },
    },
    {
      title: $t('zq-editor.slash.link'),
      description: $t('zq-editor.slash.linkDesc'),
      icon: 'Link',
      category: $t('zq-editor.slash.category.text'),
      aliases: ['link', 'url', 'href', 'a'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        showSlashLinkEditor(editor);
      },
    },
    {
      title: $t('zq-editor.slash.divider'),
      description: $t('zq-editor.slash.dividerDesc'),
      icon: 'Minus',
      category: $t('zq-editor.slash.category.advanced'),
      aliases: ['hr', 'divider', 'line'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: $t('zq-editor.slash.table'),
      description: $t('zq-editor.slash.tableDesc'),
      icon: 'Table',
      category: $t('zq-editor.slash.category.advanced'),
      aliases: ['table'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        showTableSizePicker(editor);
      },
    },
    {
      title: $t('zq-editor.slash.toggle'),
      description: $t('zq-editor.slash.toggleDesc'),
      icon: 'ChevronRight',
      category: $t('zq-editor.slash.category.advanced'),
      aliases: ['toggle', 'collapse', 'expand', 'details'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setToggleBlock().run();
      },
    },
    {
      title: $t('zq-editor.slash.columns'),
      description: $t('zq-editor.slash.columnsDesc'),
      icon: 'Columns2',
      category: $t('zq-editor.slash.category.advanced'),
      aliases: ['columns', 'col', 'layout', 'grid'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setColumns({ count: 2 }).run();
      },
    },
    {
      title: $t('zq-editor.slash.toc'),
      description: $t('zq-editor.slash.tocDesc'),
      icon: 'List',
      category: $t('zq-editor.slash.category.advanced'),
      aliases: ['toc', 'contents', 'outline'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setTableOfContents().run();
      },
    },
    {
      title: $t('zq-editor.slash.callout'),
      description: $t('zq-editor.slash.calloutDesc'),
      icon: 'Info',
      category: $t('zq-editor.slash.category.advanced'),
      aliases: ['callout', 'alert', 'notice', 'tip'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setCallout({ type: 'info' }).run();
      },
    },
    {
      title: $t('zq-editor.slash.inlineMath'),
      description: $t('zq-editor.slash.inlineMathDesc'),
      icon: 'Sigma',
      category: $t('zq-editor.slash.category.advanced'),
      aliases: ['math', 'formula', 'latex', 'equation', 'katex', 'gs', 'eq'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertBlockMath({ latex: '' }).run();
      },
    },
    {
      title: $t('zq-editor.slash.image'),
      description: $t('zq-editor.slash.imageDesc'),
      icon: 'Image',
      category: $t('zq-editor.slash.category.media'),
      aliases: ['image', 'img', 'picture', 'photo'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        editor.view.dom.dispatchEvent(new CustomEvent('zq-editor:open-image-selector', { bubbles: true }));
      },
    },
    {
      title: $t('zq-editor.slash.video'),
      description: $t('zq-editor.slash.videoDesc'),
      icon: 'Video',
      category: $t('zq-editor.slash.category.media'),
      aliases: ['video', 'movie', 'mp4'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        editor.view.dom.dispatchEvent(new CustomEvent('zq-editor:open-file-selector', { detail: { mode: 'video' }, bubbles: true }));
      },
    },
    {
      title: $t('zq-editor.slash.audio'),
      description: $t('zq-editor.slash.audioDesc'),
      icon: 'Music',
      category: $t('zq-editor.slash.category.media'),
      aliases: ['audio', 'music', 'mp3', 'sound'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        editor.view.dom.dispatchEvent(new CustomEvent('zq-editor:open-file-selector', { detail: { mode: 'audio' }, bubbles: true }));
      },
    },
    {
      title: $t('zq-editor.slash.attachment'),
      description: $t('zq-editor.slash.attachmentDesc'),
      icon: 'Paperclip',
      category: $t('zq-editor.slash.category.media'),
      aliases: ['attachment', 'file', 'upload', 'document'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        editor.view.dom.dispatchEvent(new CustomEvent('zq-editor:open-file-selector', { detail: { mode: 'file' }, bubbles: true }));
      },
    },
    {
      title: $t('zq-editor.slash.emoji'),
      description: $t('zq-editor.slash.emojiDesc'),
      icon: 'Smile',
      category: $t('zq-editor.slash.category.advanced'),
      aliases: ['emoji', 'emoticon', 'smiley', 'face'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        editor.view.dom.dispatchEvent(new CustomEvent('zq-editor:open-emoji-picker', { bubbles: true }));
      },
    },
    (() => {
      const drawioOk = isSlashDrawioAvailable();
      return {
        title: $t('zq-editor.slash.drawio'),
        description: drawioOk
          ? $t('zq-editor.slash.drawioDesc')
          : $t('zq-editor.slash.drawioRequiresPlugin'),
        icon: 'Workflow',
        category: $t('zq-editor.slash.category.media'),
        aliases: ['drawio', 'diagram', 'flowchart', 'uml', 'diagrams.net'],
        disabled: !drawioOk,
        command: ({ editor, range }) => {
          if (!isSlashDrawioAvailable()) return;
          editor.chain().focus().deleteRange(range).setDrawioBlock().run();
        },
      } satisfies SlashCommandItem;
    })(),
    (() => {
      const exOk = isSlashExcalidrawAvailable();
      return {
        title: $t('zq-editor.slash.excalidraw'),
        description: exOk
          ? $t('zq-editor.slash.excalidrawDesc')
          : $t('zq-editor.slash.excalidrawRequiresPlugin'),
        icon: 'Shapes',
        category: $t('zq-editor.slash.category.media'),
        aliases: ['excalidraw', '白板', 'handdraw'],
        disabled: !exOk,
        command: ({ editor, range }) => {
          if (!isSlashExcalidrawAvailable()) return;
          editor.chain().focus().deleteRange(range).setExcalidrawBlock().run();
        },
      } satisfies SlashCommandItem;
    })(),
  ];
}

export function filterCommands(
  commands: SlashCommandItem[],
  query: string,
): SlashCommandItem[] {
  if (!query) return commands;
  const lowerQuery = query.toLowerCase();
  return commands.filter(
    (item) =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.aliases?.some((alias) => alias.includes(lowerQuery)),
  );
}

export function groupCommandsByCategory(
  commands: SlashCommandItem[],
): Map<string, SlashCommandItem[]> {
  const groups = new Map<string, SlashCommandItem[]>();
  for (const cmd of commands) {
    const list = groups.get(cmd.category) || [];
    list.push(cmd);
    groups.set(cmd.category, list);
  }
  return groups;
}
