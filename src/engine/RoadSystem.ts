import type { RoadTile, RoadType, Position } from '../types';
import { CONSTANTS } from '../config/constants';

/**
 * RoadSystem manages the road grid, placement, removal, and connectivity checks.
 * Runs in main thread; serializable state is synced to worker.
 */
export class RoadSystem {
  /** 2D grid: null = no road, RoadType = road present */
  private grid: (RoadType | null)[][];
  private size: number;

  constructor(gridSize: number = CONSTANTS.GRID_SIZE) {
    this.size = gridSize;
    this.grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
  }

  getSize(): number { return this.size; }

  /** Expand grid to new size, preserving existing roads */
  expand(newSize: number) {
    const newGrid: (RoadType | null)[][] = Array.from({ length: newSize }, () => Array(newSize).fill(null));
    for (let x = 0; x < this.size; x++) {
      for (let z = 0; z < this.size; z++) {
        newGrid[x][z] = this.grid[x][z];
      }
    }
    this.grid = newGrid;
    this.size = newSize;
  }

  /** Place a road tile. Returns cost or -1 if invalid. */
  placeRoad(x: number, z: number, type: RoadType): number {
    if (x < 0 || z < 0 || x >= this.size || z >= this.size) return -1;
    if (this.grid[x][z] !== null) return -1; // Already has road
    
    this.grid[x][z] = type;
    
    // Wide road occupies 2 cells width (x and x+1)
    if (type === 'wide' && x + 1 < this.size) {
      this.grid[x + 1][z] = type;
    }
    
    return CONSTANTS.ROAD_COST[type];
  }

  /** Remove a road tile. Returns refund amount. */
  removeRoad(x: number, z: number): number {
    if (x < 0 || z < 0 || x >= this.size || z >= this.size) return 0;
    const type = this.grid[x][z];
    if (!type) return 0;
    
    const cost = CONSTANTS.ROAD_COST[type];
    this.grid[x][z] = null;
    
    return Math.floor(cost * CONSTANTS.DEMOLISH_REFUND_RATE);
  }

  getRoadAt(x: number, z: number): RoadType | null {
    if (x < 0 || z < 0 || x >= this.size || z >= this.size) return null;
    return this.grid[x][z];
  }

  /** Check if a position has any road (for visitor pathfinding) */
  isWalkable(x: number, z: number): boolean {
    const road = this.getRoadAt(x, z);
    return road === 'normal' || road === 'wide';
  }

  /** Check if a position is walkable by staff (includes staff roads) */
  isStaffWalkable(x: number, z: number): boolean {
    return this.getRoadAt(x, z) !== null;
  }

  /** Get path weight for A* */
  getWeight(x: number, z: number, isStaff: boolean = false): number {
    const road = this.getRoadAt(x, z);
    if (!road) return Infinity;
    if (road === 'staff' && !isStaff) return Infinity;
    // Wide roads have lower congestion weight
    if (road === 'wide') return 0.7;
    return 1.0;
  }

  /** Get all 4-directional neighbors */
  getNeighbors(x: number, z: number): Position[] {
    const neighbors: Position[] = [];
    const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
    for (const d of dirs) {
      const nx = x + d.x;
      const nz = z + d.z;
      if (nx >= 0 && nz >= 0 && nx < this.size && nz < this.size) {
        neighbors.push({ x: nx, z: nz });
      }
    }
    return neighbors;
  }

  /**
   * BFS connectivity check: is position (fx,fz) connected to entrance via roads?
   * Entrance is at center bottom: (size/2, 0)
   */
  isConnectedToEntrance(fx: number, fz: number, isStaff: boolean = false): boolean {
    const entranceX = Math.floor(this.size / 2);
    const entranceZ = 0;

    // BFS from entrance
    const visited = new Set<string>();
    const queue: Position[] = [{ x: entranceX, z: entranceZ }];
    visited.add(`${entranceX},${entranceZ}`);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.x === fx && curr.z === fz) return true;

      for (const n of this.getNeighbors(curr.x, curr.z)) {
        const key = `${n.x},${n.z}`;
        if (!visited.has(key)) {
          const walkable = isStaff ? this.isStaffWalkable(n.x, n.z) : this.isWalkable(n.x, n.z);
          if (walkable) {
            visited.add(key);
            queue.push(n);
          }
        }
      }
    }
    return false;
  }

  /**
   * Check if a facility at (fx, fz) with given size is adjacent to a road
   * that is connected to the entrance.
   */
  isFacilityConnected(fx: number, fz: number, sizeX: number, sizeZ: number): boolean {
    // Check all cells around the facility perimeter for adjacent roads
    for (let x = fx - 1; x <= fx + sizeX; x++) {
      for (let z = fz - 1; z <= fz + sizeZ; z++) {
        // Skip interior cells
        if (x >= fx && x < fx + sizeX && z >= fz && z < fz + sizeZ) continue;
        if (this.isWalkable(x, z) && this.isConnectedToEntrance(x, z)) {
          return true;
        }
      }
    }
    return false;
  }

  /** Serialize for save/sync */
  toRoadTiles(): RoadTile[] {
    const tiles: RoadTile[] = [];
    for (let x = 0; x < this.size; x++) {
      for (let z = 0; z < this.size; z++) {
        if (this.grid[x][z]) {
          tiles.push({ x, z, type: this.grid[x][z]! });
        }
      }
    }
    return tiles;
  }

  /** Deserialize from save */
  loadFromTiles(tiles: RoadTile[]) {
    // Clear grid
    for (let x = 0; x < this.size; x++) {
      for (let z = 0; z < this.size; z++) {
        this.grid[x][z] = null;
      }
    }
    for (const t of tiles) {
      if (t.x >= 0 && t.z >= 0 && t.x < this.size && t.z < this.size) {
        this.grid[t.x][t.z] = t.type;
      }
    }
  }

  /** Get flat grid for worker sync */
  getFlatGrid(): (string | null)[][] {
    return this.grid.map(row => [...row]);
  }
}
