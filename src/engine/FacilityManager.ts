import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, Mesh, ShadowGenerator, CSG, Curve3, Path3D, Animation, ParticleSystem, DynamicTexture, Color4 } from '@babylonjs/core';
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

    // Bypass template merging for animated complex rides, shops, and fountains
    if (def.category === 'gentle' || def.category === 'thrill' || def.category === 'shop' || facility.typeId === 'fountain') {
        const root = new TransformNode(facility.instanceId, this.scene);
        if (def.category === 'gentle') this.createGentleMesh(facility.typeId, def, root);
        else if (def.category === 'thrill') this.createThrillMesh(facility.typeId, def, root);
        else if (def.category === 'shop') this.createShopMesh(def, root);
        else this.createSceneryMesh(facility.typeId, def, root);
        
        root.position = new Vector3(posX, 0, posZ);
        root.rotation.y = facility.rotation || 0;
        this.meshes.set(facility.instanceId, root);
        this.startFacilityAnimations(facility.typeId, root);
        return;
    }

    let template = this.templates.get(facility.typeId);

    if (!template) {
        const dummyParent = new TransformNode("dummy", this.scene);
        switch (def.category) {
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
        instance.rotation.y = facility.rotation || 0;
        
        if (this.shadowGen) {
            this.shadowGen.addShadowCaster(instance, true);
        }
        // receiveShadows is inherited from the template by Babylon JS InstancedMesh
        
        this.meshes.set(facility.instanceId, instance);
    }
  }

  private startFacilityAnimations(typeId: string, root: TransformNode) {
      if (typeId === 'ferris_wheel') {
          const wheelGroup = root.getChildMeshes().filter(m => m.name === 'wheel' || m.name === 'spoke' || m.name === 'cabin');
          if (wheelGroup.length > 0) {
              const wheelMesh = wheelGroup.find(m => m.name === 'wheel');
              const centerY = wheelMesh ? wheelMesh.position.y : 4.5;

              const wheelCore = new TransformNode("wheelCore", this.scene);
              wheelCore.parent = root;
              wheelGroup.forEach(m => m.setParent(wheelCore));

              // Set pivot to the exact center height
              wheelCore.position.y = centerY;
              wheelGroup.forEach(m => { m.position.y -= centerY; }); // center around pivot

              // Rotate entire wheel mechanism
              Animation.CreateAndStartAnimation("ferrisSpin", wheelCore, "rotation.x", 30, 1200, 0, Math.PI * 2, Animation.ANIMATIONLOOPMODE_CYCLE);

              // Counter-rotate cabins to stay upright
              const cabins = wheelGroup.filter(m => m.name === 'cabin');
              cabins.forEach((cabin, idx) => {
                  Animation.CreateAndStartAnimation(`cabSpin_${idx}`, cabin, "rotation.x", 30, 1200, 0, -Math.PI * 2, Animation.ANIMATIONLOOPMODE_CYCLE);
              });
          }
      } else if (typeId === 'drop_tower') {
          const ring = root.getChildMeshes().find(m => m.name === 'ring');
          if (ring) {
              const keys = [
                  { frame: 0, value: 4 },
                  { frame: 120, value: 21 }, // Climb
                  { frame: 180, value: 21 }, // Wait at top
                  { frame: 220, value: 4 },  // Drop
                  { frame: 300, value: 4 }   // Boarding
              ];
              const anim = new Animation("dropAnim", "position.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
              anim.setKeys(keys);
              ring.animations = [];
              ring.animations.push(anim);
              this.scene.beginAnimation(ring, 0, 300, true);
          }
      } else if (typeId === 'pirate_ship') {
          // Move the entire ship assembly onto a single swing pivot
          const pivot = new TransformNode("shipPivot", this.scene);
          pivot.parent = root;
          pivot.position.y = 12.5;

          // Reparent ALL child meshes to the pivot so everything swings together, EXCEPT the supports
          const allChildren = root.getChildMeshes();
          const excludeNames = ['lsup', 'rsup', 'axis'];
          for (const child of allChildren) {
              if (!excludeNames.includes(child.name)) {
                  const worldY = child.position.y;
                  child.setParent(pivot);
                  child.position.y = worldY - 12.5; // offset relative to pivot height
              }
          }

          const keys = [
              { frame: 0, value: 0 },
              { frame: 30, value: Math.PI / 6 },
              { frame: 60, value: Math.PI / 3 },
              { frame: 90, value: Math.PI / 6 },
              { frame: 120, value: 0 },
              { frame: 150, value: -Math.PI / 6 },
              { frame: 180, value: -Math.PI / 3 },
              { frame: 210, value: -Math.PI / 6 },
              { frame: 240, value: 0 }
          ];

          const anim = new Animation("swingAnim", "rotation.x", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
          anim.setKeys(keys);

          pivot.animations = [];
          pivot.animations.push(anim);
          this.scene.beginAnimation(pivot, 0, 240, true);
      } else if (typeId === 'merry_go_round') {
          // Spin the entire carousel around its center
          const spin = new TransformNode("carouselSpin", this.scene);
          spin.parent = root;

          const allChildren = root.getChildMeshes();
          for (const child of allChildren) {
              child.setParent(spin);
          }

          Animation.CreateAndStartAnimation("carouselRotate", spin, "rotation.y", 30, 300, 0, Math.PI * 2, Animation.ANIMATIONLOOPMODE_CYCLE);
      } else if (typeId === 'burger_stall' || typeId === 'drink_stall' || typeId === 'restaurant') {
          const signParent = root.getChildTransformNodes().find(n => n.name === 'shopSign');
          if (signParent) {
              Animation.CreateAndStartAnimation("signSpin", signParent, "rotation.y", 30, 180, 0, Math.PI * 2, Animation.ANIMATIONLOOPMODE_CYCLE);
          }
      } else if (typeId === 'fountain') {
          // Add Particle System
          const ps = new ParticleSystem("fountainParticles", 1000, this.scene);
          // Create a soft white dot texture
          const pt = new DynamicTexture("ptex", 64, this.scene, false);
          const ctx = pt.getContext();
          ctx.beginPath();
          ctx.arc(32, 32, 30, 0, Math.PI * 2);
          ctx.fillStyle = "white";
          ctx.fill();
          pt.update();
          ps.particleTexture = pt;

          ps.emitter = root as any;
          ps.minEmitBox = new Vector3(-0.2, 1.5, -0.2); 
          ps.maxEmitBox = new Vector3(0.2, 1.5, 0.2);

          ps.color1 = new Color4(0.7, 0.8, 1.0, 1.0);
          ps.color2 = new Color4(0.2, 0.5, 1.0, 1.0);
          ps.colorDead = new Color4(0, 0, 0.2, 0.0);

          ps.minSize = 0.05;
          ps.maxSize = 0.15;
          ps.minLifeTime = 0.5;
          ps.maxLifeTime = 1.2;
          ps.emitRate = 200;
          ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;

          ps.gravity = new Vector3(0, -9.81, 0);
          ps.direction1 = new Vector3(-1, 5, 1);
          ps.direction2 = new Vector3(1, 5, -1);
          ps.minAngularSpeed = 0;
          ps.maxAngularSpeed = Math.PI;
          ps.minEmitPower = 0.5;
          ps.maxEmitPower = 1.0;
          ps.updateSpeed = 0.01;

          ps.start();
          
          (root as any)._particles = ps;
      }
  }

  private createCoasterTrack(facility: PlacedFacility) {
      const parent = new TransformNode(facility.instanceId, this.scene);
      const trackPoints: Vector3[] = [];
      let currentHeight = 2;
      
      const pieces = facility.trackPieces || [];
      if (pieces.length === 0) return parent;

      pieces.forEach((piece) => {
          if (piece.type === 'climb') {
              currentHeight += 4;
          } else if (piece.type === 'dive') {
              currentHeight -= 4;
          }
          
          let px = piece.x * CONSTANTS.CELL_SIZE;
          let pz = piece.z * CONSTANTS.CELL_SIZE;
          
          if (piece.type === 'loop') {
              const rad = (piece.rotation * Math.PI) / 180;
              const fwdX = Math.sin(rad);
              const fwdZ = Math.cos(rad);
              const loopRadius = 6;
              const pointsInLoop = 12;
              
              for (let i = 0; i <= pointsInLoop; i++) {
                  const angle = (i / pointsInLoop) * Math.PI * 2;
                  const zArc = -Math.sin(angle) * loopRadius; 
                  const yArc = (1 - Math.cos(angle)) * loopRadius;
                  
                  trackPoints.push(new Vector3(
                      px + fwdX * zArc,
                      currentHeight + yArc,
                      pz + fwdZ * zArc
                  ));
              }
          } else {
             // Calculate bank based on slopeAngle if any (placeholder logic for node mapping)
             // We just add simple positional nodes
             trackPoints.push(new Vector3(px, currentHeight, pz));
          }
      });
      
      if (trackPoints.length < 2) return parent;

      // Ensure points don't perfectly overlap if duplicate
      for (let i = 1; i < trackPoints.length; i++) {
          if (trackPoints[i].equals(trackPoints[i-1])) {
              trackPoints[i].addInPlace(new Vector3(0.01, 0, 0.01));
          }
      }

      // Check loop closure dynamically
      const isClosed = trackPoints.length > 3 && Vector3.Distance(trackPoints[0], trackPoints[trackPoints.length - 1]) < CONSTANTS.CELL_SIZE;
      const spline = Curve3.CreateCatmullRomSpline(trackPoints, 15, isClosed);
      const points = spline.getPoints();

      const spineMat = this.getPBR("spineMat", Color3.FromHexString("#222222"), 0.5);
      const railMat = this.getPBR("railMat", Color3.FromHexString("#E84855"), 0.8);
      
      // Main Center Spine
      const spineTube = MeshBuilder.CreateTube(`${facility.instanceId}_spine`, {
          path: points,
          radius: 0.25,
          tessellation: 12,
          updatable: false
      }, this.scene);
      spineTube.material = spineMat;
      spineTube.parent = parent;
      this.registerShadows(spineTube);

      // Orthogonal Left/Right Rails
      const path3d = new Path3D(points);
      const curve = path3d.getCurve();
      const binormals = path3d.getBinormals();
      const normals = path3d.getNormals();

      const railOffset = 0.5;
      const railUpOffset = 0.3;
      
      const leftRailPoints: Vector3[] = [];
      const rightRailPoints: Vector3[] = [];
      
      for (let i = 0; i < curve.length; i++) {
          const pt = curve[i];
          const bn = binormals[i];
          const up = normals[i]; 
          leftRailPoints.push(pt.add(bn.scale(railOffset)).add(up.scale(railUpOffset)));
          rightRailPoints.push(pt.add(bn.scale(-railOffset)).add(up.scale(railUpOffset)));
      }

      const leftTube = MeshBuilder.CreateTube(`${facility.instanceId}_left`, {
          path: leftRailPoints, radius: 0.1, tessellation: 8
      }, this.scene);
      leftTube.material = railMat;
      leftTube.parent = parent;
      this.registerShadows(leftTube);

      const rightTube = MeshBuilder.CreateTube(`${facility.instanceId}_right`, {
          path: rightRailPoints, radius: 0.1, tessellation: 8
      }, this.scene);
      rightTube.material = railMat;
      rightTube.parent = parent;
      this.registerShadows(rightTube);

      // Support Columns (placing every 15th node)
      const columnMat = this.getPBR("colMat", new Color3(0.8, 0.8, 0.8), 0.1);
      for (let i = 0; i < curve.length; i += 15) {
          const pt = curve[i];
          const height = pt.y;
          if (height > 0.5) {
              const col = MeshBuilder.CreateCylinder("col", { height, diameter: 0.3 }, this.scene);
              col.position = new Vector3(pt.x, height / 2, pt.z);
              col.material = columnMat;
              col.parent = parent;
              this.registerShadows(col);
          }
      }

      return parent;
  }

  private createShopMesh(def: FacilityDef, parent: TransformNode) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      const d = def.sizeZ * CONSTANTS.CELL_SIZE;
      const h = 2.5;

      // Outer house (brick/wood material)
      const outerBox = MeshBuilder.CreateBox("outer", { width: w, depth: d, height: h }, this.scene);
      outerBox.position.y = h / 2;

      // Inner hollow
      const innerBox = MeshBuilder.CreateBox("inner", { width: w * 0.9, depth: d * 0.9, height: h * 0.9 }, this.scene);
      innerBox.position.y = h / 2;

      // Front Window cut
      const cutter = MeshBuilder.CreateBox("cutter", { width: w * 0.8, depth: d * 1.1, height: 1.2 }, this.scene);
      cutter.position.y = 1.6;

      const csgOuter = CSG.FromMesh(outerBox);
      const csgInner = CSG.FromMesh(innerBox);
      const csgCutter = CSG.FromMesh(cutter);

      let csgResult = csgOuter.subtract(csgInner).subtract(csgCutter);

      let finalBase = csgResult.toMesh(def.id + "base", null, this.scene);
      finalBase.material = this.getPBR("shopBase", new Color3(0.8, 0.7, 0.6), 0.2, 0.9);
      finalBase.parent = parent;
      this.registerShadows(finalBase);

      outerBox.dispose();
      innerBox.dispose();
      cutter.dispose();

      // Front Counter
      const counter = MeshBuilder.CreateBox("cntr", { width: w * 0.8, depth: d * 0.2, height: 1 }, this.scene);
      counter.position.y = 0.5;
      counter.position.z = -d / 2 + (d * 0.1);
      counter.material = this.getPBR("cntrMat", new Color3(0.4, 0.2, 0.1), 0.1, 0.9);
      counter.parent = parent;
      this.registerShadows(counter);

      // Glass Pane
      const glass = MeshBuilder.CreateBox("glass", { width: w * 0.8, depth: 0.05, height: 1.2 }, this.scene);
      glass.position.y = 1.6;
      glass.position.z = -d / 2 + 0.1;
      const glassMat = new StandardMaterial("glassMat", this.scene);
      glassMat.diffuseColor = new Color3(0.5, 0.8, 1.0);
      glassMat.alpha = 0.4;
      glassMat.specularColor = new Color3(1, 1, 1);
      glass.material = glassMat;
      glass.parent = parent;

      // Awning (Sloped roof over window)
      const awning = MeshBuilder.CreateCylinder("awning", { diameter: 1.5, height: w * 0.85, tessellation: 3 }, this.scene);
      awning.rotation.z = Math.PI / 2;
      awning.rotation.x = Math.PI / 6;
      awning.position.y = h;
      awning.position.z = -d / 2;
      awning.material = this.getPBR("awningMat", new Color3(0.9, 0.2, 0.2), 0.8, 0.4);
      awning.parent = parent;
      this.registerShadows(awning);

      // Roof (Flat)
      const roof = MeshBuilder.CreateBox("roof", { width: w * 1.05, depth: d * 1.05, height: 0.2 }, this.scene);
      roof.position.y = h + 0.1;
      roof.material = this.getPBR("roofMat", new Color3(0.2, 0.2, 0.2), 0.5, 0.5);
      roof.parent = parent;
      this.registerShadows(roof);

      // Animated Roof Sign
      const signParent = new TransformNode("shopSign", this.scene);
      signParent.parent = parent;
      signParent.position.y = h + 1.2;

      if (def.id === 'burger_stall') {
          const bunB = MeshBuilder.CreateSphere("bunB", { diameter: 1.5, slice: 0.5 }, this.scene);
          bunB.rotation.x = Math.PI;
          bunB.position.y = -0.2;
          bunB.material = this.getPBR("bunMat", new Color3(0.9, 0.6, 0.2), 0.8, 0.8);
          bunB.parent = signParent;
          
          const patty = MeshBuilder.CreateCylinder("patty", { diameter: 1.6, height: 0.3 }, this.scene);
          patty.material = this.getPBR("pattyMat", new Color3(0.3, 0.1, 0.05), 0.5, 0.9);
          patty.parent = signParent;

          const bunT = MeshBuilder.CreateSphere("bunT", { diameter: 1.5, slice: 0.5 }, this.scene);
          bunT.position.y = 0.2;
          bunT.material = bunB.material;
          bunT.parent = signParent;
      } else if (def.id === 'drink_stall') {
          const cup = MeshBuilder.CreateCylinder("cup", { diameterTop: 1.2, diameterBottom: 0.8, height: 1.8 }, this.scene);
          cup.material = this.getPBR("cupMat", new Color3(0.2, 0.6, 0.9), 0.2, 0.5);
          cup.parent = signParent;

          const straw = MeshBuilder.CreateCylinder("straw", { diameter: 0.1, height: 1.5 }, this.scene);
          straw.position.y = 1.2;
          straw.position.x = 0.3;
          straw.rotation.z = Math.PI / 8;
          straw.material = this.getPBR("strawMat", new Color3(0.9, 0.1, 0.1), 0.5, 0.5);
          straw.parent = signParent;
      } else {
          const diamond = MeshBuilder.CreatePolyhedron("diamond", { type: 1, size: 0.8 }, this.scene);
          diamond.material = this.getPBR("diaMat", new Color3(0.9, 0.8, 0.2), 0.5, 0.2);
          diamond.parent = signParent;
      }
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
              spoke.rotation.x = (Math.PI / 8) * i;
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
          // Base platform with gold trim
          const base = MeshBuilder.CreateCylinder("base", { diameter: w, height: 0.6 }, this.scene);
          base.position.y = 0.3;
          base.material = this.getPBR("baseMat", new Color3(0.8, 0.3, 0.3), 0.1, 0.8);
          base.parent = parent;
          this.registerShadows(base);

          // Base trim ring
          const trim = MeshBuilder.CreateTorus("trim", { diameter: w, thickness: 0.15, tessellation: 48 }, this.scene);
          trim.position.y = 0.6;
          trim.material = this.getPBR("trimMat", new Color3(0.9, 0.8, 0.2), 0.8, 0.3);
          trim.parent = parent;

          // Center pole
          const center = MeshBuilder.CreateCylinder("center", { diameter: 0.6, height: 4.5 }, this.scene);
          center.position.y = 2.85;
          center.material = this.getPBR("cMat", new Color3(0.9, 0.9, 0.9), 0.9, 0.2);
          center.parent = parent;
          this.registerShadows(center);

          // Conical roof
          const roof = MeshBuilder.CreateCylinder("roof", { diameterTop: 0, diameterBottom: w * 1.15, height: 2.5 }, this.scene);
          roof.position.y = 5.35;
          roof.material = this.getPBR("rMat", new Color3(0.9, 0.15, 0.15), 0.5, 0.5);
          roof.parent = parent;
          this.registerShadows(roof);

          // Roof trim ring
          const roofTrim = MeshBuilder.CreateTorus("roofTrim", { diameter: w * 1.15, thickness: 0.12, tessellation: 48 }, this.scene);
          roofTrim.position.y = 4.1;
          roofTrim.material = trim.material;
          roofTrim.parent = parent;

          // Roof finial (top ornament)
          const finial = MeshBuilder.CreateSphere("finial", { diameter: 0.5 }, this.scene);
          finial.position.y = 6.7;
          finial.material = this.getPBR("finialMat", new Color3(0.95, 0.85, 0.2), 0.9, 0.2);
          finial.parent = parent;

          // Horses on poles arranged in a circle
          const horseCount = 8;
          const horseRadius = (w / 2) * 0.7;
          const horseColors = [
              new Color3(0.9, 0.9, 0.85), // White
              new Color3(0.4, 0.25, 0.15), // Brown
              new Color3(0.15, 0.15, 0.15), // Black
              new Color3(0.85, 0.6, 0.3),  // Palomino
          ];
          for (let i = 0; i < horseCount; i++) {
              const angle = (Math.PI * 2 / horseCount) * i;
              const hx = Math.cos(angle) * horseRadius;
              const hz = Math.sin(angle) * horseRadius;

              // Pole
              const pole = MeshBuilder.CreateCylinder("pole_" + i, { diameter: 0.08, height: 3.2 }, this.scene);
              pole.position = new Vector3(hx, 2.2, hz);
              pole.material = this.getPBR("poleMat", new Color3(0.9, 0.85, 0.2), 0.9, 0.2);
              pole.parent = parent;

              // Simplified horse body (capsule-like ellipsoid)
              const body = MeshBuilder.CreateCylinder("hbody_" + i, {
                  diameterTop: 0.3, diameterBottom: 0.35, height: 0.7, tessellation: 10
              }, this.scene);
              body.rotation.z = Math.PI / 2;
              body.position = new Vector3(hx, 1.1, hz);
              body.rotation.y = angle + Math.PI / 2;
              const hColor = horseColors[i % horseColors.length];
              body.material = this.getPBR("hMat_" + i, hColor, 0.1, 0.8);
              body.parent = parent;

              // Horse head
              const hHead = MeshBuilder.CreateSphere("hhead_" + i, { diameter: 0.25, segments: 8 }, this.scene);
              hHead.position = new Vector3(
                  hx + Math.cos(angle + Math.PI / 2) * 0.35,
                  1.3,
                  hz + Math.sin(angle + Math.PI / 2) * 0.35
              );
              hHead.material = body.material;
              hHead.parent = parent;

              // Legs (4 small cylinders)
              for (let l = 0; l < 4; l++) {
                  const lx = (l < 2 ? -0.15 : 0.15);
                  const lz = (l % 2 === 0 ? 0.08 : -0.08);
                  const leg = MeshBuilder.CreateCylinder("hleg_" + i + "_" + l, { diameter: 0.06, height: 0.45 }, this.scene);
                  leg.position = new Vector3(
                      hx + Math.cos(angle + Math.PI / 2) * lx + Math.cos(angle) * lz,
                      0.82,
                      hz + Math.sin(angle + Math.PI / 2) * lx + Math.sin(angle) * lz
                  );
                  leg.material = body.material;
                  leg.parent = parent;
              }
          }

          // Light bulbs along the outer edge
          const lightCount = 16;
          const bulbMat = this.getPBR("bulbMat", new Color3(1.0, 0.95, 0.6), 0.2, 0.3);
          for (let i = 0; i < lightCount; i++) {
              const angle = (Math.PI * 2 / lightCount) * i;
              const bulb = MeshBuilder.CreateSphere("bulb_" + i, { diameter: 0.12 }, this.scene);
              bulb.position = new Vector3(
                  Math.cos(angle) * (w / 2 * 0.95),
                  4.1,
                  Math.sin(angle) * (w / 2 * 0.95)
              );
              bulb.material = bulbMat;
              bulb.parent = parent;
          }
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
          const sMat = this.getPBR("smat", new Color3(0.75, 0.75, 0.78), 0.9, 0.3);
          
          // Support A-frame (left)
          const lSup = MeshBuilder.CreateCylinder("lsup", { height: 13, diameterTop: 0.4, diameterBottom: 1.8 }, this.scene);
          lSup.position = new Vector3(-3, 6.5, 0);
          lSup.material = sMat;
          lSup.parent = parent;
          this.registerShadows(lSup);
          
          // Support A-frame (right)
          const rSup = MeshBuilder.CreateCylinder("rsup", { height: 13, diameterTop: 0.4, diameterBottom: 1.8 }, this.scene);
          rSup.position = new Vector3(3, 6.5, 0);
          rSup.material = sMat;
          rSup.parent = parent;
          this.registerShadows(rSup);
          
          // Cross beam / axis
          const axis = MeshBuilder.CreateCylinder("axis", { height: 7, diameter: 0.35 }, this.scene);
          axis.rotation.z = Math.PI / 2;
          axis.position.y = 12.5;
          axis.material = sMat;
          axis.parent = parent;
          this.registerShadows(axis);

          // Hull (tapered box)
          const woodMat = this.getPBR("bmat", new Color3(0.45, 0.25, 0.1), 0.1, 0.9);
          const boat = MeshBuilder.CreateCylinder("boat", {
              diameterTop: 3.5, diameterBottom: 2.5, height: 8, tessellation: 6
          }, this.scene);
          boat.rotation.x = Math.PI / 2;
          boat.position.y = 3;
          boat.material = woodMat;
          boat.parent = parent;
          this.registerShadows(boat);

          // Deck (flat surface on top of hull)
          const deck = MeshBuilder.CreateBox("deck", { width: 3.2, depth: 7.5, height: 0.15 }, this.scene);
          deck.position.y = 4.2;
          deck.material = this.getPBR("deckMat", new Color3(0.55, 0.35, 0.15), 0.1, 0.9);
          deck.parent = parent;
          this.registerShadows(deck);

          // Bow ornament (dragon/figurehead)
          const bow = MeshBuilder.CreateCylinder("bow", { diameterTop: 0.1, diameterBottom: 0.6, height: 2 }, this.scene);
          bow.rotation.x = -Math.PI / 4;
          bow.position = new Vector3(0, 4.5, 4.5);
          bow.material = this.getPBR("bowMat", new Color3(0.85, 0.75, 0.2), 0.8, 0.3);
          bow.parent = parent;

          // Mast
          const mast = MeshBuilder.CreateCylinder("mast", { diameter: 0.15, height: 5 }, this.scene);
          mast.position.y = 6.5;
          mast.material = woodMat;
          mast.parent = parent;

          // Sail (flat box acting as canvas)
          const sailMat = new StandardMaterial("sailMat", this.scene);
          sailMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
          sailMat.alpha = 0.9;
          const sail = MeshBuilder.CreateBox("sail", { width: 0.05, depth: 3, height: 2.5 }, this.scene);
          sail.position.y = 7;
          sail.material = sailMat;
          sail.parent = parent;

          // Skull emblem on sail (white sphere + two small eye dots)
          const skull = MeshBuilder.CreateSphere("skull", { diameter: 0.6, segments: 8 }, this.scene);
          skull.position = new Vector3(0.05, 7.2, 0);
          skull.material = this.getPBR("skullMat", new Color3(0.95, 0.95, 0.9), 0.1, 0.9);
          skull.parent = parent;

          // Flag at top of mast
          const flag = MeshBuilder.CreateBox("flag", { width: 0.03, depth: 1.2, height: 0.6 }, this.scene);
          flag.position.y = 9.3;
          flag.position.z = 0.6;
          flag.material = this.getPBR("flagMat", new Color3(0.1, 0.1, 0.1), 0.5, 0.8);
          flag.parent = parent;

          // Railing along both sides
          const railMat = this.getPBR("railMat2", new Color3(0.4, 0.22, 0.08), 0.1, 0.9);
          for (let side = -1; side <= 1; side += 2) {
              for (let z = -3; z <= 3; z += 1.5) {
                  const post = MeshBuilder.CreateCylinder("rpost", { diameter: 0.06, height: 1 }, this.scene);
                  post.position = new Vector3(side * 1.4, 4.7, z);
                  post.material = railMat;
                  post.parent = parent;
              }
              const rail = MeshBuilder.CreateBox("rrail", { width: 0.06, depth: 7, height: 0.06 }, this.scene);
              rail.position = new Vector3(side * 1.4, 5.15, 0);
              rail.material = railMat;
              rail.parent = parent;
          }
      } else {
          this.createGenericBox(def, parent, new Color3(0.9, 0.2, 0.2));
      }
  }

  private createFacilityMesh(typeId: string, def: FacilityDef, parent: TransformNode) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      const d = def.sizeZ * CONSTANTS.CELL_SIZE;
      const wallH = 3;

      const isAid = typeId === 'first_aid';
      const wallColor = isAid ? new Color3(0.92, 0.92, 0.92) : new Color3(0.75, 0.65, 0.55);
      const roofColor = isAid ? new Color3(0.8, 0.15, 0.15) : new Color3(0.25, 0.25, 0.28);

      // ── Base plinth ──
      const plinth = MeshBuilder.CreateBox("plinth", { width: w * 0.95, depth: d * 0.95, height: 0.15 }, this.scene);
      plinth.position.y = 0.075;
      plinth.material = this.getPBR("plinthMat", new Color3(0.5, 0.5, 0.5), 0.1, 0.9);
      plinth.parent = parent;
      this.registerShadows(plinth);

      // ── Walls (CSG: outer - inner - doorway - 2 side windows) ──
      const outer = MeshBuilder.CreateBox("out", { width: w * 0.9, depth: d * 0.9, height: wallH }, this.scene);
      outer.position.y = wallH / 2 + 0.15;

      const inner = MeshBuilder.CreateBox("in", { width: w * 0.78, depth: d * 0.78, height: wallH - 0.2 }, this.scene);
      inner.position.y = wallH / 2 + 0.15;

      // Front door
      const door = MeshBuilder.CreateBox("door", { width: 1.2, depth: d + 1, height: 2.2 }, this.scene);
      door.position.y = 1.25;

      // Side windows (left and right)
      const winL = MeshBuilder.CreateBox("winL", { width: w + 1, depth: 0.8, height: 1.0 }, this.scene);
      winL.position = new Vector3(0, 1.8, d * 0.25);

      const winR = MeshBuilder.CreateBox("winR", { width: w + 1, depth: 0.8, height: 1.0 }, this.scene);
      winR.position = new Vector3(0, 1.8, -d * 0.25);

      const csgOut = CSG.FromMesh(outer);
      const csgIn = CSG.FromMesh(inner);
      const csgDoor = CSG.FromMesh(door);
      const csgWL = CSG.FromMesh(winL);
      const csgWR = CSG.FromMesh(winR);

      const res = csgOut.subtract(csgIn).subtract(csgDoor).subtract(csgWL).subtract(csgWR);
      const finalWall = res.toMesh("wall", null, this.scene);
      finalWall.material = this.getPBR("fmat", wallColor, 0, 0.9);
      finalWall.parent = parent;
      this.registerShadows(finalWall);

      outer.dispose(); inner.dispose(); door.dispose(); winL.dispose(); winR.dispose();

      // ── Window glass panes ──
      const glassMat = new StandardMaterial("winGlass", this.scene);
      glassMat.diffuseColor = new Color3(0.6, 0.8, 0.95);
      glassMat.alpha = 0.35;
      glassMat.specularColor = new Color3(1, 1, 1);

      for (const zOff of [d * 0.25, -d * 0.25]) {
          const glass = MeshBuilder.CreateBox("glass", { width: w * 0.88, depth: 0.04, height: 0.95 }, this.scene);
          glass.position = new Vector3(0, 1.8, zOff);
          glass.material = glassMat;
          glass.parent = parent;
      }

      // ── Corner pilasters ──
      const pilMat = this.getPBR("pilMat", wallColor.scale(0.85), 0.1, 0.9);
      const hw = w * 0.45; const hd = d * 0.45;
      for (const [px, pz] of [[hw, hd], [hw, -hd], [-hw, hd], [-hw, -hd]]) {
          const pil = MeshBuilder.CreateBox("pil", { width: 0.12, depth: 0.12, height: wallH + 0.15 }, this.scene);
          pil.position = new Vector3(px, wallH / 2 + 0.15, pz);
          pil.material = pilMat;
          pil.parent = parent;
          this.registerShadows(pil);
      }

      // ── Roof (pyramid / 4-side) ──
      const roof = MeshBuilder.CreateCylinder("roof", { diameter: Math.max(w, d) * 1.25, height: 1.8, tessellation: 4 }, this.scene);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = wallH + 0.15 + 0.9;
      roof.material = this.getPBR("rmat", roofColor, 0.1, 0.8);
      roof.parent = parent;
      this.registerShadows(roof);

      // ── Roof gutter trim ──
      const gutterMat = this.getPBR("gutterMat", new Color3(0.5, 0.5, 0.5), 0.8, 0.4);
      for (const [gw, gd, rx, rz] of [
          [w * 0.95, 0.06, 0, d * 0.47],
          [w * 0.95, 0.06, 0, -d * 0.47],
          [0.06, d * 0.95, w * 0.47, 0],
          [0.06, d * 0.95, -w * 0.47, 0],
      ]) {
          const gutter = MeshBuilder.CreateBox("gutter", { width: gw as number, depth: gd as number, height: 0.08 }, this.scene);
          gutter.position = new Vector3(rx as number, wallH + 0.15, rz as number);
          gutter.material = gutterMat;
          gutter.parent = parent;
      }

      // ── Door frame ──
      const frameMat = this.getPBR("frameMat", new Color3(0.3, 0.18, 0.08), 0.1, 0.9);
      const frameL = MeshBuilder.CreateBox("frameL", { width: 0.08, depth: 0.12, height: 2.2 }, this.scene);
      frameL.position = new Vector3(-0.64, 1.25, -d * 0.45);
      frameL.material = frameMat; frameL.parent = parent;
      const frameR = MeshBuilder.CreateBox("frameR", { width: 0.08, depth: 0.12, height: 2.2 }, this.scene);
      frameR.position = new Vector3(0.64, 1.25, -d * 0.45);
      frameR.material = frameMat; frameR.parent = parent;
      const frameTop = MeshBuilder.CreateBox("frameT", { width: 1.4, depth: 0.12, height: 0.08 }, this.scene);
      frameTop.position = new Vector3(0, 2.4, -d * 0.45);
      frameTop.material = frameMat; frameTop.parent = parent;

      // ── Type-specific details ──
      if (isAid) {
          // Red cross sign on front wall
          const crossMat = this.getPBR("crossMat", new Color3(0.9, 0.1, 0.1), 0.5, 0.5);
          const crossV = MeshBuilder.CreateBox("crossV", { width: 0.15, depth: 0.06, height: 0.7 }, this.scene);
          crossV.position = new Vector3(0, 2.6, -d * 0.46);
          crossV.material = crossMat; crossV.parent = parent;
          const crossH = MeshBuilder.CreateBox("crossH", { width: 0.7, depth: 0.06, height: 0.15 }, this.scene);
          crossH.position = new Vector3(0, 2.6, -d * 0.46);
          crossH.material = crossMat; crossH.parent = parent;

          // Lamp above door
          const lamp = MeshBuilder.CreateSphere("lamp", { diameter: 0.2 }, this.scene);
          lamp.position = new Vector3(0, 2.7, -d * 0.48);
          lamp.material = this.getPBR("lampMat", new Color3(1, 0.95, 0.7), 0.2, 0.3);
          lamp.parent = parent;
      } else if (typeId === 'restroom') {
          // Blue sign
          const sign = MeshBuilder.CreateBox("sign", { width: 1.0, depth: 0.05, height: 0.45 }, this.scene);
          sign.position = new Vector3(0, 2.6, -d * 0.46);
          sign.material = this.getPBR("signMat", new Color3(0.2, 0.4, 0.8), 0.5, 0.5);
          sign.parent = parent;

          // Ventilation chimney on roof
          const chimney = MeshBuilder.CreateCylinder("chimney", { diameter: 0.4, height: 0.8 }, this.scene);
          chimney.position = new Vector3(w * 0.2, wallH + 1.8, d * 0.15);
          chimney.material = gutterMat;
          chimney.parent = parent;
          this.registerShadows(chimney);
      }
  }

  private createSceneryMesh(typeId: string, def: FacilityDef, parent: TransformNode) {
      const w = def.sizeX * CONSTANTS.CELL_SIZE;
      if (typeId === 'bench') {
          const woodMat = this.getPBR("wood", new Color3(0.55, 0.35, 0.12), 0.0, 0.9);
          const metalMat = this.getPBR("met", new Color3(0.2, 0.2, 0.2), 0.8, 0.5);

          const bw = w * 0.85;  // bench width (along X)
          const bd = w * 0.4;   // bench depth (along Z)
          const seatH = 0.45;   // seat height from ground

          // ── 4 Legs ──
          const legH = seatH;
          const legW = 0.06;
          for (const [lx, lz] of [[-bw/2+0.06, -bd/2+0.06], [bw/2-0.06, -bd/2+0.06], [-bw/2+0.06, bd/2-0.06], [bw/2-0.06, bd/2-0.06]]) {
              const leg = MeshBuilder.CreateBox("leg", { width: legW, depth: legW, height: legH }, this.scene);
              leg.position = new Vector3(lx, legH / 2, lz);
              leg.material = metalMat;
              leg.parent = parent;
              this.registerShadows(leg);
          }

          // ── Seat (flat board) ──
          const seat = MeshBuilder.CreateBox("seat", { width: bw, depth: bd, height: 0.06 }, this.scene);
          seat.position.y = seatH;
          seat.material = woodMat;
          seat.parent = parent;
          this.registerShadows(seat);

          // ── Backrest (tilted board) ──
          const backH = 0.4;
          const back = MeshBuilder.CreateBox("back", { width: bw, depth: 0.05, height: backH }, this.scene);
          back.position = new Vector3(0, seatH + backH / 2 + 0.02, bd / 2 - 0.03);
          back.rotation.x = -Math.PI / 12; // slight tilt
          back.material = woodMat;
          back.parent = parent;
          this.registerShadows(back);

          // ── Armrests (2 small flat boards on sides) ──
          for (const side of [-1, 1]) {
              const arm = MeshBuilder.CreateBox("arm", { width: 0.06, depth: bd * 0.7, height: 0.04 }, this.scene);
              arm.position = new Vector3(side * (bw / 2 - 0.03), seatH + 0.2, bd * 0.05);
              arm.material = metalMat;
              arm.parent = parent;
              this.registerShadows(arm);

              // Armrest vertical support
              const armSup = MeshBuilder.CreateBox("armSup", { width: 0.05, depth: 0.05, height: 0.2 }, this.scene);
              armSup.position = new Vector3(side * (bw / 2 - 0.03), seatH + 0.1, -bd * 0.2);
              armSup.material = metalMat;
              armSup.parent = parent;
          }
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
          
          const centerPos = MeshBuilder.CreateCylinder("cpost", { diameter: 0.8, height: 1.5 }, this.scene);
          centerPos.position.y = 0.75;
          centerPos.material = pool.material;
          centerPos.parent = parent;
          this.registerShadows(centerPos);
      } else if (typeId === 'flower_bed') {
          const dirt = MeshBuilder.CreateBox("dirt", { width: w, depth: w, height: 0.2 }, this.scene);
          dirt.position.y = 0.1;
          dirt.material = this.getPBR("dirtMat", new Color3(0.2, 0.1, 0.05), 0.9, 0.9);
          dirt.parent = parent;
          this.registerShadows(dirt);
          
          const flowerColors = [new Color3(0.9, 0.2, 0.2), new Color3(0.9, 0.8, 0.2), new Color3(0.2, 0.6, 0.9), new Color3(0.9, 0.4, 0.8)];
          for(let i=0; i<5; i++) {
              const bush = MeshBuilder.CreateSphere("bush", { diameter: 0.6 + Math.random()*0.4 }, this.scene);
              bush.position.x = (Math.random() - 0.5) * w * 0.7;
              bush.position.z = (Math.random() - 0.5) * w * 0.7;
              bush.position.y = 0.3 + Math.random()*0.2;
              bush.material = this.getPBR("flowerMat", flowerColors[Math.floor(Math.random() * flowerColors.length)], 0.5, 0.8);
              bush.parent = parent;
              this.registerShadows(bush);
          }
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
      if ((mesh as any)._particles) {
          (mesh as any)._particles.dispose();
      }
      mesh.dispose();
      this.meshes.delete(instanceId);
    }
  }
}
