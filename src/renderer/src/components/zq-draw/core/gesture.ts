export interface GestureState {
  pointers: Map<number, { x: number; y: number }>;
  lastCenter: { x: number; y: number } | null;
  initialDistance: number | null;
  initialScale: number | null;
}

export function createGestureState(): GestureState {
  return {
    pointers: new Map(),
    lastCenter: null,
    initialDistance: null,
    initialScale: null,
  };
}

export function getGestureCenter(
  state: GestureState,
): { x: number; y: number } | null {
  if (state.pointers.size < 2) return null;

  const points = Array.from(state.pointers.values());
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}

export function getGestureDistance(state: GestureState): number | null {
  if (state.pointers.size < 2) return null;

  const points = Array.from(state.pointers.values());
  const dx = points[1]!.x - points[0]!.x;
  const dy = points[1]!.y - points[0]!.y;
  return Math.hypot(dx, dy);
}
