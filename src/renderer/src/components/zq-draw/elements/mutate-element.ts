import type { DrawElement } from '../types';

function randomInteger(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * Immutable element update. Returns a new element with bumped version.
 */
export function mutateElement<T extends DrawElement>(
  element: T,
  updates: Partial<T>,
): T {
  return {
    ...element,
    ...updates,
    version: element.version + 1,
    versionNonce: randomInteger(),
    updated: Date.now(),
  };
}

/**
 * Bump version without changing properties.
 */
export function bumpVersion<T extends DrawElement>(element: T): T {
  return {
    ...element,
    version: element.version + 1,
    versionNonce: randomInteger(),
    updated: Date.now(),
  };
}
