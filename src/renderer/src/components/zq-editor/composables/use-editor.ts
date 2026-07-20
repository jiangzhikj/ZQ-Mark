import type { JSONContent } from '@tiptap/vue-3';

import type { ZqEditorProps } from '../types';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
} from 'vue';

import { $t } from '../utils/i18n';

import { Editor } from '@tiptap/vue-3';
import { NodeSelection } from '@tiptap/pm/state';
import { Fragment, Slice } from '@tiptap/pm/model';

import { createEditorExtensions } from '../extensions';

interface UseZqEditorOptions {
  props: ZqEditorProps;
  emit: {
    (e: 'change', value: JSONContent): void;
    (e: 'update:modelValue', value: JSONContent): void;
    (e: 'ready', editor: any): void;
    (e: 'focus', event: FocusEvent): void;
    (e: 'blur', event: FocusEvent): void;
  };
}

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

/**
 * 复制时剥离分栏外壳——只保留内部段落/标题等原生块，
 * 避免粘贴时被 parseHTML 重新解析出分栏结构。
 */
function flattenColumnsInSlice(slice: Slice): Slice {
  let hasColumns = false;
  slice.content.forEach((node) => {
    if (node.type.name === 'columnsBlock') {
      hasColumns = true;
    }
  });
  if (!hasColumns) return slice;

  const newNodes: any[] = [];
  slice.content.forEach((node) => {
    if (node.type.name === 'columnsBlock') {
      node.forEach((col: any) => {
        col.forEach((block: any) => {
          newNodes.push(block.copy(block.content));
        });
      });
    } else {
      newNodes.push(node);
    }
  });
  return new Slice(
    Fragment.fromArray(newNodes),
    Math.min(slice.openStart, 1),
    Math.min(slice.openEnd, 1),
  );
}

export function useZqEditor({ props, emit }: UseZqEditorOptions) {
  const placeholder = computed(
    () => props.placeholder || $t('zq-editor.placeholder'),
  );

  const editor = shallowRef<Editor | undefined>();
  let _mouseoutCleanup: (() => void) | null = null;

  function createInstance() {
    const extensions = createEditorExtensions({
      placeholder: placeholder.value,
      extraExtensions: props.extensions || [],
    });

    editor.value = new Editor({
      content: resolveContent(props.modelValue),
      editable: !props.disabled && !props.readonly,
      extensions,
      editorProps: {
        attributes: {
          class: 'zq-editor-prosemirror',
          spellcheck: 'false',
        },
        transformCopied: (slice) => {
          slice = flattenColumnsInSlice(slice);

          const sel = editor.value?.state.selection;
          const isTextSelectionInCodeBlock =
            sel &&
            !(sel instanceof NodeSelection) &&
            sel.$from.parent.type.name === 'codeBlock';

          if (isTextSelectionInCodeBlock) {
            const newNodes: any[] = [];
            slice.content.forEach((node) => {
              if (node.type.name === 'codeBlock') {
                const para = node.type.schema.nodes.paragraph?.create(
                  {},
                  node.content
                );
                newNodes.push(para || node);
              } else {
                newNodes.push(node);
              }
            });
            return new Slice(
              Fragment.fromArray(newNodes),
              Math.min(slice.openStart, 1),
              Math.min(slice.openEnd, 1),
            );
          }

          return slice;
        },
      },
      onUpdate: ({ editor: e }) => {
        const json = e.getJSON();
        emit('update:modelValue', json);
        emit('change', json);
      },
      onFocus: ({ event }) => {
        emit('focus', event);
      },
      onBlur: ({ event }) => {
        emit('blur', event);
      },
      onCreate: ({ editor: e }) => {
        _mouseoutCleanup = patchDragHandleMouseout(e);
        emit('ready', e);
      },
    });
  }

  onMounted(() => {
    createInstance();
  });

  onBeforeUnmount(() => {
    _mouseoutCleanup?.();
    _mouseoutCleanup = null;
    editor.value?.destroy();
    editor.value = undefined;
  });

  watch(
    () => props.modelValue,
    (value) => {
      if (!editor.value) return;
      const currentJSON = JSON.stringify(editor.value.getJSON());
      const newJSON = JSON.stringify(resolveContent(value));
      if (currentJSON !== newJSON) {
        editor.value.commands.setContent(resolveContent(value), {
          emitUpdate: false,
        });
      }
    },
  );

  watch(
    () => [props.disabled, props.readonly],
    ([disabled, readonly]) => {
      editor.value?.setEditable(!disabled && !readonly);
    },
  );

  const editorStyle = computed(() => {
    if (props.mode === 'full') return {};
    return {
      minHeight: toPx(props.minHeight, '200px'),
      maxHeight: toPx(props.maxHeight, '600px'),
    };
  });

  function getJSON(): JSONContent {
    return editor.value?.getJSON() || { type: 'doc', content: [] };
  }

  function getHTML(): string {
    return editor.value?.getHTML() || '';
  }

  function getText(): string {
    return editor.value?.getText() || '';
  }

  function getMarkdown(): string {
    return (editor.value?.storage as any)?.markdown?.getMarkdown() || '';
  }

  function setContent(content: JSONContent | string) {
    editor.value?.commands.setContent(content);
  }

  function clear() {
    editor.value?.commands.clearContent();
  }

  function focus() {
    editor.value?.commands.focus();
  }

  function isEmpty(): boolean {
    return editor.value?.isEmpty ?? true;
  }

  return {
    editor,
    editorStyle,
    getJSON,
    getHTML,
    getText,
    getMarkdown,
    setContent,
    clear,
    focus,
    isEmpty,
  };
}

function resolveContent(value: JSONContent | string | undefined): any {
  if (!value) return EMPTY_DOC;
  if (typeof value === 'string') return value || EMPTY_DOC;
  return value;
}

/**
 * tiptap-extension-global-drag-handle's mouseout handler only checks
 * relatedTarget for classes 'tiptap' and 'drag-handle'. When the mouse
 * enters a child element inside .ProseMirror (e.g. <p>, <h1>), those
 * elements don't carry the 'tiptap' class, so the handle hides even
 * though the mouse is still inside the editor. This patch intercepts
 * mouseout in capture phase and suppresses it when the cursor stays
 * within the wrapper.
 */
function patchDragHandleMouseout(e: Editor): (() => void) | null {
  const wrapper = e.view.dom.parentElement;
  if (!wrapper) return null;

  function handler(event: MouseEvent) {
    const related = event.relatedTarget as Element | null;
    if (related && wrapper!.contains(related)) {
      event.stopImmediatePropagation();
    }
  }

  wrapper.addEventListener('mouseout', handler, true);
  return () => wrapper.removeEventListener('mouseout', handler, true);
}

function toPx(
  value: number | string | undefined,
  fallback: string,
): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return `${value}px`;
  return value;
}
