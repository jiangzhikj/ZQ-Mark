import type { Editor, Extension, JSONContent } from '@tiptap/vue-3';

export interface ZqEditorProps {
  modelValue?: JSONContent | string;
  mode?: 'compact' | 'full';
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  minHeight?: number | string;
  maxHeight?: number | string;
  extensions?: Extension[];
  uploadOptions?: FileUploadOptions;
}

export interface ZqEditorEmits {
  (e: 'update:modelValue', value: JSONContent): void;
  (e: 'change', value: JSONContent): void;
  (e: 'ready', editor: Editor): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'blur', event: FocusEvent): void;
}

export interface ZqEditorExpose {
  getEditor: () => Editor | undefined;
  getJSON: () => JSONContent;
  getHTML: () => string;
  getText: () => string;
  setContent: (content: JSONContent | string) => void;
  clear: () => void;
  focus: () => void;
  isEmpty: () => boolean;
}

export interface FileUploadOptions {
  isPublic?: boolean;
  parentId?: string;
  maxSize?: number;
  source?: string;
}

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  category: string;
  command: (props: { editor: Editor; range: Range }) => void;
}

export interface BlockMenuItem {
  key: string;
  label: string;
  icon: string;
  action: (editor: Editor) => void;
  disabled?: boolean;
  danger?: boolean;
}

export type TextColorItem = {
  color: string;
  label: string;
};

export type HighlightColorItem = {
  color: string;
  label: string;
};
