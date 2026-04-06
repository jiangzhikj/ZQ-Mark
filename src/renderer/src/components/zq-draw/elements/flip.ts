import type { Scene } from '../core/scene';
import type {
  DrawElement,
  DrawLinearElement,
  DrawArrowElement,
  LocalPoint,
} from '../types';
import { getCommonBounds } from './bounds';

export function flipElements(
  selectedElements: readonly DrawElement[],
  direction: 'horizontal' | 'vertical',
  scene: Scene,
): void {
  if (selectedElements.length === 0) return;

  if (allAreBoundArrows(selectedElements)) {
    for (const el of selectedElements) {
      const arrow = el as DrawArrowElement;
      scene.mutateElement(arrow.id, {
        startArrowhead: arrow.endArrowhead,
        endArrowhead: arrow.startArrowhead,
      } as Partial<DrawElement>);
    }
    return;
  }

  const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  for (const el of selectedElements) {
    if (isLinearLike(el)) {
      flipLinearElement(el as DrawLinearElement, direction, midX, midY, scene);
    } else {
      flipGenericElement(el, direction, midX, midY, scene);
    }
  }
}

function flipGenericElement(
  element: DrawElement,
  direction: 'horizontal' | 'vertical',
  midX: number,
  midY: number,
  scene: Scene,
): void {
  if (direction === 'horizontal') {
    const newX = 2 * midX - element.x - element.width;
    scene.mutateElement(element.id, { x: newX } as Partial<DrawElement>);
  } else {
    const newY = 2 * midY - element.y - element.height;
    scene.mutateElement(element.id, { y: newY } as Partial<DrawElement>);
  }
}

function flipLinearElement(
  element: DrawLinearElement,
  direction: 'horizontal' | 'vertical',
  midX: number,
  midY: number,
  scene: Scene,
): void {
  const newPoints = element.points.map((p) => {
    if (direction === 'horizontal') {
      return [-p[0], p[1]] as LocalPoint;
    }
    return [p[0], -p[1]] as LocalPoint;
  });

  if (direction === 'horizontal') {
    const newX = 2 * midX - element.x - element.width;
    scene.mutateElement(element.id, {
      x: newX,
      points: newPoints,
    } as Partial<DrawElement>);
  } else {
    const newY = 2 * midY - element.y - element.height;
    scene.mutateElement(element.id, {
      y: newY,
      points: newPoints,
    } as Partial<DrawElement>);
  }
}

function allAreBoundArrows(elements: readonly DrawElement[]): boolean {
  return elements.every((el) => {
    if (el.type !== 'arrow') return false;
    const arrow = el as DrawArrowElement;
    return arrow.startBinding != null || arrow.endBinding != null;
  });
}

function isLinearLike(element: DrawElement): boolean {
  return element.type === 'line' || element.type === 'arrow';
}
