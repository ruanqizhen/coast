import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, Mesh, ShadowGenerator, CSG } from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';
import { useParkState } from '../store/useParkState';
import type { PlacedFacility, FacilityDef } from '../types';
import { FACILITIES } from '../config/facilities';

export class FacilityManager {
  private scene: Scene;
  private shadowGen: ShadowGenerator;
  private meshes: Map<string, TransformNode | Mesh> = new Map();
  private templates: Map<string, Mesh> = new Map();

  constructor(scene: Scene, shadowGen: ShadowGenerator) {
    this.scene = scene;
    this.shadowGen = shadowGen;
    
    useParkState.subscribe((state, prevState) => {
      const added = state.facilities.filter(
        f1 => !prevState.facilities.some(f2 => f1.instanceId === f2.instanceId)
      );
      const removed = prevState.facilities.filter(
        f1 => !state.facilities.some(f2 => f1.instanceId === f2.instanceId)
      );
      added.forEach(fac => this.spawnFacility(fac));
      removed.forEach(fac => this.despawnFacility(fac.instanceId));
    });
  }

  private registerShadows(mesh: Mesh) {
      if (this.shadowGen) {
          this.shadowGen.addShadowCaster(mesh, true);
      }
      mesh.receiveShadows = true;
  }

  private getPBR(name: string, color: Color3, metallic: number = 0.1, roughness: number = 0.8): StandardMaterial {
      void roughness; // Placeholder for future physical material upgrade
      const mat = new StandardMaterial(name, this.scene);
      mat.diffuseColor = color;
      if (metallic > 0.5) {
          mat.specularColor = new Color3(0.5, 0.5, 0.5);
          mat.specularPower = 32;
      } else {
          mat.specularColor = new Color3(0.1, 0.1, 0.1);
          mat.specularPower = 16;
      }
      return mat;
  }

  private spawnFacility(facility: PlacedFacility) {
    const def = FACILITIES[facility.typeId];
    if (!def) return;
    
    if (facility.trackPieces && facility.trackPieces.length > 0) {
        const rootMesh = this.createCoasterTrack(facility);
        this.meshes.set(facility.instanceId, rootMesh);
        return;
    }

    const w = def.sizeX * CONSTANTS.CELL_SIZE;
    const h = def.sizeZ * CONSTANTS.CELL_SIZE;
    const posX = (facility.x * CONSTANTS.CELL_SIZE) + w / 2;
    const posZ = (facility.z * CONSTANTS.CELL_SIZE) + h / 2;

    let template = this.templates.get(facility.typeId);

    if (!template) {
        const dummyParent = new TransformNode("dummy", this.scene);
        switch (def.category) {
            case 'shop':
                this.createShopMesh(def, dummyParent);
                break;
            case 'gentle':
                this.createGentleMesh(facility.typeId, def, dummyParent);
                break;
            case 'thrill':
                this.createThrillMesh(facility.typeId, def, dummyParent);
                break;
            case 'facility':
                this.createFacilityMesh(facility.typeId, def, dummyParent);
                break;
            case 'scenery':
                this.createSceneryMesh(facility.typeId, def, dummyParent);
                break;
            default:
                this.createGenericBox(def, dummyParent, Color3.FromHexString("#C8B89A"));
                break;
        }

        const childMeshes = dummyParent.getChildMeshes() as Mesh[];
        if (childMeshes.length > 0) {
            // Remove from dummy parent so they merge purely in world space around origin
            childMeshes.forEach(m => m.setParent(null));
            // Merge all child primitives and CSG results into one Instancing Master template
            template = Mesh.MergeMeshes(childMeshes, true, true, undefined, false, true) as Mesh;
            if (template) {
                template.isVisible = false;
                this.registerShadows(template);
                this.templates.set(facility.typeId, template);
            }
        }
        dummyParent.dispose();
    }

    if (template) {
        const instance = template.createInstance(facility.instanceId);
        instance.position = new Vector3(posX, 0, posZ);
        instance.rotation.y = facility.rotation;
        
        if (this.shadowGen) {
            this.shadowGen.addShadowCaster(instance, true);
        }
        // receiveShadows is inherited from the template by Babylon JS InstancedMesh
        
        this.meshes.set(facility.instanceId, instance);
    }
  }

  private createCoasterTrack(facility: PlacedFacility) {
      const parent = new TransformNode(facility.instanceId, this.scene);
      facility.trackPieces!.forEach((piece, idx) => {
          let height = piece.type === 'climb' ? 4 : piece.type === 'dive' ? 2 : piece.type === 'loop' ? 8 : 2;
          const mesh = MeshBuilder.CreateBox(`${facility.instanceId}_piece_${idx}`, { 
              width: CONSTANTS.CELL_SIZE * 0.8, depth: CONSTANTS.CELL_SIZE * 0.8, height 
          }, this.scene);
          
          mesh.position = new Vector3(piece.x * CONSTANTS.CELL_SIZE, height / 2, piece.z * CONSTANTS.CELL_SIZE);
          mesh.material = this.getPBR("trkMat", Color3.FromHexString("#E84855"), 0.8, 0.3); // Metallic Red
          mesh.parent = parent;
          this.registerShadows(mesh);
      });
      return parent;
  }

  private createShopMesh(def: FacilityDef, parent: TransformNode) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      const d = def.sizeZ * CONSTANTS.CELL_SIZE;
      const h = 2.5;

      // Create outer box
      const outerBox = MeshBuilder.CreateBox("outer", { width: w, depth: d, height: h }, this.scene);
      outerBox.position.y = h / 2;

      // Create inner box for hollow
      const innerBox = MeshBuilder.CreateBox("inner", { width: w * 0.9, depth: d * 0.9, height: h * 0.9 }, this.scene);
      innerBox.position.y = h / 2;

      // Create window cutter
      const cutter = MeshBuilder.CreateBox("cutter", { width: w * 0.8, depth: d * 1.1, height: 1.2 }, this.scene);
      cutter.position.y = 1.6;

      const csgOuter = CSG.FromMesh(outerBox);
      const csgInner = CSG.FromMesh(innerBox);
      const csgCutter = CSG.FromMesh(cutter);

      // Subtract inner room and front window
      let csgResult = csgOuter.subtract(csgInner).subtract(csgCutter);

      let finalBase = csgResult.toMesh(def.id + "base", null, this.scene);
      finalBase.material = this.getPBR("shopBase", new Color3(0.9, 0.9, 0.9), 0.05, 0.9);
      finalBase.parent = parent;
      this.registerShadows(finalBase);

      outerBox.dispose();
      innerBox.dispose();
      cutter.dispose();

      // Inside counter counter
      const counter = MeshBuilder.CreateBox("cntr", { width: w * 0.8, depth: d * 0.2, height: 1 }, this.scene);
      counter.position.y = 0.5;
      counter.position.z = - (d / 2) * 0.8;
      counter.material = this.getPBR("cntrMat", new Color3(0.4, 0.2, 0.1), 0.1, 0.8);
      counter.parent = parent;
      this.registerShadows(counter);

      // Awning / Roof
      const roofColor = def.id === 'burger_stall' ? new Color3(0.9, 0.2, 0.2) : 
                        def.id === 'drink_stall' ? new Color3(0.2, 0.5, 0.9) : new Color3(0.8, 0.6, 0.2);
                        
      const roof = MeshBuilder.CreateCylinder("roof", { diameter: Math.max(w, d) * 1.3, height: 1.5, tessellation: 4 }, this.scene);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = h + 0.75;
      roof.material = this.getPBR("roofMat", roofColor, 0.1, 0.8);
      roof.parent = parent;
      this.registerShadows(roof);
  }

  private createGentleMesh(typeId: string, def: FacilityDef, parent: TransformNode) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      const h = def.sizeZ * CONSTANTS.CELL_SIZE;

      if (typeId === 'ferris_wheel') {
          const maxDim = Math.min(w, h);
          const r = (maxDim + 2) / 2;
          
          const supMat = this.getPBR("sup", new Color3(0.8, 0.8, 0.8), 0.9, 0.4);
          
          // Truss supports
          const createTrussLeg = (name: string, pos: Vector3, rotZ: number) => {
              const leg = MeshBuilder.CreateCylinder(name, { height: r * 2.2, diameterTop: 0.3, diameterBottom: 0.8 }, this.scene);
              leg.position = pos;
              leg.rotation.z = rotZ;
              leg.material = supMat;
              leg.parent = parent;
              this.registerShadows(leg);
          };

          createTrussLeg("l1", new Vector3(-w/3, r, 2),  0.2);
          createTrussLeg("l2", new Vector3(-w/3, r, -2), -0.2);
          createTrussLeg("r1", new Vector3(w/3, r, 2),   0.2);
          createTrussLeg("r2", new Vector3(w/3, r, -2),  -0.2);

          const wheelMat = this.getPBR("wheel", new Color3(0.9, 0.2, 0.2), 0.8, 0.3);
          const wheel = MeshBuilder.CreateTorus("wheel", { diameter: maxDim + 2, thickness: 0.4, tessellation: 64 }, this.scene);
          wheel.position.y = r + 2;
          wheel.rotation.z = Math.PI / 2;
          wheel.material = wheelMat;
          wheel.parent = parent;
          this.registerShadows(wheel);
          
          // Spokes
          for (let i = 0; i < 8; i++) {
              const spoke = MeshBuilder.CreateCylinder("spoke", { height: maxDim+2, diameter: 0.1}, this.scene);
              spoke.rotation.z = Math.PI/2;
              spoke.rotation.y = (Math.PI / 8) * i;
              spoke.position.y = r + 2;
              spoke.material = wheelMat;
              spoke.parent = parent;
              this.registerShadows(spoke);
          }

          const cabMat = this.getPBR("cab", new Color3(0.2, 0.6, 0.9), 0.4, 0.6);
          for (let i = 0; i < 16; i++) {
              const angle = (Math.PI * 2 / 16) * i;
              const cabin = MeshBuilder.CreateSphere("cabin", { diameter: 1.5, segments: 16 }, this.scene);
              cabin.position = new Vector3(0, (r+2) + Math.cos(angle)*r, Math.sin(angle)*r);
              cabin.material = cabMat;
              cabin.parent = parent;
              this.registerShadows(cabin);
          }
      } else if (typeId === 'merry_go_round') {
          const base = MeshBuilder.CreateCylinder("base", { diameter: w, height: 1 }, this.scene);
          base.position.y = 0.5;
          base.material = this.getPBR("baseMat", new Color3(0.8, 0.3, 0.3), 0.1, 0.8);
          base.parent = parent;
          this.registerShadows(base);

          const roof = MeshBuilder.CreateCylinder("roof", { diameterTop: 0, diameterBottom: w*1.1, height: 3 }, this.scene);
          roof.position.y = 4.5;
          roof.material = this.getPBR("rMat", new Color3(0.9, 0.8, 0.2), 0.5, 0.5);
          roof.parent = parent;
          this.registerShadows(roof);
          
          const center = MeshBuilder.CreateCylinder("center", { diameter: 1.5, height: 4 }, this.scene);
          center.position.y = 2.5;
          center.material = this.getPBR("cMat", new Color3(0.9, 0.9, 0.9), 1, 0.2); // Mirror center
          center.parent = parent;
          this.registerShadows(center);
      } else {
          this.createGenericBox(def, parent, new Color3(0.2, 0.6, 0.9));
      }
  }

  private createThrillMesh(typeId: string, def: FacilityDef, parent: TransformNode) {
      if (typeId === 'drop_tower') {
          const tMat = this.getPBR("tmat", new Color3(0.7, 0.7, 0.7), 0.9, 0.3);
          
          // Lattice tower
          for (let i=0; i<4; i++) {
              const post = MeshBuilder.CreateCylinder("post", { diameter: 0.4, height: 24 }, this.scene);
              post.position.x = (i%2===0) ? -0.8 : 0.8;
              post.position.z = (i<2) ? -0.8 : 0.8;
              post.position.y = 12;
              post.material = tMat;
              post.parent = parent;
              this.registerShadows(post);
          }
          for (let y=2; y<23; y+=2) {
              const brace = MeshBuilder.CreateBox("br", { width: 2, height: 0.2, depth: 2}, this.scene);
              brace.position.y = y;
              brace.material = tMat;
              brace.parent = parent;
              this.registerShadows(brace);
          }
          
          const ring = MeshBuilder.CreateTorus("ring", { diameter: 4, thickness: 1.2 }, this.scene);
          ring.position.y = 4;
          ring.material = this.getPBR("rmat", new Color3(0.9, 0.5, 0.2), 0.2, 0.6);
          ring.parent = parent;
          this.registerShadows(ring);
      } else if (typeId === 'pirate_ship') {
          const sMat = this.getPBR("smat", new Color3(0.8, 0.8, 0.8), 1.0, 0.4);
          
          const lSup = MeshBuilder.CreateCylinder("lsup", { height: 12, diameterTop: 0.5, diameterBottom: 2 }, this.scene);
          lSup.position = new Vector3(-2.5, 6, 0);
          lSup.material = sMat;
          lSup.parent = parent;
          this.registerShadows(lSup);
          
          const rSup = MeshBuilder.CreateCylinder("rsup", { height: 12, diameterTop: 0.5, diameterBottom: 2 }, this.scene);
          rSup.position = new Vector3(2.5, 6, 0);
          rSup.material = sMat;
          rSup.parent = parent;
          this.registerShadows(rSup);
          
          const axis = MeshBuilder.CreateCylinder("axis", { height: 6, diameter: 0.4}, this.scene);
          axis.rotation.z = Math.PI/2;
          axis.position.y = 12;
          axis.material = sMat;
          axis.parent = parent;
          this.registerShadows(axis);

          const boat = MeshBuilder.CreateBox("boat", { width: 3.5, height: 2.5, depth: 8 }, this.scene);
          boat.position.y = 3;
          boat.material = this.getPBR("bmat", new Color3(0.5, 0.3, 0.1), 0.1, 0.9); // wood
          boat.parent = parent;
          this.registerShadows(boat);
      } else {
          this.createGenericBox(def, parent, new Color3(0.9, 0.2, 0.2));
      }
  }

  private createFacilityMesh(typeId: string, def: FacilityDef, parent: TransformNode) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      const d = def.sizeZ * CONSTANTS.CELL_SIZE;

      // Outer house
      const outer = MeshBuilder.CreateBox("out", { width: w*0.9, depth: d*0.9, height: 3 }, this.scene);
      outer.position.y = 1.5;

      const inner = MeshBuilder.CreateBox("in", { width: w*0.8, depth: d*0.8, height: 3 }, this.scene);
      inner.position.y = 1.5;

      // Doors
      const door = MeshBuilder.CreateBox("door", { width: 1.5, depth: d+1, height: 2 }, this.scene);
      door.position.y = 1;

      const csgOut = CSG.FromMesh(outer);
      const csgIn = CSG.FromMesh(inner);
      const csgDoor = CSG.FromMesh(door);

      const res = csgOut.subtract(csgIn).subtract(csgDoor);
      const finalFac = res.toMesh("fac", null, this.scene);
      finalFac.material = this.getPBR("fmat", typeId==='first_aid' ? new Color3(0.9, 0.9, 0.9) : new Color3(0.7,0.6,0.5), 0, 0.9);
      finalFac.parent = parent;
      this.registerShadows(finalFac);

      outer.dispose(); inner.dispose(); door.dispose();

      const roof = MeshBuilder.CreateCylinder("roof", { diameter: Math.max(w,d)*1.1, height: 1.5, tessellation: 4 }, this.scene);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 3.75;
      roof.material = this.getPBR("rmat", typeId==='first_aid' ? new Color3(0.8, 0.2, 0.2) : new Color3(0.3, 0.3, 0.3), 0.1, 0.8);
      roof.parent = parent;
      this.registerShadows(roof);
  }

  private createSceneryMesh(typeId: string, def: FacilityDef, parent: TransformNode) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      if (typeId === 'bench') {
          const woodMat = this.getPBR("wood", new Color3(0.5, 0.3, 0.1), 0.0, 0.9);
          const metalMat = this.getPBR("met", new Color3(0.15, 0.15, 0.15), 0.8, 0.5);

          // Wood slats for seat
          for(let i=0; i<3; i++) {
              const slat = MeshBuilder.CreateBox("slat", { width: 1.8, depth: 0.15, height: 0.05 }, this.scene);
              slat.position = new Vector3(0, 0.4, -0.2 + i * 0.2);
              slat.material = woodMat;
              slat.parent = parent;
              this.registerShadows(slat);
          }
          // Wood slats for backrest
          for(let i=0; i<2; i++) {
              const back = MeshBuilder.CreateBox("back", { width: 1.8, depth: 0.15, height: 0.05 }, this.scene);
              back.rotation.x = -Math.PI / 8;
              back.position = new Vector3(0, 0.55 + i * 0.18, 0.35 + i * 0.05);
              back.material = woodMat;
              back.parent = parent;
              this.registerShadows(back);
          }

          // Frame / Legs
          const createFrame = (x: number) => {
              const leg = MeshBuilder.CreateBox("leg", { width: 0.08, depth: 0.5, height: 0.4 }, this.scene);
              leg.position = new Vector3(x, 0.2, 0);
              leg.material = metalMat;
              leg.parent = parent;
              this.registerShadows(leg);

              const backSupport = MeshBuilder.CreateBox("bsup", { width: 0.08, depth: 0.08, height: 0.5 }, this.scene);
              backSupport.rotation.x = -Math.PI / 8;
              backSupport.position = new Vector3(x, 0.6, 0.4);
              backSupport.material = metalMat;
              backSupport.parent = parent;
              this.registerShadows(backSupport);
              
              const armRest = MeshBuilder.CreateBox("arm", { width: 0.08, depth: 0.6, height: 0.05 }, this.scene);
              armRest.position = new Vector3(x, 0.5, 0);
              armRest.material = metalMat;
              armRest.parent = parent;
              this.registerShadows(armRest);
          };
          createFrame(-0.8);
          createFrame(0.8);
      } else if (typeId === 'trash_can') {
          const mMat = this.getPBR("mMat", new Color3(0.2, 0.2, 0.2), 0.9, 0.5); // Dark metal
          
          const base = MeshBuilder.CreateCylinder("base", { diameter: 0.8, height: 0.05 }, this.scene);
          base.position.y = 0.025;
          base.material = mMat;
          base.parent = parent;
          this.registerShadows(base);

          const body = MeshBuilder.CreateCylinder("body", { diameter: 0.75, height: 0.9 }, this.scene);
          body.position.y = 0.5;
          body.material = mMat;
          body.parent = parent;
          this.registerShadows(body);
          
          const hoodOut = MeshBuilder.CreateCylinder("hood1", { diameterTop: 0.6, diameterBottom: 0.8, height: 0.3 }, this.scene);
          hoodOut.position.y = 1.1;
          const hoodIn = MeshBuilder.CreateCylinder("hood2", { diameterTop: 0.5, diameterBottom: 0.7, height: 0.4 }, this.scene);
          hoodIn.position.y = 1.05;
          const hole = MeshBuilder.CreateBox("hole", { width: 0.5, depth: 1, height: 0.2 }, this.scene);
          hole.position.y = 1.15;
          
          const csgOut = CSG.FromMesh(hoodOut);
          const csgIn = CSG.FromMesh(hoodIn);
          const csgHole = CSG.FromMesh(hole);
          
          const finalHood = csgOut.subtract(csgIn).subtract(csgHole).toMesh("hood", null, this.scene);
          finalHood.material = this.getPBR("hoodMat", new Color3(0.1, 0.3, 0.8), 0.8, 0.4); // Blue metal hood
          finalHood.parent = parent;
          this.registerShadows(finalHood);
          
          hoodOut.dispose(); hoodIn.dispose(); hole.dispose();
      } else if (typeId === 'fountain') {
          const pool = MeshBuilder.CreateCylinder("pool", { diameter: w, height: 0.5 }, this.scene);
          pool.position.y = 0.25;
          pool.material = this.getPBR("rMat", new Color3(0.8, 0.8, 0.8), 0.1, 0.8);
          pool.parent = parent;
          this.registerShadows(pool);
          
          const water = MeshBuilder.CreateCylinder("water", { diameter: w*0.9, height: 0.51 }, this.scene);
          water.position.y = 0.255;
          water.material = this.getPBR("wMat", new Color3(0.2, 0.6, 0.9), 1.0, 0.0); // very shiny water
          water.parent = parent;
          this.registerShadows(water);
      } else {
          this.createGenericBox(def, parent, new Color3(0.4, 0.8, 0.4));
      }
  }

  private createGenericBox(def: FacilityDef, parent: TransformNode, color: Color3) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      const d = def.sizeZ * CONSTANTS.CELL_SIZE;
      const h = def.category === 'thrill' ? 10 : def.category === 'shop' ? 3 : 5;
      
      const mesh = MeshBuilder.CreateBox("gen", { width: w, depth: d, height: h }, this.scene);
      mesh.position = new Vector3(0, h / 2, 0);
      mesh.material = this.getPBR("genMat", color, 0.2, 0.8);
      mesh.parent = parent;
      this.registerShadows(mesh);
  }

  private despawnFacility(instanceId: string) {
    const mesh = this.meshes.get(instanceId);
    if (mesh) {
      mesh.dispose();
      this.meshes.delete(instanceId);
    }
  }
}
