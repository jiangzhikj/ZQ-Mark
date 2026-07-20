import type { Content } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'

/**
 * Replace editor document content. When resetHistory is true (default),
 * load through TipTap commands with addToHistory=false so the load step
 * itself is not undoable.
 *
 * Must use editor.commands.setContent so markdown strings are parsed
 * through tiptap-markdown correctly.
 */
export function replaceEditorContent(
  editor: Editor,
  content: Content,
  options?: { emitUpdate?: boolean; resetHistory?: boolean },
): void {
  const emitUpdate = options?.emitUpdate ?? false
  const resetHistory = options?.resetHistory !== false

  if (!resetHistory) {
    editor.commands.setContent(content, { emitUpdate })
    return
  }

  editor
    .chain()
    .setMeta('addToHistory', false)
    .setContent(content, { emitUpdate })
    .run()
}
