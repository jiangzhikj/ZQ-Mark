import type { AnyExtension } from '@tiptap/core';

import CharacterCount from '@tiptap/extension-character-count';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { Markdown } from 'tiptap-markdown';

import { AttachmentBlock } from './attachment';
import { Callout } from './callout';
import { CodeBlock } from './code-block';
import { ColumnBlock, ColumnsBlock } from './columns';
import { DrawioBlock } from './drawio';
import { ExcalidrawBlock } from './excalidraw';
import { WisemappingBlock } from './wisemapping';
import { ZqHeading } from './heading';
import { FontSize } from './font-size';
import { ImageBlock } from './image';
import { mathExtensions, ZqMarkdownMath } from './math';
import { SearchReplace } from './search-replace';
import { createSlashSuggestion, SlashCommand } from './slash-command';
import { TableOfContents } from './table-of-contents';
import { ToggleBlock } from './toggle-list';
import { VideoBlock } from './video';
import { AudioBlock } from './audio';
import { LinkOpenModifier } from './link-open-modifier';

export interface EditorExtensionOptions {
  placeholder?: string;
  extraExtensions?: AnyExtension[];
}

export function createEditorExtensions(
  options: EditorExtensionOptions = {},
): AnyExtension[] {
  const { placeholder = '', extraExtensions = [] } = options;

  const cellAttributes = {
    backgroundColor: {
      default: null,
      parseHTML: (element: HTMLElement) =>
        element.style.backgroundColor || null,
      renderHTML: (attributes: Record<string, any>) => {
        if (!attributes.backgroundColor) return {};
        return {
          style: `background-color: ${attributes.backgroundColor}`,
        };
      },
    },
    textAlign: {
      default: null,
      parseHTML: (element: HTMLElement) =>
        element.style.textAlign || null,
      renderHTML: (attributes: Record<string, any>) => {
        if (!attributes.textAlign) return {};
        return { style: `text-align: ${attributes.textAlign}` };
      },
    },
  };

  const tableCellExtended = TableCell.extend({
    addAttributes() {
      return { ...this.parent?.(), ...cellAttributes };
    },
  });

  const tableHeaderExtended = TableHeader.extend({
    addAttributes() {
      return { ...this.parent?.(), ...cellAttributes };
    },
  });

  const tableExtended = Table.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        fullWidth: {
          default: false,
          parseHTML: (element: HTMLElement) =>
            element.getAttribute('data-full-width') === 'true',
          renderHTML: (attributes: Record<string, any>) => {
            if (!attributes.fullWidth) return {};
            return { 'data-full-width': 'true' };
          },
        },
        striped: {
          default: false,
          parseHTML: (element: HTMLElement) =>
            element.getAttribute('data-striped') === 'true',
          renderHTML: (attributes: Record<string, any>) => {
            if (!attributes.striped) return {};
            return { 'data-striped': 'true' };
          },
        },
      };
    },
  });

  const extensions: AnyExtension[] = [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      underline: false,
      link: {
        openOnClick: false,
        HTMLAttributes: {
          class: 'zq-editor-link',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      },
    }),
    LinkOpenModifier,
    ZqHeading.configure({ levels: [1, 2, 3] }),
    CodeBlock,
    Placeholder.configure({ placeholder }),
    TextStyle,
    Underline,
    FontSize,
    Color,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Highlight.configure({
      multicolor: true,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    tableExtended.configure({ resizable: true }),
    TableRow,
    tableHeaderExtended,
    tableCellExtended,
    Callout,
    ImageBlock,
    VideoBlock,
    AudioBlock,
    AttachmentBlock,
    ToggleBlock,
    ColumnsBlock,
    ColumnBlock,
    TableOfContents,
    DrawioBlock,
    ExcalidrawBlock,
    WisemappingBlock,
    ...mathExtensions,
    // 与 editor.scss /标题折叠共用：20（手柄视觉区）+ 4 + 22（折叠按钮），使折叠图标落在手柄右侧
    GlobalDragHandle.configure({
      dragHandleWidth: 46,
      scrollTreshold: 100,
    }),
    SlashCommand.configure({
      suggestion: createSlashSuggestion(),
    }),
    CharacterCount,
    SearchReplace,
    Markdown.configure({
      html: true,
      tightLists: true,
      tightListClass: 'tight',
      transformPastedText: true,
      transformCopiedText: true,
    }),
    ZqMarkdownMath,
    ...extraExtensions,
  ];

  return extensions;
}
