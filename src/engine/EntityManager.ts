import { Scene, MeshBuilder, PBRMaterial, Color3, Vector3, Mesh, TransformNode, Animation } from '@babylonjs/core';
import { useParkState } from '../store/useParkState';
import { ObjectPool } from './ObjectPool';
import { LODManager } from './LODManager';
import type { Visitor, Staff, VomitPoint, StaffType } from '../types';

// Predefined clothing palettes for randomized visitor variety
const SHIRT_COLORS = [
    new Color3(0.85, 0.25, 0.25), // Red
    new Color3(0.2, 0.5, 0.85),   // Blue
    new Color3(0.95, 0.85, 0.2),  // Yellow
    new Color3(0.3, 0.75, 0.45),  // Green
    new Color3(0.9, 0.55, 0.15),  // Orange
    new Color3(0.6, 0.3, 0.7),    // Purple
    new Color3(0.95, 0.95, 0.95), // White
    new Color3(0.9, 0.45, 0.6),   // Pink
    new Color3(0.2, 0.75, 0.8),   // Teal
];
const PANTS_COLORS = [
    new Color3(0.15, 0.15, 0.35), // Dark navy
    new Color3(0.2, 0.2, 0.2),    // Black
    new Color3(0.35, 0.25, 0.15), // Brown
    new Color3(0.25, 0.35, 0.55), // Denim blue
    new Color3(0.55, 0.45, 0.35), // Khaki
];
const HAIR_COLORS = [
    new Color3(0.1, 0.08, 0.05),  // Black
    new Color3(0.35, 0.2, 0.1),   // Dark brown
    new Color3(0.6, 0.35, 0.15),  // Light brown
    new Color3(0.85, 0.7, 0.3),   // Blonde
    new Color3(0.5, 0.15, 0.1),   // Auburn
];
const SKIN_TONES = [
    new Color3(0.96, 0.82, 0.7),  // Light
    new Color3(0.87, 0.72, 0.55), // Medium light
    new Color3(0.72, 0.55, 0.4),  // Medium
    new Color3(0.55, 0.38, 0.26), // Medium dark
    new Color3(0.38, 0.25, 0.18), // Dark
];

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export class EntityManager {
  private scene: Scene;

  private visitorNodes: Record<string, TransformNode> = {};
  private visitorInstances: Record<string, Mesh> = {};
  private visitorBobPhases: Record<string, number> = {};
  private staffNodes: Record<string, TransformNode> = {};
  private vomitMeshes: Record<string, Mesh> = {};
  private vomitPool: ObjectPool<Mesh>;

  private vomitMat: StandardMaterial;

  // Instanced mesh templates for visitors
  private visitorTemplates: Mesh[] = [];
  private visitorTemplateCount = 5;

  // Pre-created materials for staff
  private cleanerShirtMat: StandardMaterial;
  private cleanerPantsMat: StandardMaterial;
  private mechanicShirtMat: StandardMaterial;
  private mechanicPantsMat: StandardMaterial;

  private lodManager: LODManager | null;

  constructor(scene: Scene, lodManager?: LODManager) {
    this.scene = scene;
    this.lodManager = lodManager ?? null;

    // Create visitor templates for instanced rendering
    this.createVisitorTemplates();

    this.vomitMat = new PBRMaterial('vomMat', scene);
    this.vomitMat.albedoColor = new Color3(0.5, 0.6, 0.1);
    this.vomitMat.roughness = 0.7; this.vomitMat.metallic = 0.1;

    // Object pool for vomit meshes (PRD §8.5)
    this.vomitPool = new ObjectPool<Mesh>(
      () => {
        const mesh = MeshBuilder.CreateDisc('vomit_pool', { radius: 0.5 }, scene);
        mesh.rotation.x = Math.PI / 2;
        mesh.material = this.vomitMat;
        mesh.isVisible = false;
        return mesh;
      },
      (mesh) => { mesh.isVisible = false; },
      200
    );

    // Staff uniforms
    this.cleanerShirtMat = new PBRMaterial('clnShirt', scene);
    this.cleanerShirtMat.albedoColor = new Color3(0.15, 0.65, 0.15);
    this.cleanerShirtMat.roughness = 0.7;
    this.cleanerPantsMat = new PBRMaterial('clnPants', scene);
    this.cleanerPantsMat.albedoColor = new Color3(0.15, 0.35, 0.15);
    this.cleanerPantsMat.roughness = 0.7;

    this.mechanicShirtMat = new PBRMaterial('mecShirt', scene);
    this.mechanicShirtMat.albedoColor = new Color3(0.15, 0.25, 0.7);
    this.mechanicShirtMat.roughness = 0.7;
    this.mechanicPantsMat = new PBRMaterial('mecPants', scene);
    this.mechanicPantsMat.albedoColor = new Color3(0.12, 0.12, 0.4);
    this.mechanicPantsMat.roughness = 0.7;

    // Subscribe
    useParkState.subscribe((state) => {
        this.updateVisitors(state.visitors);
        this.updateStaff(state.staff);
        this.updateVomitPoints(state.vomitPoints);
    });
  }

  /**
   * Pre-create instanced mesh templates for visitors.
   * Merges humanoid parts into single meshes for efficient instancing.
   */
  private createVisitorTemplates() {
    const colorSchemes = [
      { shirt: new Color3(0.85, 0.25, 0.25), pants: new Color3(0.15, 0.15, 0.35), skin: new Color3(0.96, 0.82, 0.7), hair: new Color3(0.1, 0.08, 0.05) },
      { shirt: new Color3(0.2, 0.5, 0.85), pants: new Color3(0.2, 0.2, 0.2), skin: new Color3(0.87, 0.72, 0.55), hair: new Color3(0.35, 0.2, 0.1) },
      { shirt: new Color3(0.95, 0.85, 0.2), pants: new Color3(0.25, 0.35, 0.55), skin: new Color3(0.72, 0.55, 0.4), hair: new Color3(0.6, 0.35, 0.15) },
      { shirt: new Color3(0.3, 0.75, 0.45), pants: new Color3(0.55, 0.45, 0.35), skin: new Color3(0.55, 0.38, 0.26), hair: new Color3(0.35, 0.2, 0.1) },
      { shirt: new Color3(0.6, 0.3, 0.7), pants: new Color3(0.2, 0.2, 0.2), skin: new Color3(0.87, 0.72, 0.55), hair: new Color3(0.85, 0.7, 0.3) },
    ];

    for (let i = 0; i < colorSchemes.length; i++) {
      const cs = colorSchemes[i];
      const dummyRoot = new TransformNode(`vis_tpl_${i}`, this.scene);
      this.buildHumanoidParts(dummyRoot, cs.skin, cs.shirt, cs.pants, cs.hair, 0.75, true);

      const childMeshes = dummyRoot.getChildMeshes() as Mesh[];
      if (childMeshes.length > 0) {
        childMeshes.forEach(m => m.setParent(null));
        const merged = Mesh.MergeMeshes(childMeshes, true, true, undefined, false, true) as Mesh;
        if (merged) {
          merged.isVisible = false;
          merged.isPickable = true;
          merged.id = `vis_tpl_${i}`;
          this.visitorTemplates.push(merged);
        }
      }
      dummyRoot.dispose();
    }
  }

  /**
   * Build a humanoid figure: head, hair, torso, two arms, two legs, shoes.
   * All meshes are parented under a single TransformNode.
   */
  private buildHumanoidParts(
      root: TransformNode,
      skinColor: Color3,
      shirtColor: Color3,
      pantsColor: Color3,
      hairColor: Color3,
      scale: number,
      isChild: boolean,
      staffType?: StaffType,
      idPrefix: string = ''
  ): void {
      const id = idPrefix || root.name;
      const s = scale;

      const skinMat = new PBRMaterial(id + '_skin', this.scene);
      skinMat.albedoColor = skinColor;
      skinMat.roughness = 0.6; skinMat.metallic = 0.0;

      const shirtMat = new PBRMaterial(id + '_shirt', this.scene);
      shirtMat.albedoColor = shirtColor;
      shirtMat.roughness = 0.7; shirtMat.metallic = 0.05;

      const pantsMat = new PBRMaterial(id + '_pants', this.scene);
      pantsMat.albedoColor = pantsColor;
      pantsMat.roughness = 0.7; shirtMat.metallic = 0.05;

      const hairMat = new PBRMaterial(id + '_hair', this.scene);
      hairMat.albedoColor = hairColor;
      hairMat.roughness = 0.8; hairMat.metallic = 0.0;

      const shoeMat = new PBRMaterial(id + '_shoe', this.scene);
      shoeMat.albedoColor = new Color3(0.1, 0.1, 0.1);
      shoeMat.roughness = 0.5; shoeMat.metallic = 0.1;

      // Head
      const headDiameter = isChild ? 0.6 * s : 0.45 * s;
      const head = MeshBuilder.CreateSphere(id + '_head', { diameter: headDiameter, segments: 10 }, this.scene);
      head.position.y = isChild ? 1.2 * s : 1.55 * s;
      head.material = skinMat; head.parent = root;

      // Eyes (two white spheres + black pupils)
      const eyeY = head.position.y + headDiameter * 0.1;
      const eyeZ = headDiameter * 0.35;
      const eyeSpacing = headDiameter * 0.2;
      const eyeWhiteMat = new PBRMaterial(id + '_eyeW', this.scene);
      eyeWhiteMat.albedoColor = new Color3(1, 1, 1);
      eyeWhiteMat.roughness = 0.1; eyeWhiteMat.metallic = 0.0;
      const eyePupilMat = new PBRMaterial(id + '_eyeP', this.scene);
      eyePupilMat.albedoColor = new Color3(0.05, 0.05, 0.05);
      eyePupilMat.roughness = 0.1;

      for (const side of [-1, 1]) {
        const eyeW = MeshBuilder.CreateSphere(id + '_eyeW' + side, { diameter: headDiameter * 0.22 }, this.scene);
        eyeW.position = new Vector3(side * eyeSpacing, eyeY, eyeZ);
        eyeW.material = eyeWhiteMat; eyeW.parent = root;

        const pupil = MeshBuilder.CreateSphere(id + '_pupil' + side, { diameter: headDiameter * 0.1 }, this.scene);
        pupil.position = new Vector3(side * eyeSpacing, eyeY, eyeZ + headDiameter * 0.08);
        pupil.material = eyePupilMat; pupil.parent = root;
      }

      // Hair
      const hair = MeshBuilder.CreateSphere(id + '_hair', { diameter: (headDiameter + 0.05), segments: 8 }, this.scene);
      hair.position.y = head.position.y + 0.1 * s;
      hair.scaling = new Vector3(1, 0.5, 1);
      hair.material = hairMat; hair.parent = root;

      // Staff Hat
      if (staffType) {
          const hatHeight = staffType === 'entertainer' ? 0.3 * s : 0.15 * s;
          const hat = MeshBuilder.CreateCylinder(id + '_hat', { diameter: 0.35 * s, height: hatHeight, tessellation: 8 }, this.scene);
          hat.position.y = head.position.y + (hatHeight + headDiameter) / 2;
          const hatMat = new PBRMaterial(id + '_hatMat', this.scene);
          hatMat.roughness = 0.6; hatMat.metallic = 0.1;
          if (staffType === 'cleaner') hatMat.albedoColor = new Color3(0.1, 0.4, 0.1);
          else if (staffType === 'mechanic') hatMat.albedoColor = new Color3(0.1, 0.1, 0.5);
          else if (staffType === 'security') hatMat.albedoColor = new Color3(0, 0, 0);
          else if (staffType === 'entertainer') hatMat.albedoColor = new Color3(0.8, 0.2, 0.8);
          hat.material = hatMat; hat.parent = root;
          if (staffType !== 'entertainer') {
              const rim = MeshBuilder.CreateDisc(id + '_rim', { radius: 0.25 * s }, this.scene);
              rim.position.y = hat.position.y - 0.05 * s;
              rim.rotation.x = Math.PI / 2;
              rim.material = hatMat; rim.parent = root;
          }
      }

      // Torso
      const torsoHeight = isChild ? 0.4 * s : 0.6 * s;
      const torso = MeshBuilder.CreateCylinder(id + '_torso', { diameterTop: 0.35 * s, diameterBottom: 0.3 * s, height: torsoHeight, tessellation: 10 }, this.scene);
      torso.position.y = isChild ? 0.8 * s : 1.1 * s;
      torso.material = shirtMat; torso.parent = root;

      if (staffType === 'cleaner') {
          const vest = MeshBuilder.CreateCylinder(id + '_vest', { diameterTop: 0.36 * s, diameterBottom: 0.31 * s, height: 0.25 * s, tessellation: 10 }, this.scene);
          vest.position.y = torso.position.y;
          const vestMat = new PBRMaterial(id + '_vestMat', this.scene);
          vestMat.albedoColor = new Color3(0.9, 0.9, 0.1);
          vestMat.roughness = 0.5; vestMat.metallic = 0.3;
          vest.material = vestMat; vest.parent = root;
      } else if (staffType === 'security') {
          const badge = MeshBuilder.CreateBox(id + '_badge', { size: 0.05 * s }, this.scene);
          badge.position.y = torso.position.y + 0.2 * s;
          badge.position.z = -0.16 * s;
          const badgeMat = new PBRMaterial(id + '_badgeMat', this.scene);
          badgeMat.albedoColor = new Color3(0.9, 0.9, 0.9);
          badgeMat.roughness = 0.3; badgeMat.metallic = 0.6;
          badge.material = badgeMat; badge.parent = root;
      } else if (staffType === 'entertainer') {
          for (let i = 0; i < 3; i++) {
              const dot = MeshBuilder.CreateSphere(id + '_dot' + i, { diameter: 0.06 * s }, this.scene);
              dot.position.y = torso.position.y + 0.1 * s - i * 0.1 * s;
              dot.position.z = -0.16 * s;
              const dotMat = new PBRMaterial(id + '_dotMat' + i, this.scene);
              dotMat.albedoColor = i % 2 === 0 ? new Color3(1, 1, 0) : new Color3(0, 1, 1);
              dotMat.roughness = 0.3; dotMat.metallic = 0.5;
              dot.material = dotMat; dot.parent = root;
          }
      }

      // Arms
      for (const side of [-1, 1]) {
          const arm = MeshBuilder.CreateCylinder(id + '_arm' + side, { diameter: 0.12 * s, height: isChild ? 0.35 * s : 0.55 * s, tessellation: 8 }, this.scene);
          arm.position.y = torso.position.y;
          arm.position.x = side * (isChild ? 0.22 * s : 0.25 * s);
          arm.material = shirtMat; arm.parent = root;
          const hand = MeshBuilder.CreateSphere(id + '_hand' + side, { diameter: 0.1 * s, segments: 6 }, this.scene);
          hand.position.y = arm.position.y - (arm.scaling.y * (isChild ? 0.2 : 0.3));
          hand.position.x = arm.position.x;
          hand.material = skinMat; hand.parent = root;
      }

      // Legs
      for (const side of [-1, 1]) {
          const legHeight = isChild ? 0.4 * s : 0.55 * s;
          const leg = MeshBuilder.CreateCylinder(id + '_leg' + side, { diameter: 0.15 * s, height: legHeight, tessellation: 8 }, this.scene);
          leg.position.y = legHeight / 2;
          leg.position.x = side * 0.1 * s;
          leg.material = pantsMat; leg.parent = root;
          const shoe = MeshBuilder.CreateBox(id + '_shoe' + side, { width: 0.14 * s, height: 0.08 * s, depth: 0.22 * s }, this.scene);
          shoe.position.y = 0.04 * s;
          shoe.position.x = side * 0.1 * s;
          shoe.position.z = 0.03 * s;
          shoe.material = shoeMat; shoe.parent = root;
      }
  }

  private createHumanoid(
      id: string,
      skinColor: Color3,
      shirtColor: Color3,
      pantsColor: Color3,
      hairColor: Color3,
      scale: number = 1.0,
      isChild: boolean = false,
      staffType?: StaffType
  ): TransformNode {
      const root = new TransformNode(id, this.scene);
      this.buildHumanoidParts(root, skinColor, shirtColor, pantsColor, hairColor, scale, isChild, staffType, id);
      return root;
  }

  private updateVisitors(visitors: Record<string, Visitor>) {
      const hasTemplates = this.visitorTemplates.length > 0;
      for (const id in visitors) {
          const v = visitors[id];
          if (!this.visitorInstances[id] && !this.visitorNodes[id]) {
            if (hasTemplates) {
              // Use instanced mesh from pre-merged templates
              const tplIdx = Math.floor(Math.random() * this.visitorTemplates.length);
              const tpl = this.visitorTemplates[tplIdx];
              const instance = tpl.createInstance(id);
              instance.isPickable = true;
              this.visitorInstances[id] = instance;
            } else {
              // Fallback: individual humanoid
              const node = this.createHumanoid(
                  id, pickRandom(SKIN_TONES), pickRandom(SHIRT_COLORS),
                  pickRandom(PANTS_COLORS), pickRandom(HAIR_COLORS), 0.75, true
              );
              this.visitorNodes[id] = node;
            }
          }
          const node = this.visitorInstances[id] || this.visitorNodes[id];
          if (node) {
            // Walking bob animation
            if (!this.visitorBobPhases[id]) this.visitorBobPhases[id] = Math.random() * Math.PI * 2;
            const bobY = v.state === 'walking' ? Math.sin(Date.now() * 0.008 + this.visitorBobPhases[id]) * 0.06 : 0;
            node.position = new Vector3(v.pos.x, bobY, v.pos.z);
            if (this.lodManager && !node.metadata?.lodTracked) {
              this.lodManager.track(id, node, 'visitor', () => ({ x: v.pos.x, z: v.pos.z }));
              node.metadata = { ...node.metadata, lodTracked: true };
            }
          }
      }

      // Delete old visitors
      for (const id in this.visitorInstances) {
          if (!visitors[id]) {
              if (this.lodManager) this.lodManager.untrack(id);
              this.visitorInstances[id].dispose();
              delete this.visitorInstances[id];
              delete this.visitorBobPhases[id];
          }
      }
      for (const id in this.visitorNodes) {
          if (!visitors[id]) {
              if (this.lodManager) this.lodManager.untrack(id);
              this.visitorNodes[id].dispose();
              delete this.visitorNodes[id];
              delete this.visitorBobPhases[id];
          }
      }
  }

  private updateStaff(staff: Record<string, Staff>) {
      for (const id in staff) {
          const s = staff[id];
          if (!this.staffNodes[id]) {
              // Distinct uniform colors per type
              let shirtColor: Color3;
              let pantsColor: Color3;

              switch (s.type) {
                  case 'cleaner':
                      shirtColor = new Color3(0.1, 0.6, 0.1); // Green
                      pantsColor = new Color3(0.05, 0.2, 0.05);
                      break;
                  case 'mechanic':
                      shirtColor = new Color3(0.1, 0.2, 0.7); // Blue
                      pantsColor = new Color3(0.05, 0.05, 0.3);
                      break;
                  case 'security':
                      shirtColor = new Color3(0.15, 0.15, 0.15); // Black
                      pantsColor = new Color3(0.1, 0.1, 0.1);
                      break;
                  case 'entertainer':
                      shirtColor = new Color3(0.9, 0.3, 0.9); // Purple/Pink
                      pantsColor = new Color3(0.4, 0.1, 0.4);
                      break;
                  default:
                      shirtColor = new Color3(0.5, 0.5, 0.5);
                      pantsColor = new Color3(0.2, 0.2, 0.2);
              }

              const node = this.createHumanoid(
                  id,
                  new Color3(0.9, 0.75, 0.6),
                  shirtColor,
                  pantsColor,
                  pickRandom(HAIR_COLORS),
                  1.1,
                  false,
                  s.type
              );
              this.staffNodes[id] = node;
          }
          this.staffNodes[id].position = new Vector3(s.pos.x, 0, s.pos.z);
      }

      for (const id in this.staffNodes) {
          if (!staff[id]) {
              this.staffNodes[id].dispose();
              delete this.staffNodes[id];
          }
      }
  }

  private updateVomitPoints(vomitPoints: Record<string, VomitPoint>) {
      for (const id in vomitPoints) {
          const v = vomitPoints[id];
          if (!this.vomitMeshes[id]) {
              const mesh = this.vomitPool.acquire();
              if (mesh) {
                  mesh.isVisible = true;
                  mesh.id = id;
                  this.vomitMeshes[id] = mesh;
              }
          }
          if (this.vomitMeshes[id]) {
              this.vomitMeshes[id].position = new Vector3(v.pos.x, 0.05, v.pos.z);
          }
      }

      for (const id in this.vomitMeshes) {
          if (!vomitPoints[id]) {
              this.vomitPool.release(this.vomitMeshes[id]);
              delete this.vomitMeshes[id];
          }
      }
  }
}
