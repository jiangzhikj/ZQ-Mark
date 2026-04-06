import type { Scene } from '../core/scene';
import type { DrawElement } from '../types';

/**
 * Collect all indices that must move together with the selected elements:
 * same group members and bound text elements.
 */
function getIndicesToMove(
  elements: readonly DrawElement[],
  selectedIds: Set<string>,
): Set<number> {
  const indices = new Set<number>();
  const idsToInclude = new Set<string>(selectedIds);

  for (const id of selectedIds) {
    const el = elements.find((e) => e.id === id);
    if (!el) continue;
    for (const gid of el.groupIds) {
      for (let i = 0; i < elements.length; i++) {
        if (elements[i]!.groupIds.includes(gid)) {
          idsToInclude.add(elements[i]!.id);
        }
      }
    }
    if (el.boundElements) {
      for (const bound of el.boundElements) {
        idsToInclude.add(bound.id);
      }
    }
  }

  for (let i = 0; i < elements.length; i++) {
    if (idsToInclude.has(elements[i]!.id)) {
      indices.add(i);
    }
  }

  return indices;
}

export function moveOneRight(
  elements: readonly DrawElement[],
  selectedIds: Record<string, true>,
  scene: Scene,
): void {
  const idSet = new Set(Object.keys(selectedIds));
  const arr = [...elements];
  const toMove = getIndicesToMove(arr, idSet);
  const sortedIndices = [...toMove].sort((a, b) => b - a);

  for (const idx of sortedIndices) {
    if (idx >= arr.length - 1) continue;
    const nextIdx = idx + 1;
    if (toMove.has(nextIdx)) continue;
    [arr[idx], arr[nextIdx]] = [arr[nextIdx]!, arr[idx]!];
  }

  scene.replaceAllElements(arr);
}

export function moveOneLeft(
  elements: readonly DrawElement[],
  selectedIds: Record<string, true>,
  scene: Scene,
): void {
  const idSet = new Set(Object.keys(selectedIds));
  const arr = [...elements];
  const toMove = getIndicesToMove(arr, idSet);
  const sortedIndices = [...toMove].sort((a, b) => a - b);

  for (const idx of sortedIndices) {
    if (idx <= 0) continue;
    const prevIdx = idx - 1;
    if (toMove.has(prevIdx)) continue;
    [arr[idx], arr[prevIdx]] = [arr[prevIdx]!, arr[idx]!];
  }

  scene.replaceAllElements(arr);
}

export function moveAllRight(
  elements: readonly DrawElement[],
  selectedIds: Record<string, true>,
  scene: Scene,
): void {
  const idSet = new Set(Object.keys(selectedIds));
  const toMove = getIndicesToMove(elements, idSet);
  const moving: DrawElement[] = [];
  const staying: DrawElement[] = [];

  for (let i = 0; i < elements.length; i++) {
    if (toMove.has(i)) {
      moving.push(elements[i]!);
    } else {
      staying.push(elements[i]!);
    }
  }

  scene.replaceAllElements([...staying, ...moving]);
}

export function moveAllLeft(
  elements: readonly DrawElement[],
  selectedIds: Record<string, true>,
  scene: Scene,
): void {
  const idSet = new Set(Object.keys(selectedIds));
  const toMove = getIndicesToMove(elements, idSet);
  const moving: DrawElement[] = [];
  const staying: DrawElement[] = [];

  for (let i = 0; i < elements.length; i++) {
    if (toMove.has(i)) {
      moving.push(elements[i]!);
    } else {
      staying.push(elements[i]!);
    }
  }

  scene.replaceAllElements([...moving, ...staying]);
}
