import type { DrawElement, AppState } from '../types';
import { HISTORY_MAX_STEPS } from '../constants';

export interface HistoryEntry {
  elements: readonly DrawElement[];
  appState: Pick<
    AppState,
    | 'selectedElementIds'
    | 'selectedGroupIds'
    | 'viewBackgroundColor'
    | 'editingGroupId'
    | 'editingTextElement'
    | 'name'
  >;
}

export class History {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  record(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > HISTORY_MAX_STEPS) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(currentEntry: HistoryEntry): HistoryEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(currentEntry);
    return entry;
  }

  redo(currentEntry: HistoryEntry): HistoryEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(currentEntry);
    return entry;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
