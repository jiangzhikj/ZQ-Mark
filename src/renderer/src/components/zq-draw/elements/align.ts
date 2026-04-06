import type { Scene } from '../core/scene';
import type { DrawElement } from '../types';
import type { Bounds } from '../math/types';
import { getElementBounds, getCommonBounds } from './bounds';
import { getMaximumGroups } from './group';

export interface Alignment {
  position: 'start' | 'center' | 'end';
  axis: 'x' | 'y';
}

export interface Distribution {
  space: 'between';
  axis: 'x' | 'y';
}

function getGroupBounds(group: readonly DrawElement[]): Bounds {
  return getCommonBounds(group);
}

export function alignElements(
  selectedElements: readonly DrawElement[],
  alignment: Alignment,
  scene: Scene,
): void {
  if (selectedElements.length < 2) return;

  const groups = getMaximumGroups(selectedElements);
  if (groups.length < 2) return;

  const allBounds = getCommonBounds(selectedElements);
  const { axis, position } = alignment;

  for (const group of groups) {
    const groupBounds = getGroupBounds(group);
    const translation = calculateTranslation(groupBounds, allBounds, axis, position);
    if (translation === 0) continue;

    for (const el of group) {
      if (axis === 'x') {
        scene.mutateElement(el.id, { x: el.x + translation } as Partial<DrawElement>);
      } else {
        scene.mutateElement(el.id, { y: el.y + translation } as Partial<DrawElement>);
      }
    }
  }
}

function calculateTranslation(
  groupBounds: Bounds,
  allBounds: Bounds,
  axis: 'x' | 'y',
  position: 'start' | 'center' | 'end',
): number {
  const idx = axis === 'x' ? 0 : 1;
  const endIdx = axis === 'x' ? 2 : 3;

  const groupStart = groupBounds[idx];
  const groupEnd = groupBounds[endIdx];
  const groupCenter = (groupStart + groupEnd) / 2;

  const allStart = allBounds[idx];
  const allEnd = allBounds[endIdx];
  const allCenter = (allStart + allEnd) / 2;

  switch (position) {
    case 'start':
      return allStart - groupStart;
    case 'center':
      return allCenter - groupCenter;
    case 'end':
      return allEnd - groupEnd;
  }
}

export function distributeElements(
  selectedElements: readonly DrawElement[],
  distribution: Distribution,
  scene: Scene,
): void {
  if (selectedElements.length < 3) return;

  const groups = getMaximumGroups(selectedElements);
  if (groups.length < 3) return;

  const { axis } = distribution;
  const idx = axis === 'x' ? 0 : 1;
  const endIdx = axis === 'x' ? 2 : 3;

  const groupsWithBounds = groups.map((group) => ({
    group,
    bounds: getGroupBounds(group),
  }));

  groupsWithBounds.sort((a, b) => {
    const aCenter = (a.bounds[idx] + a.bounds[endIdx]) / 2;
    const bCenter = (b.bounds[idx] + b.bounds[endIdx]) / 2;
    return aCenter - bCenter;
  });

  const allBounds = getCommonBounds(selectedElements);
  const totalSpan = allBounds[endIdx] - allBounds[idx];
  const totalGroupSize = groupsWithBounds.reduce(
    (sum, { bounds }) => sum + (bounds[endIdx] - bounds[idx]),
    0,
  );
  const gap = (totalSpan - totalGroupSize) / (groupsWithBounds.length - 1);

  let currentPos = allBounds[idx];

  for (const { group, bounds } of groupsWithBounds) {
    const groupSize = bounds[endIdx] - bounds[idx];
    const offset = currentPos - bounds[idx];

    if (Math.abs(offset) > 0.5) {
      for (const el of group) {
        if (axis === 'x') {
          scene.mutateElement(el.id, { x: el.x + offset } as Partial<DrawElement>);
        } else {
          scene.mutateElement(el.id, { y: el.y + offset } as Partial<DrawElement>);
        }
      }
    }

    currentPos += groupSize + gap;
  }
}
