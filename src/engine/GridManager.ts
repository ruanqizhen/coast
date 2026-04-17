/**
 * GridManager — handles ground mesh creation, pointer display, and click handling
 * for both facility placement and road placement modes.
 */
import {
  Scene, MeshBuilder, StandardMaterial, Color3, Vector3, PointerEventTypes, Mesh
} from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';
import { useParkState } from '../store/useParkState';
import { useGameState } from '../store/useGameState';
import { FACILITIES } from '../config/facilities';

export class GridManager {
  private scene: Scene;
  private ground: Mesh;
  private pointerBox: Mesh;
  private gridLines: Mesh[] = [];

  constructor(scene: Scene) {
    this.scene = scene;

    const size = CONSTANTS.GRID_SIZE * CONSTANTS.CELL_SIZE;

    // ── Base Ground ──────────────────────────────────────────
    this.ground = MeshBuilder.CreateGround('ground', {
      width: size,
      height: size,
      subdivisions: 1,
    }, scene);
    this.ground.position = new Vector3(size / 2, 0, size / 2);

    const groundMat = new StandardMaterial('groundMat', scene);
    groundMat.diffuseColor = Color3.FromHexString('#5aa832'); // Richer grass green
    groundMat.specularColor = new Color3(0.05, 0.05, 0.05);
    this.ground.material = groundMat;

    // ── Subtle grid lines ────────────────────────────────────
    this.createGridLines(size);

    // ── Placement ghost box ──────────────────────────────────
    this.pointerBox = MeshBuilder.CreateBox('pointerBox', {
      width: CONSTANTS.CELL_SIZE,
      depth: CONSTANTS.CELL_SIZE,
      height: 0.5,
    }, scene);
    const pointerMat = new StandardMaterial('pointerMat', scene);
    pointerMat.diffuseColor = new Color3(0, 1, 0);
    pointerMat.alpha = 0.4;
    this.pointerBox.material = pointerMat;
    this.pointerBox.isVisible = false;
    this.pointerBox.isPickable = false;

    this.setupInputs();
  }

  private createGridLines(size: number) {
    const mat = new StandardMaterial('gridLineMat', this.scene);
    mat.diffuseColor = new Color3(0.35, 0.6, 0.2);
    mat.alpha = 0.3;

    const cs = CONSTANTS.CELL_SIZE;
    const count = CONSTANTS.GRID_SIZE + 1;

    for (let i = 0; i < count; i++) {
      // Lines along Z
      const lz = MeshBuilder.CreateBox(`gl_z_${i}`, {
        width: 0.05, depth: size, height: 0.02
      }, this.scene);
      lz.position = new Vector3(i * cs, 0.02, size / 2);
      lz.material = mat;
      lz.isPickable = false;
      this.gridLines.push(lz);

      // Lines along X
      const lx = MeshBuilder.CreateBox(`gl_x_${i}`, {
        width: size, depth: 0.05, height: 0.02
      }, this.scene);
      lx.position = new Vector3(size / 2, 0.02, i * cs);
      lx.material = mat;
      lx.isPickable = false;
      this.gridLines.push(lx);
    }
  }

  private setupInputs() {
    this.scene.onPointerObservable.add((pointerInfo) => {
      const state = useParkState.getState();
      const { type: evType } = pointerInfo;

      // Get world position on the Y=0 ground plane via ray-plane intersection
      const getGroundPoint = (): { x: number; z: number } | null => {
        const ray = this.scene.createPickingRay(
          this.scene.pointerX,
          this.scene.pointerY,
          null,
          this.scene.activeCamera
        );
        // Intersect ray with Y=0 plane: ray.origin + t * ray.direction, solve for t when Y=0
        if (Math.abs(ray.direction.y) < 0.0001) return null;
        const t = -ray.origin.y / ray.direction.y;
        if (t < 0) return null;
        const x = ray.origin.x + t * ray.direction.x;
        const z = ray.origin.z + t * ray.direction.z;
        const gridTotal = CONSTANTS.GRID_SIZE * CONSTANTS.CELL_SIZE;
        if (x < 0 || z < 0 || x > gridTotal || z > gridTotal) return null;
        return { x, z };
      };

      switch (evType) {
        case PointerEventTypes.POINTERMOVE: {
          if (!state.placementMode || !state.selectedFacilityToPlace) {
            this.pointerBox.isVisible = false;
            break;
          }

          const gp = getGroundPoint();
          if (!gp) { this.pointerBox.isVisible = false; break; }

          const gridX = Math.floor(gp.x / CONSTANTS.CELL_SIZE);
          const gridZ = Math.floor(gp.z / CONSTANTS.CELL_SIZE);
          const cs = CONSTANTS.CELL_SIZE;

          let sizeX = 1;
          let sizeZ = 1;
          const facDef = FACILITIES[state.selectedFacilityToPlace as keyof typeof FACILITIES];
          if (facDef) { sizeX = facDef.sizeX; sizeZ = facDef.sizeZ; }

          this.pointerBox.scaling.x = sizeX;
          this.pointerBox.scaling.z = sizeZ;
          this.pointerBox.position = new Vector3(
            gridX * cs + (sizeX * cs) / 2,
            0.5,
            gridZ * cs + (sizeZ * cs) / 2
          );
          this.pointerBox.isVisible = true;

          const isValid = gridX >= 0 && gridZ >= 0 &&
            gridX + sizeX <= CONSTANTS.GRID_SIZE &&
            gridZ + sizeZ <= CONSTANTS.GRID_SIZE;

          (this.pointerBox.material as StandardMaterial).diffuseColor =
            isValid ? new Color3(0, 1, 0) : new Color3(1, 0, 0);
          break;
        }

        case PointerEventTypes.POINTERDOWN: {
          // Right click → cancel
          if (pointerInfo.event.button === 2 && state.placementMode) {
            useParkState.getState().exitPlacementMode();
            this.pointerBox.isVisible = false;
            break;
          }

          if (pointerInfo.event.button !== 0) break;
          if (!state.placementMode || !state.selectedFacilityToPlace) break;

          const mat = this.pointerBox.material as StandardMaterial;
          if (!this.pointerBox.isVisible || mat.diffuseColor.g !== 1) break;

          const gp = getGroundPoint();
          if (!gp) break;

          const gridX = Math.floor(gp.x / CONSTANTS.CELL_SIZE);
          const gridZ = Math.floor(gp.z / CONSTANTS.CELL_SIZE);

          if (state.placementCategory === 'road') {
            window.dispatchEvent(new CustomEvent('onRoadPlaced', {
              detail: { type: state.selectedFacilityToPlace, x: gridX, z: gridZ }
            }));
          } else {
            window.dispatchEvent(new CustomEvent('onFacilityPlaced', {
              detail: { id: state.selectedFacilityToPlace, x: gridX, z: gridZ }
            }));
          }
          this.pointerBox.isVisible = false;
          break;
        }
      }
    });
  }
}
