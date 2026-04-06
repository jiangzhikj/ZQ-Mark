import type {
  DrawElement,
  NonDeletedDrawElement,
  AppState,
} from '../types';

type SceneCallback = () => void;

export class Scene {
  private elementsMap = new Map<string, DrawElement>();
  private nonDeletedElements: NonDeletedDrawElement[] = [];
  private version = 0;
  private callbacks = new Set<SceneCallback>();

  getVersion(): number {
    return this.version;
  }

  getElements(): readonly DrawElement[] {
    return Array.from(this.elementsMap.values());
  }

  getElementsIncludingDeleted(): readonly DrawElement[] {
    return Array.from(this.elementsMap.values());
  }

  getNonDeletedElements(): readonly NonDeletedDrawElement[] {
    return this.nonDeletedElements;
  }

  getElementsMapIncludingDeleted(): Map<string, DrawElement> {
    return this.elementsMap;
  }

  getElement(id: string): DrawElement | undefined {
    return this.elementsMap.get(id);
  }

  replaceAllElements(elements: readonly DrawElement[]): void {
    this.elementsMap.clear();
    for (const el of elements) {
      this.elementsMap.set(el.id, el);
    }
    this.updateNonDeleted();
    this.version++;
    this.triggerCallbacks();
  }

  insertElement(element: DrawElement): void {
    this.elementsMap.set(element.id, element);
    this.updateNonDeleted();
    this.version++;
    this.triggerCallbacks();
  }

  insertElements(elements: readonly DrawElement[]): void {
    for (const el of elements) {
      this.elementsMap.set(el.id, el);
    }
    this.updateNonDeleted();
    this.version++;
    this.triggerCallbacks();
  }

  mutateElement(
    id: string,
    updates: Partial<DrawElement>,
  ): DrawElement | null {
    const el = this.elementsMap.get(id);
    if (!el) return null;

    const updated = {
      ...el,
      ...updates,
      version: el.version + 1,
      versionNonce: randomInteger(),
      updated: Date.now(),
    } as DrawElement;

    this.elementsMap.set(id, updated);
    this.updateNonDeleted();
    this.version++;
    this.triggerCallbacks();
    return updated;
  }

  deleteElement(id: string): void {
    const el = this.elementsMap.get(id);
    if (!el) return;
    this.elementsMap.set(id, { ...el, isDeleted: true } as DrawElement);
    this.updateNonDeleted();
    this.version++;
    this.triggerCallbacks();
  }

  deleteElements(ids: string[]): void {
    for (const id of ids) {
      const el = this.elementsMap.get(id);
      if (el) {
        this.elementsMap.set(id, { ...el, isDeleted: true } as DrawElement);
      }
    }
    this.updateNonDeleted();
    this.version++;
    this.triggerCallbacks();
  }

  getSelectedElements(appState: AppState): NonDeletedDrawElement[] {
    return this.nonDeletedElements.filter(
      (el) => appState.selectedElementIds[el.id],
    );
  }

  onChange(callback: SceneCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  destroy(): void {
    this.elementsMap.clear();
    this.nonDeletedElements = [];
    this.callbacks.clear();
  }

  private updateNonDeleted(): void {
    this.nonDeletedElements = Array.from(this.elementsMap.values()).filter(
      (el): el is NonDeletedDrawElement => !el.isDeleted,
    );
  }

  private triggerCallbacks(): void {
    for (const cb of this.callbacks) {
      cb();
    }
  }
}

function randomInteger(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
