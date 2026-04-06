import { nanoid } from 'nanoid';

import type { Scene } from '../core/scene';
import type { DrawElement, NonDeletedDrawElement } from '../types';

export function generateGroupId(): string {
  return nanoid();
}

export function getElementsInGroup(
  elements: readonly DrawElement[],
  groupId: string,
): DrawElement[] {
  return elements.filter(
    (el) => !el.isDeleted && el.groupIds.includes(groupId),
  );
}

/**
 * Split selected elements into "maximum groups":
 * elements sharing the outermost groupId are grouped together;
 * ungrouped elements each form their own group.
 */
export function getMaximumGroups(
  elements: readonly DrawElement[],
): DrawElement[][] {
  const groups = new Map<string, DrawElement[]>();
  const ungrouped: DrawElement[][] = [];

  for (const el of elements) {
    if (el.groupIds.length > 0) {
      const outerGroupId = el.groupIds[el.groupIds.length - 1]!;
      let group = groups.get(outerGroupId);
      if (!group) {
        group = [];
        groups.set(outerGroupId, group);
      }
      group.push(el);
    } else {
      ungrouped.push([el]);
    }
  }

  return [...groups.values(), ...ungrouped];
}

export function addToGroup(
  prevGroupIds: readonly string[],
  newGroupId: string,
  editingGroupId?: string | null,
): string[] {
  if (editingGroupId) {
    const idx = prevGroupIds.indexOf(editingGroupId);
    if (idx >= 0) {
      return [
        ...prevGroupIds.slice(0, idx),
        newGroupId,
        ...prevGroupIds.slice(idx),
      ];
    }
  }
  return [...prevGroupIds, newGroupId];
}

export function removeFromGroup(
  groupIds: readonly string[],
  groupId: string,
): string[] {
  return groupIds.filter((id) => id !== groupId);
}

/**
 * Expand selection to include all elements sharing a group with any selected element.
 */
export function selectGroupsForSelectedElements(
  selectedIds: Record<string, true>,
  elements: readonly NonDeletedDrawElement[],
  editingGroupId?: string | null,
): { selectedElementIds: Record<string, true>; selectedGroupIds: Record<string, boolean> } {
  const newSelectedIds: Record<string, true> = { ...selectedIds };
  const selectedGroupIds: Record<string, boolean> = {};

  for (const el of elements) {
    if (!selectedIds[el.id]) continue;
    for (const gid of el.groupIds) {
      if (gid === editingGroupId) break;
      selectedGroupIds[gid] = true;
    }
  }

  for (const el of elements) {
    for (const gid of el.groupIds) {
      if (gid === editingGroupId) break;
      if (selectedGroupIds[gid]) {
        newSelectedIds[el.id] = true;
        break;
      }
    }
  }

  return { selectedElementIds: newSelectedIds, selectedGroupIds };
}

export function groupElements(
  selectedElements: readonly DrawElement[],
  scene: Scene,
  editingGroupId?: string | null,
): string {
  const groupId = generateGroupId();
  for (const el of selectedElements) {
    const newGroupIds = addToGroup(el.groupIds, groupId, editingGroupId);
    scene.mutateElement(el.id, { groupIds: newGroupIds } as Partial<DrawElement>);
  }
  return groupId;
}

export function ungroupElements(
  elements: readonly DrawElement[],
  scene: Scene,
  groupId: string,
): void {
  for (const el of elements) {
    if (el.groupIds.includes(groupId)) {
      const newGroupIds = removeFromGroup(el.groupIds, groupId);
      scene.mutateElement(el.id, { groupIds: newGroupIds } as Partial<DrawElement>);
    }
  }
}

/**
 * Get the outermost group ID for an element (the one that should be selected
 * when clicking on the element).
 */
export function getOutermostGroupId(
  element: DrawElement,
  editingGroupId?: string | null,
): string | null {
  if (element.groupIds.length === 0) return null;
  for (let i = element.groupIds.length - 1; i >= 0; i--) {
    if (element.groupIds[i] === editingGroupId) {
      return i > 0 ? element.groupIds[i - 1]! : null;
    }
  }
  return element.groupIds[element.groupIds.length - 1]!;
}
