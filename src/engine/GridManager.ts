/**
 * GridManager — handles ground mesh creation, pointer display, and click handling
 * for both facility placement and road placement modes.
 */
import {
  Scene, MeshBuilder, PBRMaterial, StandardMaterial, DynamicTexture, Color3, Color4, Vector3, PointerEventTypes, Mesh
} from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';
import { useParkState } from '../store/useParkState';
import { FACILITIES } from '../config/facilities';

export class GridManager {
  private scene: Scene;
  private ground: Mesh;
  private pointerBox: Mesh;
  private gridLines: Mesh[] = [];

  private isDraggingCoaster: boolean = false;
  private isDraggingRoad: boolean = false;
  private roadDragCells: Set<string> = new Set();
  private dragStartGrid: { x: number, z: number } | null = null;

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

    // Procedural grass texture
    const texSize = 1024;
    const grassTex = new DynamicTexture('grassTex', texSize, scene, false);
    const ctx = grassTex.getContext();
    // Base green
    ctx.fillStyle = '#5aa832';
    ctx.fillRect(0, 0, texSize, texSize);
    // Variation patches
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * texSize;
      const y = Math.random() * texSize;
      const shade = Math.random();
      const r = 70 + Math.floor(shade * 50);
      const g = 150 + Math.floor(shade * 50);
      const b = 30 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 4 + Math.random() * 6, 4 + Math.random() * 6);
    }
    // Small darker dots for depth
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * texSize, Math.random() * texSize, 3, 3);
    }
    grassTex.update();

    const groundMat = new PBRMaterial('groundMat', scene);
    groundMat.albedoTexture = grassTex;
    groundMat.roughness = 0.9;
    groundMat.metallic = 0.0;
    this.ground.material = groundMat;
    this.ground.receiveShadows = true;

    // ── Subtle grid lines ────────────────────────────────────
    this.createGridLines(size);

    // ── Placement ghost box ──────────────────────────────────
    this.pointerBox = MeshBuilder.CreateBox('pointerBox', {
      width: CONSTANTS.CELL_SIZE,
      depth: CONSTANTS.CELL_SIZE,
      height: 0.5,
    }, scene);
    const pointerMat = new PBRMaterial('pointerMat', scene);
    pointerMat.albedoColor = new Color3(0, 1, 0);
    pointerMat.alpha = 0.4;
    pointerMat.roughness = 0.3;
    pointerMat.emissiveColor = new Color3(0, 0.5, 0);
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

  private checkCoasterOverlap(pieces: {x: number, z: number}[], dx: number, dz: number, facilities: any[]): boolean {
      for (const piece of pieces) {
          const nx = piece.x + dx;
          const nz = piece.z + dz;
          if (nx < 0 || nz < 0 || nx >= CONSTANTS.GRID_SIZE || nz >= CONSTANTS.GRID_SIZE) {
              return true; // Out of bounds
          }
          for (const fac of facilities) {
              if (fac.typeId === 'coaster_basic' || fac.typeId === 'launch_coaster') continue;
              const fdef = FACILITIES[fac.typeId as keyof typeof FACILITIES];
              if (!fdef) continue;
              let sx = fdef.sizeX;
              let sz = fdef.sizeZ;
              if (fac.rotation === 90 || fac.rotation === 270) {
                  sx = fdef.sizeZ;
                  sz = fdef.sizeX;
              }
              if (nx >= fac.x && nx < fac.x + sx && nz >= fac.z && nz < fac.z + sz) {
                  return true; // Overlaps facility
              }
          }
      }
      return false;
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
          const canvas = this.scene.getEngine().getRenderingCanvas();

          // Road drag painting
          if (this.isDraggingRoad) {
            const gp = getGroundPoint();
            if (gp) {
              const gridX = Math.floor(gp.x / CONSTANTS.CELL_SIZE);
              const gridZ = Math.floor(gp.z / CONSTANTS.CELL_SIZE);
              const key = `${gridX},${gridZ}`;
              if (!this.roadDragCells.has(key)) {
                this.roadDragCells.add(key);
                window.dispatchEvent(new CustomEvent('onRoadPlaced', {
                  detail: { type: state.selectedFacilityToPlace, x: gridX, z: gridZ }
                }));
              }
            }
            if (canvas) canvas.style.cursor = 'crosshair';
            break;
          }

          if (this.isDraggingCoaster && this.dragStartGrid) {
              if (canvas) canvas.style.cursor = 'move';
              const gp = getGroundPoint();
              if (gp) {
                  const gridX = Math.floor(gp.x / CONSTANTS.CELL_SIZE);
                  const gridZ = Math.floor(gp.z / CONSTANTS.CELL_SIZE);
                  const dx = gridX - this.dragStartGrid.x;
                  const dz = gridZ - this.dragStartGrid.z;
                  
                  const isOverlap = this.checkCoasterOverlap(state.currentCoasterPieces, dx, dz, state.facilities);
                  useParkState.getState().setCoasterDragOffset({ dx, dz, isValid: !isOverlap });
              }
              break;
          }

          if (state.coasterBuilderMode) {
              this.pointerBox.isVisible = false;
              break;
          }

          if (canvas) canvas.style.cursor = 'default';

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

          const pm = this.pointerBox.material as PBRMaterial;
          pm.albedoColor = isValid ? new Color3(0, 1, 0) : new Color3(1, 0, 0);
          pm.emissiveColor = isValid ? new Color3(0, 0.4, 0) : new Color3(0.4, 0, 0);
          break;
        }

        case PointerEventTypes.POINTERDOWN: {
          // Start road drag painting
          if (state.placementMode && state.placementCategory === 'road' && pointerInfo.event.button === 0) {
            const gp = getGroundPoint();
            if (gp) {
              this.isDraggingRoad = true;
              this.roadDragCells.clear();
              const gridX = Math.floor(gp.x / CONSTANTS.CELL_SIZE);
              const gridZ = Math.floor(gp.z / CONSTANTS.CELL_SIZE);
              this.roadDragCells.add(`${gridX},${gridZ}`);
              window.dispatchEvent(new CustomEvent('onRoadPlaced', {
                detail: { type: state.selectedFacilityToPlace, x: gridX, z: gridZ }
              }));
              const canvas = this.scene.getEngine().getRenderingCanvas();
              if (canvas) this.scene.activeCamera?.detachControl();
              break;
            }
          }

          if (state.coasterBuilderMode && pointerInfo.event.button === 0) {
              const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
              if (pickedMesh && (pickedMesh.name.startsWith('preview_coaster') || pickedMesh.parent?.name === 'preview_coaster')) {
                  const gp = getGroundPoint();
                  if (gp) {
                      this.isDraggingCoaster = true;
                      this.dragStartGrid = {
                          x: Math.floor(gp.x / CONSTANTS.CELL_SIZE),
                          z: Math.floor(gp.z / CONSTANTS.CELL_SIZE)
                      };
                      const canvas = this.scene.getEngine().getRenderingCanvas();
                      if (canvas) this.scene.activeCamera?.detachControl();
                  }
                  break;
              }
          }

          // Right click → cancel (not in coaster builder or road mode)
          if (pointerInfo.event.button === 2 && state.placementMode &&
              !state.coasterBuilderMode && state.placementCategory !== 'road') {
            useParkState.getState().exitPlacementMode();
            this.pointerBox.isVisible = false;
            break;
          }

          if (pointerInfo.event.button !== 0) break;
          if (!state.placementMode || !state.selectedFacilityToPlace || state.coasterBuilderMode) break;

          const mat = this.pointerBox.material as PBRMaterial;
          if (!this.pointerBox.isVisible || mat.albedoColor.g !== 1) break;

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

        case PointerEventTypes.POINTERUP: {
            if (this.isDraggingRoad) {
              this.isDraggingRoad = false;
              const canvas = this.scene.getEngine().getRenderingCanvas();
              if (canvas) {
                this.scene.activeCamera?.attachControl(canvas, true);
                canvas.style.cursor = 'default';
              }
              break;
            }
            if (this.isDraggingCoaster) {
                this.isDraggingCoaster = false;
                const offset = useParkState.getState().coasterDragOffset;
                if (offset && offset.isValid && (offset.dx !== 0 || offset.dz !== 0)) {
                    useParkState.getState().shiftCoaster(offset.dx, offset.dz);
                }
                useParkState.getState().setCoasterDragOffset(null);
                
                const canvas = this.scene.getEngine().getRenderingCanvas();
                if (canvas) {
                    this.scene.activeCamera?.attachControl(canvas, true);
                    canvas.style.cursor = 'default';
                }
            }
            break;
        }
      }
    });
  }
}
