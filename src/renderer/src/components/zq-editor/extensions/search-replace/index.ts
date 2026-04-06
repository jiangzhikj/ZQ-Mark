import { Extension } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';

export interface SearchReplaceOptions {
  searchResultClass: string;
  searchResultCurrentClass: string;
}

export interface SearchReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  results: Array<{ from: number; to: number }>;
  currentIndex: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchTerm: (term: string) => ReturnType;
      setReplaceTerm: (term: string) => ReturnType;
      setCaseSensitive: (value: boolean) => ReturnType;
      nextSearchResult: () => ReturnType;
      previousSearchResult: () => ReturnType;
      replaceCurrentResult: () => ReturnType;
      replaceAllResults: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const searchReplacePluginKey = new PluginKey('searchReplace');

/**
 * Search within each text block independently to avoid
 * false matches that span across block boundaries.
 * Within a textblock, inline positions map 1:1 to text offsets.
 */
function findMatches(
  doc: PmNode,
  searchTerm: string,
  caseSensitive: boolean,
): Array<{ from: number; to: number }> {
  if (!searchTerm) return [];

  const results: Array<{ from: number; to: number }> = [];
  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;

    const blockText = node.textContent;
    const text = caseSensitive ? blockText : blockText.toLowerCase();
    let startIdx = 0;

    while (startIdx < text.length) {
      const idx = text.indexOf(term, startIdx);
      if (idx === -1) break;
      results.push({ from: pos + 1 + idx, to: pos + 1 + idx + term.length });
      startIdx = idx + 1;
    }

    return false;
  });

  return results;
}

function buildDecorations(
  doc: PmNode,
  results: Array<{ from: number; to: number }>,
  currentIndex: number,
): DecorationSet {
  if (results.length === 0) return DecorationSet.empty;

  const decorations: Decoration[] = results.map((result, index) => {
    const cls =
      index === currentIndex
        ? 'zq-search-result zq-search-result--current'
        : 'zq-search-result';
    return Decoration.inline(result.from, result.to, { class: cls });
  });

  return DecorationSet.create(doc, decorations);
}

const META_UPDATE = 'update';
const META_CLEAR = 'clear';

export const SearchReplace = Extension.create<
  SearchReplaceOptions,
  SearchReplaceStorage
>({
  name: 'searchReplace',

  addOptions() {
    return {
      searchResultClass: 'zq-search-result',
      searchResultCurrentClass: 'zq-search-result--current',
    };
  },

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      results: [],
      currentIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ tr }) => {
          this.storage.searchTerm = term;
          this.storage.currentIndex = 0;
          tr.setMeta(searchReplacePluginKey, META_UPDATE);
          return true;
        },

      setReplaceTerm:
        (term: string) =>
        () => {
          this.storage.replaceTerm = term;
          return true;
        },

      setCaseSensitive:
        (value: boolean) =>
        ({ tr }) => {
          this.storage.caseSensitive = value;
          this.storage.currentIndex = 0;
          tr.setMeta(searchReplacePluginKey, META_UPDATE);
          return true;
        },

      nextSearchResult:
        () =>
        ({ tr }) => {
          const { results } = this.storage;
          if (results.length === 0) return false;
          this.storage.currentIndex =
            (this.storage.currentIndex + 1) % results.length;
          tr.setMeta(searchReplacePluginKey, META_UPDATE);
          return true;
        },

      previousSearchResult:
        () =>
        ({ tr }) => {
          const { results } = this.storage;
          if (results.length === 0) return false;
          this.storage.currentIndex =
            (this.storage.currentIndex - 1 + results.length) % results.length;
          tr.setMeta(searchReplacePluginKey, META_UPDATE);
          return true;
        },

      replaceCurrentResult:
        () =>
        ({ tr }) => {
          const { results, currentIndex, replaceTerm } = this.storage;
          if (results.length === 0) return false;
          const match = results[currentIndex];
          if (!match) return false;
          tr.insertText(replaceTerm, match.from, match.to);
          // doc change triggers recalculation in plugin apply
          return true;
        },

      replaceAllResults:
        () =>
        ({ tr }) => {
          const { results, replaceTerm } = this.storage;
          if (results.length === 0) return false;
          let offset = 0;
          for (const match of results) {
            tr.insertText(
              replaceTerm,
              match.from + offset,
              match.to + offset,
            );
            offset += replaceTerm.length - (match.to - match.from);
          }
          return true;
        },

      clearSearch:
        () =>
        ({ tr }) => {
          this.storage.searchTerm = '';
          this.storage.replaceTerm = '';
          this.storage.results = [];
          this.storage.currentIndex = 0;
          tr.setMeta(searchReplacePluginKey, META_CLEAR);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extensionStorage = this.storage;

    return [
      new Plugin({
        key: searchReplacePluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, _oldDecorations, _oldState, newState) {
            const meta = tr.getMeta(searchReplacePluginKey);

            if (meta === META_CLEAR) {
              extensionStorage.results = [];
              extensionStorage.currentIndex = 0;
              return DecorationSet.empty;
            }

            if (meta === META_UPDATE || tr.docChanged) {
              const { searchTerm, caseSensitive } = extensionStorage;
              if (!searchTerm) {
                extensionStorage.results = [];
                extensionStorage.currentIndex = 0;
                return DecorationSet.empty;
              }

              const results = findMatches(
                newState.doc,
                searchTerm,
                caseSensitive,
              );
              extensionStorage.results = results;

              if (results.length > 0) {
                extensionStorage.currentIndex = Math.min(
                  extensionStorage.currentIndex,
                  results.length - 1,
                );
              } else {
                extensionStorage.currentIndex = 0;
              }

              return buildDecorations(
                newState.doc,
                results,
                extensionStorage.currentIndex,
              );
            }

            return _oldDecorations;
          },
        },
        props: {
          decorations(state) {
            return searchReplacePluginKey.getState(state);
          },
          handleKeyDown(view: EditorView, event: KeyboardEvent) {
            const mod = event.metaKey || event.ctrlKey;
            if (mod && event.key === 'f') {
              event.preventDefault();
              view.dom.dispatchEvent(
                new CustomEvent('zq-editor:open-search', {
                  bubbles: true,
                  detail: { showReplace: event.shiftKey },
                }),
              );
              return true;
            }
            if (mod && event.key === 'h') {
              event.preventDefault();
              view.dom.dispatchEvent(
                new CustomEvent('zq-editor:open-search', {
                  bubbles: true,
                  detail: { showReplace: true },
                }),
              );
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

export function scrollToResult(
  editor: any,
  result: { from: number; to: number } | undefined,
) {
  if (!result) return;
  try {
    const coords = editor.view.coordsAtPos(result.from);
    const editorDom = editor.view.dom.closest('.zq-editor');
    if (editorDom) {
      const rect = editorDom.getBoundingClientRect();
      if (coords.top < rect.top || coords.bottom > rect.bottom) {
        const scrollTarget = editorDom.querySelector('.zq-editor__wrapper');
        if (scrollTarget) {
          const scrollEl =
            scrollTarget.querySelector('.ProseMirror')?.parentElement ||
            scrollTarget;
          const scrollTop =
            coords.top - rect.top + scrollEl.scrollTop - rect.height / 3;
          scrollEl.scrollTo({ top: scrollTop, behavior: 'smooth' });
        }
      }
    }
  } catch {
    // position might be invalid during doc changes
  }
}

export default SearchReplace;
