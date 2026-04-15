import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, Matrix, PointerEventTypes } from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';
import { useParkState } from '../store/useParkState';
import { FACILITIES } from '../config/facilities';

export class GridManager {
  private scene: Scene;
  private groundMaterial: StandardMaterial;
  private pointerBox: any;

  constructor(scene: Scene) {
    this.scene = scene;
    
    // Create base ground
    const size = CONSTANTS.GRID_SIZE * CONSTANTS.CELL_SIZE;
    const ground = MeshBuilder.CreateGround("ground", { width: size, height: size, subdivisions: CONSTANTS.GRID_SIZE }, scene);
    
    // Position ground so its corner is at 0,0 and extends to pos X, pos Z
    ground.position = new Vector3(size / 2, 0, size / 2);

    this.groundMaterial = new StandardMaterial("groundMat", scene);
    this.groundMaterial.diffuseColor = Color3.FromHexString("#7EC850"); // Grass color from PRD
    this.groundMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    ground.material = this.groundMaterial;
    
    this.setupPointer();
    this.setupInputs(ground);
  }

  private setupPointer() {
    this.pointerBox = MeshBuilder.CreateBox("pointerBox", { size: CONSTANTS.CELL_SIZE }, this.scene);
    const pointerMat = new StandardMaterial("pointerMat", this.scene);
    pointerMat.diffuseColor = new Color3(0, 1, 0); // Green for valid
    pointerMat.alpha = 0.5;
    this.pointerBox.material = pointerMat;
    this.pointerBox.isVisible = false;
    this.pointerBox.isPickable = false;
  }

  private setupInputs(ground: any) {
    this.scene.onPointerObservable.add((pointerInfo) => {
      const state = useParkState.getState();
      
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERMOVE:
          if (state.placementMode && state.selectedFacilityToPlace) {
            const pickResult = pointerInfo.pickInfo;
            if (pickResult && pickResult.hit && pickResult.pickedMesh === ground) {
              const facDef = FACILITIES[state.selectedFacilityToPlace];
              if (facDef) {
                // Determine grid snapping
                const point = pickResult.pickedPoint!;
                const gridX = Math.floor(point.x / CONSTANTS.CELL_SIZE);
                const gridZ = Math.floor(point.z / CONSTANTS.CELL_SIZE);
                
                const w = facDef.sizeX * CONSTANTS.CELL_SIZE;
                const h = facDef.sizeZ * CONSTANTS.CELL_SIZE;
                
                // Adjust pointerBox size dynamically
                this.pointerBox.scaling.x = facDef.sizeX;
                this.pointerBox.scaling.z = facDef.sizeZ;
                
                // Position so its corner aligns with grid corner
                const posX = (gridX * CONSTANTS.CELL_SIZE) + (w / 2);
                const posZ = (gridZ * CONSTANTS.CELL_SIZE) + (h / 2);
                this.pointerBox.position = new Vector3(posX, 1, posZ);
                this.pointerBox.isVisible = true;

                // Validate placement (simple boundary check for now)
                const isValid = gridX >= 0 && gridZ >= 0 && 
                                gridX + facDef.sizeX <= CONSTANTS.GRID_SIZE && 
                                gridZ + facDef.sizeZ <= CONSTANTS.GRID_SIZE;
                                
                const mat = this.pointerBox.material as StandardMaterial;
                mat.diffuseColor = isValid ? new Color3(0, 1, 0) : new Color3(1, 0, 0);
              }
            } else {
              this.pointerBox.isVisible = false;
            }
          } else {
            this.pointerBox.isVisible = false;
          }
          break;
          
        case PointerEventTypes.POINTERDOWN:
          // Left click to place
          if (pointerInfo.event.button === 0 && state.placementMode && state.selectedFacilityToPlace) {
            if (this.pointerBox.isVisible && (this.pointerBox.material as StandardMaterial).diffuseColor.g === 1) {
              const facDef = FACILITIES[state.selectedFacilityToPlace];
              // Calculate actual grid coordinates
              const point = pointerInfo.pickInfo?.pickedPoint;
              if (point) {
                const gridX = Math.floor(point.x / CONSTANTS.CELL_SIZE);
                const gridZ = Math.floor(point.z / CONSTANTS.CELL_SIZE);
                
                // Dispatch placement event to react state
                window.dispatchEvent(new CustomEvent('onFacilityPlaced', {
                  detail: { id: state.selectedFacilityToPlace, x: gridX, z: gridZ }
                }));
              }
            }
          }
          // Right click to cancel placement
          if (pointerInfo.event.button === 2 && state.placementMode) {
             useParkState.getState().exitPlacementMode();
          }
          break;
      }
    });
  }
}
