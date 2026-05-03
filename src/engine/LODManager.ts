import { ArcRotateCamera, Mesh, TransformNode } from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';

interface TrackedEntity {
  node: TransformNode | Mesh;
  basePosition: () => { x: number; z: number };
  lodLevel: 'full' | 'simple' | 'billboard' | 'hidden';
  type: 'visitor' | 'facility' | 'scenery';
}

/**
 * LODManager: distance-based level-of-detail switching.
 * Implements visibility-based LOD; billboard swap deferred to future.
 * PRD §7.2, §8.5
 */
export class LODManager {
  private camera: ArcRotateCamera;
  private entities: Map<string, TrackedEntity> = new Map();
  private lastCameraHeight: number = 0;

  constructor(_scene: any, camera: ArcRotateCamera) {
    this.camera = camera;
    _scene.onBeforeRenderObservable.add(() => this.update());
  }

  track(id: string, node: TransformNode | Mesh, type: 'visitor' | 'facility' | 'scenery', basePos: () => { x: number; z: number }) {
    this.entities.set(id, { node, basePosition: basePos, lodLevel: 'full', type });
  }

  untrack(id: string) {
    this.entities.delete(id);
  }

  private update() {
    // Actual height above ground = radius × sin(beta angle)
    const camHeight = this.camera.radius * Math.sin(this.camera.beta);
    // Only check every ~500ms to avoid per-frame overhead
    if (Math.abs(camHeight - this.lastCameraHeight) < 3) return;
    this.lastCameraHeight = camHeight;

    const gridHeight = camHeight / CONSTANTS.CELL_SIZE;

    for (const [, entity] of this.entities) {
      let newLevel: TrackedEntity['lodLevel'] = 'full';

      if (entity.type === 'visitor') {
        if (gridHeight > 50) newLevel = 'hidden';
        else if (gridHeight > 25) newLevel = 'billboard';
        else newLevel = 'full';
      } else if (entity.type === 'scenery') {
        if (gridHeight > 50) newLevel = 'hidden';
        else newLevel = 'full';
      } else if (entity.type === 'facility') {
        if (gridHeight > 40) newLevel = 'simple';
        else newLevel = 'full';
      }

      if (newLevel !== entity.lodLevel) {
        entity.lodLevel = newLevel;
        entity.node.isVisible = newLevel !== 'hidden';
        // For simple LOD: just use visibility toggle for now
        // Full implementation would swap meshes
      }
    }
  }

  dispose() {
    this.entities.clear();
  }
}
