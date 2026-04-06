import type { DrawElement, GlobalPoint, SnapLine } from '../types';
import type { Bounds } from '../math/types';
import { getElementBounds, getCommonBounds } from '../elements/bounds';
import { SNAP_THRESHOLD } from '../constants';

interface SnapResult {
  snappedOffset: { x: number; y: number };
  snapLines: SnapLine[];
}

interface ReferencePoint {
  x: number;
  y: number;
  elementId: string;
}

interface Gap {
  axis: 'x' | 'y';
  gap: number;
  startBounds: Bounds;
  endBounds: Bounds;
  overlap: [number, number];
}

export class SnapCache {
  private referencePoints: ReferencePoint[] = [];
  private visibleGaps: Gap[] = [];
  private dirty = true;

  invalidate(): void {
    this.dirty = true;
  }

  update(
    elements: readonly DrawElement[],
    excludeIds: Set<string>,
  ): void {
    if (!this.dirty) return;

    this.referencePoints = [];
    this.visibleGaps = [];

    const filtered = elements.filter(
      (el) => !el.isDeleted && !excludeIds.has(el.id) && el.type !== 'selection',
    );

    for (const el of filtered) {
      const [x1, y1, x2, y2] = getElementBounds(el);
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;

      // corners
      this.referencePoints.push(
        { x: x1, y: y1, elementId: el.id },
        { x: x2, y: y1, elementId: el.id },
        { x: x2, y: y2, elementId: el.id },
        { x: x1, y: y2, elementId: el.id },
      );
      // edge midpoints
      this.referencePoints.push(
        { x: cx, y: y1, elementId: el.id },
        { x: x2, y: cy, elementId: el.id },
        { x: cx, y: y2, elementId: el.id },
        { x: x1, y: cy, elementId: el.id },
      );
      // center
      this.referencePoints.push(
        { x: cx, y: cy, elementId: el.id },
      );
    }

    this.computeGaps(filtered);
    this.dirty = false;
  }

  private computeGaps(elements: readonly DrawElement[]): void {
    if (elements.length < 2) return;

    const boundsArr = elements.map((el) => ({
      id: el.id,
      bounds: getElementBounds(el),
    }));

    // horizontal gaps (sorted by left edge)
    const sortedByX = [...boundsArr].sort((a, b) => a.bounds[0] - b.bounds[0]);
    for (let i = 0; i < sortedByX.length - 1; i++) {
      const a = sortedByX[i]!;
      const b = sortedByX[i + 1]!;
      const gap = b.bounds[0] - a.bounds[2];
      if (gap > 0) {
        const overlapStart = Math.max(a.bounds[1], b.bounds[1]);
        const overlapEnd = Math.min(a.bounds[3], b.bounds[3]);
        if (overlapEnd > overlapStart) {
          this.visibleGaps.push({
            axis: 'x',
            gap,
            startBounds: a.bounds,
            endBounds: b.bounds,
            overlap: [overlapStart, overlapEnd],
          });
        }
      }
    }

    // vertical gaps (sorted by top edge)
    const sortedByY = [...boundsArr].sort((a, b) => a.bounds[1] - b.bounds[1]);
    for (let i = 0; i < sortedByY.length - 1; i++) {
      const a = sortedByY[i]!;
      const b = sortedByY[i + 1]!;
      const gap = b.bounds[1] - a.bounds[3];
      if (gap > 0) {
        const overlapStart = Math.max(a.bounds[0], b.bounds[0]);
        const overlapEnd = Math.min(a.bounds[2], b.bounds[2]);
        if (overlapEnd > overlapStart) {
          this.visibleGaps.push({
            axis: 'y',
            gap,
            startBounds: a.bounds,
            endBounds: b.bounds,
            overlap: [overlapStart, overlapEnd],
          });
        }
      }
    }
  }

  getReferencePoints(): readonly ReferencePoint[] {
    return this.referencePoints;
  }

  getVisibleGaps(): readonly Gap[] {
    return this.visibleGaps;
  }
}

export function getSnapDistance(zoom: number): number {
  return SNAP_THRESHOLD / zoom;
}

/**
 * Collect snap candidates for a set of bounds (corners + edge midpoints + center).
 */
function getBoundsSnapCandidates(bounds: Bounds): { xs: number[]; ys: number[] } {
  const [x1, y1, x2, y2] = bounds;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  return {
    xs: [x1, cx, x2],
    ys: [y1, cy, y2],
  };
}

interface SnapMatch {
  offset: number;
  candidateValue: number;
  refValue: number;
  refPoint: ReferencePoint;
}

/**
 * Find best point snaps on a single axis.
 */
function findAxisSnaps(
  candidates: number[],
  referencePoints: readonly ReferencePoint[],
  axis: 'x' | 'y',
  threshold: number,
): SnapMatch[] {
  let bestOffset = Infinity;
  let matches: SnapMatch[] = [];

  for (const ref of referencePoints) {
    const refVal = axis === 'x' ? ref.x : ref.y;
    for (const cand of candidates) {
      const offset = refVal - cand;
      const absOffset = Math.abs(offset);
      if (absOffset < threshold) {
        if (absOffset < bestOffset) {
          bestOffset = absOffset;
          matches = [{ offset, candidateValue: cand, refValue: refVal, refPoint: ref }];
        } else if (Math.abs(absOffset - bestOffset) < 0.01) {
          matches.push({ offset, candidateValue: cand, refValue: refVal, refPoint: ref });
        }
      }
    }
  }

  return matches;
}

/**
 * Find gap snaps for a given bounds.
 */
function findGapSnaps(
  bounds: Bounds,
  gaps: readonly Gap[],
  threshold: number,
): { xMatches: SnapMatch[]; yMatches: SnapMatch[] } {
  const [sx1, sy1, sx2, sy2] = bounds;
  let bestDx = Infinity;
  let bestDy = Infinity;
  let xMatches: SnapMatch[] = [];
  let yMatches: SnapMatch[] = [];

  for (const gap of gaps) {
    if (gap.axis === 'x') {
      // snap to right side: place element so that gap between endBounds right edge and element left = gap.gap
      const rightOffset = (gap.endBounds[2] + gap.gap) - sx1;
      if (Math.abs(rightOffset) < threshold && Math.abs(rightOffset) < bestDx) {
        bestDx = Math.abs(rightOffset);
        xMatches = [{ offset: rightOffset, candidateValue: sx1, refValue: gap.endBounds[2] + gap.gap, refPoint: { x: gap.endBounds[2] + gap.gap, y: (gap.overlap[0] + gap.overlap[1]) / 2, elementId: '' } }];
      }
      // snap to left side: place element so that gap between element right edge and startBounds left = gap.gap
      const leftOffset = (gap.startBounds[0] - gap.gap) - sx2;
      if (Math.abs(leftOffset) < threshold && Math.abs(leftOffset) < bestDx) {
        bestDx = Math.abs(leftOffset);
        xMatches = [{ offset: leftOffset, candidateValue: sx2, refValue: gap.startBounds[0] - gap.gap, refPoint: { x: gap.startBounds[0] - gap.gap, y: (gap.overlap[0] + gap.overlap[1]) / 2, elementId: '' } }];
      }
    } else {
      const bottomOffset = (gap.endBounds[3] + gap.gap) - sy1;
      if (Math.abs(bottomOffset) < threshold && Math.abs(bottomOffset) < bestDy) {
        bestDy = Math.abs(bottomOffset);
        yMatches = [{ offset: bottomOffset, candidateValue: sy1, refValue: gap.endBounds[3] + gap.gap, refPoint: { x: (gap.overlap[0] + gap.overlap[1]) / 2, y: gap.endBounds[3] + gap.gap, elementId: '' } }];
      }
      const topOffset = (gap.startBounds[1] - gap.gap) - sy2;
      if (Math.abs(topOffset) < threshold && Math.abs(topOffset) < bestDy) {
        bestDy = Math.abs(topOffset);
        yMatches = [{ offset: topOffset, candidateValue: sy2, refValue: gap.startBounds[1] - gap.gap, refPoint: { x: (gap.overlap[0] + gap.overlap[1]) / 2, y: gap.startBounds[1] - gap.gap, elementId: '' } }];
      }
    }
  }

  return { xMatches, yMatches };
}

/**
 * Create snap lines from matches, extending lines to cover both the reference
 * element bounds and the dragged element bounds.
 */
function createSnapLinesFromMatches(
  xMatches: SnapMatch[],
  yMatches: SnapMatch[],
  snappedBounds: Bounds,
  allRefPoints: readonly ReferencePoint[],
): SnapLine[] {
  const snapLines: SnapLine[] = [];
  const [sx1, sy1, sx2, sy2] = snappedBounds;

  if (xMatches.length > 0) {
    const snapX = xMatches[0]!.refValue;

    // Collect all Y values that align at this X (from reference points and dragged bounds)
    const yValues: number[] = [sy1, sy2, (sy1 + sy2) / 2];
    for (const ref of allRefPoints) {
      if (Math.abs(ref.x - snapX) < 0.5) {
        yValues.push(ref.y);
      }
    }
    const minY = Math.min(...yValues) - 10;
    const maxY = Math.max(...yValues) + 10;

    snapLines.push({
      type: 'points',
      points: [
        [snapX, minY] as GlobalPoint,
        [snapX, maxY] as GlobalPoint,
      ],
    });
  }

  if (yMatches.length > 0) {
    const snapY = yMatches[0]!.refValue;

    const xValues: number[] = [sx1, sx2, (sx1 + sx2) / 2];
    for (const ref of allRefPoints) {
      if (Math.abs(ref.y - snapY) < 0.5) {
        xValues.push(ref.x);
      }
    }
    const minX = Math.min(...xValues) - 10;
    const maxX = Math.max(...xValues) + 10;

    snapLines.push({
      type: 'points',
      points: [
        [minX, snapY] as GlobalPoint,
        [maxX, snapY] as GlobalPoint,
      ],
    });
  }

  return snapLines;
}

/**
 * Snap dragged elements to nearby reference points.
 * Uses the ORIGINAL bounds (before drag) + dragOffset to compute snap.
 */
export function snapDraggedElements(
  dragOffset: { x: number; y: number },
  originalBounds: Bounds,
  cache: SnapCache,
  zoom: number,
): SnapResult {
  const threshold = getSnapDistance(zoom);

  const [ox1, oy1, ox2, oy2] = originalBounds;
  // Projected bounds after applying drag offset
  const projectedBounds: Bounds = [
    ox1 + dragOffset.x,
    oy1 + dragOffset.y,
    ox2 + dragOffset.x,
    oy2 + dragOffset.y,
  ];

  const { xs: candidateXs, ys: candidateYs } = getBoundsSnapCandidates(projectedBounds);

  // Point snaps
  const xPointMatches = findAxisSnaps(candidateXs, cache.getReferencePoints(), 'x', threshold);
  const yPointMatches = findAxisSnaps(candidateYs, cache.getReferencePoints(), 'y', threshold);

  // Gap snaps
  const { xMatches: xGapMatches, yMatches: yGapMatches } = findGapSnaps(
    projectedBounds,
    cache.getVisibleGaps(),
    threshold,
  );

  // Pick best X snap (point vs gap)
  let bestXOffset = 0;
  let xMatches: SnapMatch[] = [];
  const xPointBest = xPointMatches.length > 0 ? Math.abs(xPointMatches[0]!.offset) : Infinity;
  const xGapBest = xGapMatches.length > 0 ? Math.abs(xGapMatches[0]!.offset) : Infinity;

  if (xPointBest <= xGapBest && xPointBest < Infinity) {
    bestXOffset = xPointMatches[0]!.offset;
    xMatches = xPointMatches;
  } else if (xGapBest < Infinity) {
    bestXOffset = xGapMatches[0]!.offset;
    xMatches = xGapMatches;
  }

  // Pick best Y snap
  let bestYOffset = 0;
  let yMatches: SnapMatch[] = [];
  const yPointBest = yPointMatches.length > 0 ? Math.abs(yPointMatches[0]!.offset) : Infinity;
  const yGapBest = yGapMatches.length > 0 ? Math.abs(yGapMatches[0]!.offset) : Infinity;

  if (yPointBest <= yGapBest && yPointBest < Infinity) {
    bestYOffset = yPointMatches[0]!.offset;
    yMatches = yPointMatches;
  } else if (yGapBest < Infinity) {
    bestYOffset = yGapMatches[0]!.offset;
    yMatches = yGapMatches;
  }

  const snappedOffset = {
    x: dragOffset.x + bestXOffset,
    y: dragOffset.y + bestYOffset,
  };

  // Compute snapped bounds for line generation
  const snappedBounds: Bounds = [
    ox1 + snappedOffset.x,
    oy1 + snappedOffset.y,
    ox2 + snappedOffset.x,
    oy2 + snappedOffset.y,
  ];

  const snapLines = createSnapLinesFromMatches(
    xMatches,
    yMatches,
    snappedBounds,
    cache.getReferencePoints(),
  );

  return { snappedOffset, snapLines };
}

/**
 * Snap a new element being created.
 */
export function snapNewElement(
  bounds: Bounds,
  cache: SnapCache,
  zoom: number,
): { snappedBounds: Bounds; snapLines: SnapLine[] } {
  const threshold = getSnapDistance(zoom);
  const { xs: candidateXs, ys: candidateYs } = getBoundsSnapCandidates(bounds);

  const xMatches = findAxisSnaps(candidateXs, cache.getReferencePoints(), 'x', threshold);
  const yMatches = findAxisSnaps(candidateYs, cache.getReferencePoints(), 'y', threshold);

  const offsetX = xMatches.length > 0 ? xMatches[0]!.offset : 0;
  const offsetY = yMatches.length > 0 ? yMatches[0]!.offset : 0;

  const snappedBounds: Bounds = [
    bounds[0] + offsetX,
    bounds[1] + offsetY,
    bounds[2] + offsetX,
    bounds[3] + offsetY,
  ];

  const snapLines = createSnapLinesFromMatches(
    xMatches,
    yMatches,
    snappedBounds,
    cache.getReferencePoints(),
  );

  return { snappedBounds, snapLines };
}

/**
 * Snap during element resize.
 */
export function snapResizeElement(
  resizingEdgeX: number | null,
  resizingEdgeY: number | null,
  cache: SnapCache,
  zoom: number,
): { offsetX: number; offsetY: number; snapLines: SnapLine[] } {
  const threshold = getSnapDistance(zoom);
  let offsetX = 0;
  let offsetY = 0;
  const snapLines: SnapLine[] = [];

  if (resizingEdgeX !== null) {
    const xMatches = findAxisSnaps([resizingEdgeX], cache.getReferencePoints(), 'x', threshold);
    if (xMatches.length > 0) {
      offsetX = xMatches[0]!.offset;
      const snapX = xMatches[0]!.refValue;
      const yValues: number[] = [];
      for (const ref of cache.getReferencePoints()) {
        if (Math.abs(ref.x - snapX) < 0.5) {
          yValues.push(ref.y);
        }
      }
      if (resizingEdgeY !== null) yValues.push(resizingEdgeY);
      if (yValues.length >= 2) {
        const minY = Math.min(...yValues) - 10;
        const maxY = Math.max(...yValues) + 10;
        snapLines.push({
          type: 'points',
          points: [[snapX, minY] as GlobalPoint, [snapX, maxY] as GlobalPoint],
        });
      }
    }
  }

  if (resizingEdgeY !== null) {
    const yMatches = findAxisSnaps([resizingEdgeY], cache.getReferencePoints(), 'y', threshold);
    if (yMatches.length > 0) {
      offsetY = yMatches[0]!.offset;
      const snapY = yMatches[0]!.refValue;
      const xValues: number[] = [];
      for (const ref of cache.getReferencePoints()) {
        if (Math.abs(ref.y - snapY) < 0.5) {
          xValues.push(ref.x);
        }
      }
      if (resizingEdgeX !== null) xValues.push(resizingEdgeX);
      if (xValues.length >= 2) {
        const minX = Math.min(...xValues) - 10;
        const maxX = Math.max(...xValues) + 10;
        snapLines.push({
          type: 'points',
          points: [[minX, snapY] as GlobalPoint, [maxX, snapY] as GlobalPoint],
        });
      }
    }
  }

  return { offsetX, offsetY, snapLines };
}
