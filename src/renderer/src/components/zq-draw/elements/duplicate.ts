import { nanoid } from 'nanoid';
import type { DrawElement } from '../types';

function randomInteger(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function duplicateElement(
  element: DrawElement,
  offsetX = 10,
  offsetY = 10,
): DrawElement {
  return {
    ...element,
    id: nanoid(),
    x: element.x + offsetX,
    y: element.y + offsetY,
    version: 1,
    versionNonce: randomInteger(),
    updated: Date.now(),
    seed: Math.floor(Math.random() * 2 ** 31),
    groupIds: [],
    boundElements: null,
  } as DrawElement;
}

export function duplicateElements(
  elements: readonly DrawElement[],
  offsetX = 10,
  offsetY = 10,
): DrawElement[] {
  const oldToNew = new Map<string, string>();

  const duplicated = elements.map((el) => {
    const newEl = duplicateElement(el, offsetX, offsetY);
    oldToNew.set(el.id, newEl.id);
    return newEl;
  });

  return duplicated;
}
