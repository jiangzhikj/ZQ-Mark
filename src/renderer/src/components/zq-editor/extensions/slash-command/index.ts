import type { Instance as TippyInstance } from 'tippy.js';

import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { VueRenderer } from '@tiptap/vue-3';
import tippy from 'tippy.js';

import { filterCommands, getSlashCommands } from './commands';
import SlashCommandMenu from './SlashCommandMenu.vue';

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export function createSlashSuggestion() {
  return {
    items: ({ query }: { query: string }) => {
      return filterCommands(getSlashCommands(), query);
    },

    render: () => {
      let component: VueRenderer | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: any) => {
          component = new VueRenderer(SlashCommandMenu, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          const ref = document.createElement('div');
          const instances = tippy(ref, {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element as HTMLElement,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            theme: 'zq-slash',
          });
          popup = Array.isArray(instances) ? instances : [instances];
        },

        onUpdate(props: any) {
          component?.updateProps(props);
          if (props.clientRect && popup) {
            popup[0]?.setProps({
              getReferenceClientRect: props.clientRect,
            });
          }
        },

        onKeyDown(props: any) {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }
          return (component?.ref as any)?.onKeyDown(props.event);
        },

        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}
