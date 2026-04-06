import type { Scene } from '../core/scene';
import type { DrawElement, DrawFrameElement, NonDeletedDrawElement } from '../types';
import { getElementBounds } from './bounds';

export function isFrameElement(element: DrawElement): element is DrawFrameElement {
  return element.type === 'frame';
}

export function getFrameChildren(
  frame: DrawFrameElement,
  elements: readonly DrawElement[],
): DrawElement[] {
  return elements.filter((el) => !el.isDeleted && el.frameId === frame.id);
}

export function addElementsToFrame(
  elements: readonly DrawElement[],
  frame: DrawFrameElement,
  scene: Scene,
): void {
  for (const el of elements) {
    if (el.id === frame.id || el.type === 'frame') continue;
    if (el.frameId !== frame.id) {
      scene.mutateElement(el.id, { frameId: frame.id } as Partial<DrawElement>);
    }
  }
}

export function removeElementsFromFrame(
  elements: readonly DrawElement[],
  scene: Scene,
): void {
  for (const el of elements) {
    if (el.frameId) {
      scene.mutateElement(el.id, { frameId: null } as Partial<DrawElement>);
    }
  }
}

export function removeAllElementsFromFrame(
  frame: DrawFrameElement,
  allElements: readonly DrawElement[],
  scene: Scene,
): void {
  const children = getFrameChildren(frame, allElements);
  removeElementsFromFrame(children, scene);
}

/**
 * Check if an element's bounds are completely inside a frame's bounds.
 */
export function isElementInFrame(
  element: DrawElement,
  frame: DrawFrameElement,
): boolean {
  const [ex1, ey1, ex2, ey2] = getElementBounds(element);
  const [fx1, fy1, fx2, fy2] = getElementBounds(frame);
  return ex1 >= fx1 && ey1 >= fy1 && ex2 <= fx2 && ey2 <= fy2;
}

/**
 * Check if an element overlaps with a frame.
 */
export function elementOverlapsWithFrame(
  element: DrawElement,
  frame: DrawFrameElement,
): boolean {
  const [ex1, ey1, ex2, ey2] = getElementBounds(element);
  const [fx1, fy1, fx2, fy2] = getElementBounds(frame);
  return ex1 <= fx2 && ex2 >= fx1 && ey1 <= fy2 && ey2 >= fy1;
}

/**
 * Get all non-frame elements completely inside a frame's bounds.
 */
export function getElementsInFrame(
  frame: DrawFrameElement,
  elements: readonly NonDeletedDrawElement[],
): NonDeletedDrawElement[] {
  return elements.filter(
    (el) => el.id !== frame.id && el.type !== 'frame' && isElementInFrame(el, frame),
  );
}

/**
 * After dragging elements, update their frame membership.
 */
export function updateFrameMembershipOnDrag(
  draggedElements: readonly DrawElement[],
  allElements: readonly NonDeletedDrawElement[],
  scene: Scene,
): void {
  const frames = allElements.filter(
    (el): el is DrawFrameElement & { isDeleted: false } => el.type === 'frame',
  );

  for (const el of draggedElements) {
    if (el.type === 'frame') continue;

    let newFrameId: string | null = null;
    for (const frame of frames) {
      if (isElementInFrame(el, frame)) {
        newFrameId = frame.id;
        break;
      }
    }

    if (el.frameId !== newFrameId) {
      scene.mutateElement(el.id, { frameId: newFrameId } as Partial<DrawElement>);
    }
  }
}

/**
 * Whether frame clipping should be applied for rendering.
 */
export function shouldApplyFrameClip(
  element: DrawElement,
  frameRendering: { enabled: boolean; clip: boolean },
): boolean {
  return (
    frameRendering.enabled &&
    frameRendering.clip &&
    element.frameId != null
  );
}

/**
 * Get all frames from elements.
 */
export function getAllFrames(
  elements: readonly DrawElement[],
): DrawFrameElement[] {
  return elements.filter(
    (el): el is DrawFrameElement => el.type === 'frame' && !el.isDeleted,
  );
}
