import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, Mesh } from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';
import { useParkState } from '../store/useParkState';
import type { PlacedFacility, FacilityDef } from '../types';
import { FACILITIES } from '../config/facilities';

export class FacilityManager {
  private scene: Scene;
  private meshes: Map<string, TransformNode | Mesh> = new Map();

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
        const rootMesh = this.createCoasterTrack(facility);
        this.meshes.set(facility.instanceId, rootMesh);
        return;
    }

    // Normal Facility
    const w = def.sizeX * CONSTANTS.CELL_SIZE;
    const h = def.sizeZ * CONSTANTS.CELL_SIZE;
    
    // Position it centrally over its grid cells
    const posX = (facility.x * CONSTANTS.CELL_SIZE) + w / 2;
    const posZ = (facility.z * CONSTANTS.CELL_SIZE) + h / 2;
    
    const rootMesh = new TransformNode(facility.instanceId, this.scene);
    rootMesh.position = new Vector3(posX, 0, posZ);
    rootMesh.rotation.y = facility.rotation;

    switch (def.category) {
        case 'shop':
            this.createShopMesh(def, rootMesh);
            break;
        case 'gentle':
            this.createGentleMesh(facility.typeId, def, rootMesh);
            break;
        case 'thrill':
            this.createThrillMesh(facility.typeId, def, rootMesh);
            break;
        case 'facility':
            this.createFacilityMesh(facility.typeId, def, rootMesh);
            break;
        case 'scenery':
            this.createSceneryMesh(facility.typeId, def, rootMesh);
            break;
        default:
            this.createGenericBox(def, rootMesh, Color3.FromHexString("#C8B89A"));
            break;
    }
    
    this.meshes.set(facility.instanceId, rootMesh);
  }

  private createCoasterTrack(facility: PlacedFacility) {
      const parent = new TransformNode(facility.instanceId, this.scene);
      facility.trackPieces!.forEach((piece, idx) => {
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
          mesh.parent = parent;
      });
      return parent;
  }

  private createShopMesh(def: FacilityDef, parent: TransformNode) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      const d = def.sizeZ * CONSTANTS.CELL_SIZE;
      
      // Base block
      const baseMat = new StandardMaterial("mat_base_" + def.id, this.scene);
      baseMat.diffuseColor = new Color3(0.85, 0.85, 0.85);
      const base = MeshBuilder.CreateBox("base", { width: w, depth: d, height: 2 }, this.scene);
      base.position.y = 1;
      base.material = baseMat;
      base.parent = parent;

      // Awning / Roof
      const roofMat = new StandardMaterial("mat_roof_" + def.id, this.scene);
      if (def.id === 'burger_stall') roofMat.diffuseColor = new Color3(0.9, 0.2, 0.2);
      else if (def.id === 'drink_stall') roofMat.diffuseColor = new Color3(0.2, 0.5, 0.9);
      else roofMat.diffuseColor = new Color3(0.8, 0.6, 0.2); // Restaurant
      
      const roof = MeshBuilder.CreateCylinder("roof", { diameter: Math.max(w, d) * 1.2, height: 1.5, tessellation: 4 }, this.scene);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 2.75;
      roof.material = roofMat;
      roof.parent = parent;
      
      // Simple cut-out window representation
      const window = MeshBuilder.CreateBox("window", { width: w * 0.8, depth: d * 1.05, height: 1 }, this.scene);
      window.position.y = 1.5;
      const winMat = new StandardMaterial("win", this.scene);
      winMat.diffuseColor = new Color3(0.2, 0.2, 0.2);
      window.material = winMat;
      window.parent = parent;
  }

  private createGentleMesh(typeId: string, def: FacilityDef, parent: TransformNode) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      const h = def.sizeZ * CONSTANTS.CELL_SIZE;

      if (typeId === 'ferris_wheel') {
          const supportMat = new StandardMaterial("sup", this.scene);
          supportMat.diffuseColor = new Color3(0.8, 0.8, 0.8);
          
          const maxDim = Math.min(w, h); // e.g. 10
          
          const leftSupport = MeshBuilder.CreateCylinder("lsup", { height: maxDim + 2, diameterTop: 0.5, diameterBottom: 2 }, this.scene);
          leftSupport.position = new Vector3(-w/3, (maxDim + 2)/2, 0);
          leftSupport.material = supportMat;
          leftSupport.parent = parent;

          const rightSupport = MeshBuilder.CreateCylinder("rsup", { height: maxDim + 2, diameterTop: 0.5, diameterBottom: 2 }, this.scene);
          rightSupport.position = new Vector3(w/3, (maxDim + 2)/2, 0);
          rightSupport.material = supportMat;
          rightSupport.parent = parent;

          const wheelMat = new StandardMaterial("wheel", this.scene);
          wheelMat.diffuseColor = new Color3(0.9, 0.2, 0.2);
          const wheel = MeshBuilder.CreateTorus("wheel", { diameter: maxDim + 2, thickness: 0.6, tessellation: 32 }, this.scene);
          wheel.position.y = (maxDim + 2)/2;
          wheel.rotation.z = Math.PI / 2;
          wheel.material = wheelMat;
          wheel.parent = parent;
          
          // Cabins
          for (let i = 0; i < 8; i++) {
              const angle = (Math.PI * 2 / 8) * i;
              const radius = (maxDim + 2) / 2;
              const cabin = MeshBuilder.CreateBox("cabin", { size: 1.5 }, this.scene);
              cabin.position = new Vector3(0, ((maxDim + 2)/2) + Math.cos(angle)*radius, Math.sin(angle)*radius);
              const cabinMat = new StandardMaterial("cmat", this.scene);
              cabinMat.diffuseColor = new Color3(0.2, 0.6, 0.9);
              cabin.material = cabinMat;
              cabin.parent = parent;
          }
      } else if (typeId === 'merry_go_round') {
          const baseMat = new StandardMaterial("baseMat", this.scene);
          baseMat.diffuseColor = new Color3(0.8, 0.3, 0.3);
          const base = MeshBuilder.CreateCylinder("base", { diameter: w, height: 1 }, this.scene);
          base.position.y = 0.5;
          base.material = baseMat;
          base.parent = parent;

          const roofMat = new StandardMaterial("roofMat", this.scene);
          roofMat.diffuseColor = new Color3(0.9, 0.8, 0.2);
          const roof = MeshBuilder.CreateCylinder("roof", { diameterTop: 0, diameterBottom: w*1.1, height: 3 }, this.scene);
          roof.position.y = 4.5;
          roof.material = roofMat;
          roof.parent = parent;
          
          const center = MeshBuilder.CreateCylinder("center", { diameter: 1, height: 4 }, this.scene);
          center.position.y = 2.5;
          center.parent = parent;
      } else {
          this.createGenericBox(def, parent, new Color3(0.2, 0.6, 0.9));
      }
  }

  private createThrillMesh(typeId: string, def: FacilityDef, parent: TransformNode) {
      if (typeId === 'drop_tower') {
          const towerMat = new StandardMaterial("tmat", this.scene);
          towerMat.diffuseColor = new Color3(0.7, 0.7, 0.7);
          const tower = MeshBuilder.CreateCylinder("tower", { diameter: 1.5, height: 18 }, this.scene);
          tower.position.y = 9;
          tower.material = towerMat;
          tower.parent = parent;
          
          const ring = MeshBuilder.CreateTorus("ring", { diameter: 3.5, thickness: 0.8 }, this.scene);
          ring.position.y = 4;
          const ringMat = new StandardMaterial("rmat", this.scene);
          ringMat.diffuseColor = new Color3(0.9, 0.5, 0.2);
          ring.material = ringMat;
          ring.parent = parent;
      } else if (typeId === 'pirate_ship') {
          const supMat = new StandardMaterial("smat", this.scene);
          supMat.diffuseColor = new Color3(0.8, 0.8, 0.8);
          const leftSup = MeshBuilder.CreateCylinder("lsup", { height: 10, diameterTop: 0.5, diameterBottom: 1.5 }, this.scene);
          leftSup.position = new Vector3(-2, 5, 0);
          leftSup.material = supMat;
          leftSup.parent = parent;
          
          const rightSup = MeshBuilder.CreateCylinder("rsup", { height: 10, diameterTop: 0.5, diameterBottom: 1.5 }, this.scene);
          rightSup.position = new Vector3(2, 5, 0);
          rightSup.material = supMat;
          rightSup.parent = parent;
          
          const boat = MeshBuilder.CreateBox("boat", { width: 3, height: 2, depth: 6 }, this.scene);
          boat.position.y = 2;
          const bMat = new StandardMaterial("bmat", this.scene);
          bMat.diffuseColor = new Color3(0.6, 0.4, 0.2);
          boat.material = bMat;
          boat.parent = parent;
      } else {
          this.createGenericBox(def, parent, new Color3(0.9, 0.2, 0.2));
      }
  }

  private createFacilityMesh(typeId: string, def: FacilityDef, parent: TransformNode) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      const d = def.sizeZ * CONSTANTS.CELL_SIZE;

      const mMat = new StandardMaterial("fmat", this.scene);
      mMat.diffuseColor = typeId === 'first_aid' ? new Color3(0.9, 0.9, 0.9) : new Color3(0.6, 0.7, 0.6);

      const base = MeshBuilder.CreateBox("base", { width: w, depth: d, height: 3 }, this.scene);
      base.position.y = 1.5;
      base.material = mMat;
      base.parent = parent;

      const roof = MeshBuilder.CreateCylinder("roof", { diameter: Math.max(w,d)*1.2, height: 1.5, tessellation: 4 }, this.scene);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 3.75;
      const rMat = new StandardMaterial("rmat", this.scene);
      rMat.diffuseColor = typeId === 'first_aid' ? new Color3(0.8, 0.2, 0.2) : new Color3(0.4, 0.4, 0.4);
      roof.material = rMat;
      roof.parent = parent;
  }

  private createSceneryMesh(typeId: string, def: FacilityDef, parent: TransformNode) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      
      if (typeId === 'bench') {
          const plank = MeshBuilder.CreateBox("plank", { width: 1.8, depth: 0.6, height: 0.1 }, this.scene);
          plank.position.y = 0.5;
          const pMat = new StandardMaterial("pMat", this.scene);
          pMat.diffuseColor = new Color3(0.6, 0.4, 0.2);
          plank.material = pMat;
          plank.parent = parent;
          
          const leg1 = MeshBuilder.CreateBox("leg1", { width: 0.1, depth: 0.5, height: 0.5 }, this.scene);
          leg1.position = new Vector3(-0.7, 0.25, 0);
          leg1.parent = parent;
          
          const leg2 = MeshBuilder.CreateBox("leg2", { width: 0.1, depth: 0.5, height: 0.5 }, this.scene);
          leg2.position = new Vector3(0.7, 0.25, 0);
          leg2.parent = parent;
      } else if (typeId === 'trash_can') {
          const can = MeshBuilder.CreateCylinder("can", { diameter: 0.8, height: 1.2 }, this.scene);
          can.position.y = 0.6;
          const cMat = new StandardMaterial("cMat", this.scene);
          cMat.diffuseColor = new Color3(0.3, 0.3, 0.4);
          can.material = cMat;
          can.parent = parent;
      } else if (typeId === 'fountain') {
          const pool = MeshBuilder.CreateCylinder("pool", { diameter: w, height: 0.5 }, this.scene);
          pool.position.y = 0.25;
          const pMat = new StandardMaterial("pMat", this.scene);
          pMat.diffuseColor = new Color3(0.8, 0.8, 0.8);
          pool.material = pMat;
          pool.parent = parent;
          
          const water = MeshBuilder.CreateCylinder("water", { diameter: w*0.9, height: 0.51 }, this.scene);
          water.position.y = 0.255;
          const wMat = new StandardMaterial("wMat", this.scene);
          wMat.diffuseColor = new Color3(0.2, 0.6, 0.9);
          wMat.alpha = 0.8;
          water.material = wMat;
          water.parent = parent;
          
          const spout = MeshBuilder.CreateCylinder("spout", { diameter: 0.5, height: 2 }, this.scene);
          spout.position.y = 1;
          spout.material = pMat;
          spout.parent = parent;
      } else {
          this.createGenericBox(def, parent, new Color3(0.4, 0.8, 0.4));
      }
  }

  private createGenericBox(def: FacilityDef, parent: TransformNode, color: Color3) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      const h = def.sizeZ * CONSTANTS.CELL_SIZE;
      const height = def.category === 'thrill' ? 10 : def.category === 'shop' ? 3 : 5;
      
      const mesh = MeshBuilder.CreateBox("gen", { width: w, depth: h, height: height }, this.scene);
      mesh.position = new Vector3(0, height / 2, 0);
      
      const mat = new StandardMaterial("genMat", this.scene);
      mat.diffuseColor = color;
      mesh.material = mat;
      mesh.parent = parent;
  }

  private despawnFacility(instanceId: string) {
    const mesh = this.meshes.get(instanceId);
    if (mesh) {
      mesh.dispose();
      this.meshes.delete(instanceId);
    }
  }
}
