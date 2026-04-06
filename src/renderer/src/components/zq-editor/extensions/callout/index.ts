import { mergeAttributes, Node, wrappingInputRule } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

import CalloutComponent from './CalloutComponent.vue';

export type CalloutType = 'error' | 'info' | 'success' | 'warning';

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>;
  types: CalloutType[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { type?: CalloutType }) => ReturnType;
      toggleCallout: (attrs?: { type?: CalloutType }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      types: ['info', 'warning', 'success', 'error'],
    };
  },

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-callout-type') || 'info',
        renderHTML: (attributes) => ({
          'data-callout-type': attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'callout',
        class: `callout-block callout-block--${HTMLAttributes['data-callout-type'] || 'info'}`,
      }),
      0,
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(CalloutComponent as any);
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs);
        },
      toggleCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attrs);
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^:::info\s$/,
        type: this.type,
        getAttributes: () => ({ type: 'info' }),
      }),
      wrappingInputRule({
        find: /^:::warning\s$/,
        type: this.type,
        getAttributes: () => ({ type: 'warning' }),
      }),
      wrappingInputRule({
        find: /^:::success\s$/,
        type: this.type,
        getAttributes: () => ({ type: 'success' }),
      }),
      wrappingInputRule({
        find: /^:::error\s$/,
        type: this.type,
        getAttributes: () => ({ type: 'error' }),
      }),
    ];
  },
});

export default Callout;
