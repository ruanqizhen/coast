import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, AbstractMesh } from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';
import { useParkState } from '../store/useParkState';
import type { PlacedFacility } from '../types';
import { FACILITIES } from '../config/facilities';

export class FacilityManager {
  private scene: Scene;
  private meshes: Map<string, AbstractMesh> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
    
    // Subscribe to state changes to spawn meshes when react state updates
    useParkState.subscribe((state, prevState) => {
      // Find new facilities
      const added = state.facilities.filter(
        f1 => !prevState.facilities.some(f2 => f1.instanceId === f2.instanceId)
      );
      // Find removed facilities
      const removed = prevState.facilities.filter(
        f1 => !state.facilities.some(f2 => f1.instanceId === f2.instanceId)
      );
      
      added.forEach(fac => this.spawnFacility(fac));
      removed.forEach(fac => this.despawnFacility(fac.instanceId));
    });
  }

  private spawnFacility(facility: PlacedFacility) {
    const def = FACILITIES[facility.typeId];
    if (!def) return;
    
    // Phase 3: Coaster Track Pieces
    if (facility.trackPieces && facility.trackPieces.length > 0) {
        // Group meshes under a parent
        const parent = new AbstractMesh(facility.instanceId, this.scene);
        
        facility.trackPieces.forEach((piece, idx) => {
            let height = piece.type === 'climb' ? 4 : piece.type === 'dive' ? 2 : piece.type === 'loop' ? 8 : 2;
            const mesh = MeshBuilder.CreateBox(`${facility.instanceId}_piece_${idx}`, { 
                width: CONSTANTS.CELL_SIZE, depth: CONSTANTS.CELL_SIZE, height 
            }, this.scene);
            
            mesh.position = new Vector3(
                piece.x * CONSTANTS.CELL_SIZE, 
                height / 2, 
                piece.z * CONSTANTS.CELL_SIZE
            );
            
            const mat = new StandardMaterial("mat_" + facility.instanceId + "_" + idx, this.scene);
            mat.diffuseColor = Color3.FromHexString("#E84855"); // Thrill Red
            mesh.material = mat;
            mesh.setParent(parent);
        });
        this.meshes.set(facility.instanceId, parent);
        return;
    }

    // Normal Facility
    const w = def.sizeX * CONSTANTS.CELL_SIZE;
    const h = def.sizeZ * CONSTANTS.CELL_SIZE;
    const height = def.category === 'thrill' ? 10 : def.category === 'shop' ? 3 : 5;
    
    const mesh = MeshBuilder.CreateBox(facility.instanceId, { width: w, depth: h, height: height }, this.scene);
    
    // Position it
    const posX = (facility.x * CONSTANTS.CELL_SIZE) + w / 2;
    const posZ = (facility.z * CONSTANTS.CELL_SIZE) + h / 2;
    mesh.position = new Vector3(posX, height / 2, posZ);
    mesh.rotation.y = facility.rotation;
    
    // Assign color based on category
    const mat = new StandardMaterial("mat_" + facility.instanceId, this.scene);
    if (def.category === 'thrill') mat.diffuseColor = Color3.FromHexString("#E84855"); // Reddish
    else if (def.category === 'gentle') mat.diffuseColor = Color3.FromHexString("#2E86AB"); // Blueish
    else if (def.category === 'shop') mat.diffuseColor = Color3.FromHexString("#F4A223"); // Yellowish
    else if (def.category === 'facility') mat.diffuseColor = Color3.FromHexString("#C8B89A"); // Grey/Brown
    
    mesh.material = mat;
    this.meshes.set(facility.instanceId, mesh);
  }

  private despawnFacility(instanceId: string) {
    const mesh = this.meshes.get(instanceId);
    if (mesh) {
      mesh.dispose();
      this.meshes.delete(instanceId);
    }
  }
}
