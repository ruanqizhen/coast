import type { Position } from '../types';

/**
 * Incremental A* pathfinding system.
 * Operates on a weight grid synced from RoadSystem.
 * Designed to run in Web Worker context.
 */

interface PathNode {
  x: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

/**
 * Find shortest path using A* algorithm on a weight grid.
 * @param grid 2D weight grid (Infinity = impassable)
 * @param start Start position (grid coords)
 * @param end End position (grid coords)
 * @returns Array of positions forming the path, or empty if no path
 */
export function findPath(
  grid: (number | null)[][],
  start: Position,
  end: Position,
  isStaff: boolean = false
): Position[] {
  const size = grid.length;
  if (size === 0) return [];

  const sx = Math.floor(start.x);
  const sz = Math.floor(start.z);
  const ex = Math.floor(end.x);
  const ez = Math.floor(end.z);

  // Bounds check
  if (sx < 0 || sz < 0 || sx >= size || sz >= size) return [];
  if (ex < 0 || ez < 0 || ex >= size || ez >= size) return [];

  // Weight check
  const endWeight = grid[ex]?.[ez];
  if (endWeight === null || endWeight === Infinity) {
    // Try to find nearest adjacent walkable cell to end
    const adj = findNearestWalkable(grid, ex, ez, size);
    if (!adj) return [];
    return findPath(grid, start, adj, isStaff);
  }

  const open: PathNode[] = [];
  const closed = new Set<string>();

  const heuristic = (x: number, z: number) => Math.abs(x - ex) + Math.abs(z - ez);

  const startNode: PathNode = {
    x: sx, z: sz,
    g: 0, h: heuristic(sx, sz), f: heuristic(sx, sz),
    parent: null
  };
  open.push(startNode);

  const dirs = [
    { x: 1, z: 0 }, { x: -1, z: 0 },
    { x: 0, z: 1 }, { x: 0, z: -1 }
  ];

  let iterations = 0;
  const maxIterations = size * size * 2; // Safety limit

  while (open.length > 0 && iterations < maxIterations) {
    iterations++;

    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];

    if (current.x === ex && current.z === ez) {
      // Reconstruct path
      const path: Position[] = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift({ x: node.x, z: node.z });
        node = node.parent;
      }
      return path;
    }

    closed.add(`${current.x},${current.z}`);

    for (const d of dirs) {
      const nx = current.x + d.x;
      const nz = current.z + d.z;

      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;

      const key = `${nx},${nz}`;
      if (closed.has(key)) continue;

      const weight = grid[nx]?.[nz];
      if (weight === null || weight === undefined || weight >= 999) continue;

      const g = current.g + weight;
      const h = heuristic(nx, nz);
      const f = g + h;

      // Check if already in open with better g
      const existing = open.find(n => n.x === nx && n.z === nz);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
        continue;
      }

      open.push({ x: nx, z: nz, g, h, f, parent: current });
    }
  }

  return []; // No path found
}

/** Find nearest walkable cell to target */
function findNearestWalkable(grid: (number | null)[][], x: number, z: number, size: number): Position | null {
  for (let r = 1; r <= 5; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const nx = x + dx;
        const nz = z + dz;
        if (nx >= 0 && nz >= 0 && nx < size && nz < size) {
          const w = grid[nx]?.[nz];
          if (w !== null && w !== undefined && w < 999) {
            return { x: nx, z: nz };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Build a weight grid from road data for pathfinding.
 * @param roadGrid 2D string grid from RoadSystem
 * @param isStaff Whether to include staff-only roads
 * @param congestionData Optional per-cell congestion multiplier
 */
export function buildWeightGrid(
  roadGrid: (string | null)[][],
  isStaff: boolean = false,
  congestionData?: Record<string, number>
): (number | null)[][] {
  const size = roadGrid.length;
  const grid: (number | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const road = roadGrid[x][z];
      if (!road) {
        grid[x][z] = 999; // Impassable
        continue;
      }
      if (road === 'staff' && !isStaff) {
        grid[x][z] = 999;
        continue;
      }

      let weight = 1.0;
      if (road === 'wide') weight = 0.7;

      // Apply congestion
      if (congestionData) {
        const key = `${x},${z}`;
        const congestion = congestionData[key] || 0;
        weight += congestion * 0.5; // 0 to ~3 range
      }

      grid[x][z] = weight;
    }
  }

  return grid;
}

/**
 * Batch pathfinding: process up to maxPerFrame requests.
 */
export interface PathRequest {
  id: string;
  start: Position;
  end: Position;
  isStaff: boolean;
}

export interface PathResult {
  id: string;
  path: Position[];
}

export function processBatchPaths(
  requests: PathRequest[],
  weightGrid: (number | null)[][],
  maxPerFrame: number
): PathResult[] {
  const results: PathResult[] = [];
  const count = Math.min(requests.length, maxPerFrame);

  for (let i = 0; i < count; i++) {
    const req = requests[i];
    const path = findPath(weightGrid, req.start, req.end, req.isStaff);
    results.push({ id: req.id, path });
  }

  return results;
}
