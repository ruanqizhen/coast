import { Scene, ArcRotateCamera, Mesh, TransformNode, MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';

interface TrackedEntity {
  node: TransformNode | Mesh;
  basePosition: () => { x: number; z: number };
  lodLevel: 'full' | 'simple' | 'billboard' | 'hidden';
  type: 'visitor' | 'facility' | 'scenery';
}

/**
 * LODManager: distance-based level-of-detail switching.
 * PRD §7.2, §8.5
 */
export class LODManager {
  private scene: Scene;
  private camera: ArcRotateCamera;
  private entities: Map<string, TrackedEntity> = new Map();

  // Billboard templates
  private billboardAdult: Mesh;
  private billboardChild: Mesh;
  private billboardStaff: Mesh;

  private lastCameraHeight: number = 0;

  constructor(scene: Scene, camera: ArcRotateCamera) {
    this.scene = scene;
    this.camera = camera;

    // Create shared billboard templates (invisible, cloned on use)
    const bm = new StandardMaterial('billboardMat', scene);
    bm.diffuseColor = new Color3(0.9, 0.7, 0.5);
    bm.backFaceCulling = false;

    this.billboardAdult = MeshBuilder.CreatePlane('bb_adult', { width: 1.2, height: 1.8 }, scene);
    this.billboardAdult.material = bm;
    this.billboardAdult.isVisible = false;
    this.billboardAdult.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const bmChild = new StandardMaterial('bbChildMat', scene);
    bmChild.diffuseColor = new Color3(0.85, 0.65, 0.45);
    bmChild.backFaceCulling = false;
    this.billboardChild = MeshBuilder.CreatePlane('bb_child', { width: 0.9, height: 1.3 }, scene);
    this.billboardChild.material = bmChild;
    this.billboardChild.isVisible = false;
    this.billboardChild.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const bmStaff = new StandardMaterial('bbStaffMat', scene);
    bmStaff.diffuseColor = new Color3(0.3, 0.7, 0.3);
    bmStaff.backFaceCulling = false;
    this.billboardStaff = MeshBuilder.CreatePlane('bb_staff', { width: 1.2, height: 1.8 }, scene);
    this.billboardStaff.material = bmStaff;
    this.billboardStaff.isVisible = false;
    this.billboardStaff.billboardMode = Mesh.BILLBOARDMODE_ALL;

    // Hook into render loop
    this.scene.onBeforeRenderObservable.add(() => this.update());
  }

  track(id: string, node: TransformNode | Mesh, type: 'visitor' | 'facility' | 'scenery', basePos: () => { x: number; z: number }) {
    this.entities.set(id, { node, basePosition: basePos, lodLevel: 'full', type });
  }

  untrack(id: string) {
    this.entities.delete(id);
  }

  private update() {
    const camHeight = this.camera.radius;
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
    this.billboardAdult.dispose();
    this.billboardChild.dispose();
    this.billboardStaff.dispose();
  }
}
