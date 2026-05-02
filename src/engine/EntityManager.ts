import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, Mesh, TransformNode } from '@babylonjs/core';
import { useParkState } from '../store/useParkState';
import type { Visitor, Staff, VomitPoint } from '../types';

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
  private staffNodes: Record<string, TransformNode> = {};
  private vomitMeshes: Record<string, Mesh> = {};

  private vomitMat: StandardMaterial;

  // Pre-created materials for staff
  private cleanerShirtMat: StandardMaterial;
  private cleanerPantsMat: StandardMaterial;
  private mechanicShirtMat: StandardMaterial;
  private mechanicPantsMat: StandardMaterial;

  constructor(scene: Scene) {
    this.scene = scene;

    this.vomitMat = new StandardMaterial('vomMat', scene);
    this.vomitMat.diffuseColor = new Color3(0.5, 0.6, 0.1);

    // Staff uniforms
    this.cleanerShirtMat = new StandardMaterial('clnShirt', scene);
    this.cleanerShirtMat.diffuseColor = new Color3(0.15, 0.65, 0.15);
    this.cleanerPantsMat = new StandardMaterial('clnPants', scene);
    this.cleanerPantsMat.diffuseColor = new Color3(0.15, 0.35, 0.15);

    this.mechanicShirtMat = new StandardMaterial('mecShirt', scene);
    this.mechanicShirtMat.diffuseColor = new Color3(0.15, 0.25, 0.7);
    this.mechanicPantsMat = new StandardMaterial('mecPants', scene);
    this.mechanicPantsMat.diffuseColor = new Color3(0.12, 0.12, 0.4);

    // Subscribe
    useParkState.subscribe((state) => {
        this.updateVisitors(state.visitors);
        this.updateStaff(state.staff);
        this.updateVomitPoints(state.vomitPoints);
    });
  }

  /**
   * Build a humanoid figure: head, hair, torso, two arms, two legs, shoes.
   * All meshes are parented under a single TransformNode.
   */
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

      // Materials (unique per entity for color variety)
      const skinMat = new StandardMaterial(id + '_skin', this.scene);
      skinMat.diffuseColor = skinColor;
      skinMat.specularColor = new Color3(0.1, 0.1, 0.1);

      const shirtMat = new StandardMaterial(id + '_shirt', this.scene);
      shirtMat.diffuseColor = shirtColor;
      shirtMat.specularColor = new Color3(0.05, 0.05, 0.05);

      const pantsMat = new StandardMaterial(id + '_pants', this.scene);
      pantsMat.diffuseColor = pantsColor;

      const hairMat = new StandardMaterial(id + '_hair', this.scene);
      hairMat.diffuseColor = hairColor;

      const shoeMat = new StandardMaterial(id + '_shoe', this.scene);
      shoeMat.diffuseColor = new Color3(0.1, 0.1, 0.1);

      const s = scale;

      // ── Head ──
      const headDiameter = isChild ? 0.6 * s : 0.45 * s;
      const head = MeshBuilder.CreateSphere(id + '_head', { diameter: headDiameter, segments: 10 }, this.scene);
      head.position.y = isChild ? 1.2 * s : 1.55 * s;
      head.material = skinMat;
      head.parent = root;

      // ── Hair ──
      const hair = MeshBuilder.CreateSphere(id + '_hair', { diameter: (headDiameter + 0.05), segments: 8 }, this.scene);
      hair.position.y = head.position.y + 0.1 * s;
      hair.scaling = new Vector3(1, 0.5, 1);
      hair.material = hairMat;
      hair.parent = root;

      // ── Staff Hat ──
      if (staffType) {
          const hatHeight = staffType === 'entertainer' ? 0.3 * s : 0.15 * s;
          const hat = MeshBuilder.CreateCylinder(id + '_hat', { 
              diameter: 0.35 * s, 
              height: hatHeight,
              tessellation: 8
          }, this.scene);
          hat.position.y = head.position.y + (hatHeight + headDiameter)/2;
          const hatMat = new StandardMaterial(id + '_hatMat', this.scene);
          
          if (staffType === 'cleaner') hatMat.diffuseColor = new Color3(0.1, 0.4, 0.1);
          else if (staffType === 'mechanic') hatMat.diffuseColor = new Color3(0.1, 0.1, 0.5);
          else if (staffType === 'security') hatMat.diffuseColor = new Color3(0, 0, 0);
          else if (staffType === 'entertainer') hatMat.diffuseColor = new Color3(0.8, 0.2, 0.8);
          
          hat.material = hatMat;
          hat.parent = root;

          // Rim (except for tall entertainer hats maybe?)
          if (staffType !== 'entertainer') {
              const rim = MeshBuilder.CreateDisc(id + '_rim', { radius: 0.25 * s }, this.scene);
              rim.position.y = hat.position.y - 0.05 * s;
              rim.rotation.x = Math.PI / 2;
              rim.material = hatMat;
              rim.parent = root;
          }
      }

      // ── Torso ──
      const torsoHeight = isChild ? 0.4 * s : 0.6 * s;
      const torso = MeshBuilder.CreateCylinder(id + '_torso', {
          diameterTop: 0.35 * s,
          diameterBottom: 0.3 * s,
          height: torsoHeight,
          tessellation: 10
      }, this.scene);
      torso.position.y = isChild ? 0.8 * s : 1.1 * s;
      torso.material = shirtMat;
      torso.parent = root;

      // Staff details
      if (staffType === 'cleaner') {
          // Yellow reflective vest
          const vest = MeshBuilder.CreateCylinder(id + '_vest', {
              diameterTop: 0.36 * s,
              diameterBottom: 0.31 * s,
              height: 0.25 * s,
              tessellation: 10
          }, this.scene);
          vest.position.y = torso.position.y;
          const vestMat = new StandardMaterial(id + '_vestMat', this.scene);
          vestMat.diffuseColor = new Color3(0.9, 0.9, 0.1);
          vest.material = vestMat;
          vest.parent = root;
      } else if (staffType === 'security') {
          // White badge / tie look
          const badge = MeshBuilder.CreateBox(id + '_badge', { size: 0.05 * s }, this.scene);
          badge.position.y = torso.position.y + 0.2 * s;
          badge.position.z = -0.16 * s;
          const badgeMat = new StandardMaterial(id + '_badgeMat', this.scene);
          badgeMat.diffuseColor = new Color3(0.9, 0.9, 0.9);
          badge.material = badgeMat;
          badge.parent = root;
      } else if (staffType === 'entertainer') {
          // Colorful dots / buttons
          for (let i = 0; i < 3; i++) {
              const dot = MeshBuilder.CreateSphere(id + '_dot' + i, { diameter: 0.06 * s }, this.scene);
              dot.position.y = torso.position.y + 0.1 * s - i * 0.1 * s;
              dot.position.z = -0.16 * s;
              const dotMat = new StandardMaterial(id + '_dotMat' + i, this.scene);
              dotMat.diffuseColor = i % 2 === 0 ? new Color3(1, 1, 0) : new Color3(0, 1, 1);
              dot.material = dotMat;
              dot.parent = root;
          }
      }

      // ── Arms ──
      const createArm = (side: number) => {
          const arm = MeshBuilder.CreateCylinder(id + '_arm' + side, {
              diameter: 0.12 * s,
              height: isChild ? 0.35 * s : 0.55 * s,
              tessellation: 8
          }, this.scene);
          arm.position.y = torso.position.y;
          arm.position.x = side * (isChild ? 0.22 * s : 0.25 * s);
          arm.material = shirtMat;
          arm.parent = root;

          const hand = MeshBuilder.CreateSphere(id + '_hand' + side, { diameter: 0.1 * s, segments: 6 }, this.scene);
          hand.position.y = arm.position.y - (arm.scaling.y * (isChild ? 0.2 : 0.3));
          hand.position.x = arm.position.x;
          hand.material = skinMat;
          hand.parent = root;
      };
      createArm(-1);
      createArm(1);

      // ── Legs ──
      const createLeg = (side: number) => {
          const legHeight = isChild ? 0.4 * s : 0.55 * s;
          const leg = MeshBuilder.CreateCylinder(id + '_leg' + side, {
              diameter: 0.15 * s,
              height: legHeight,
              tessellation: 8
          }, this.scene);
          leg.position.y = legHeight / 2;
          leg.position.x = side * 0.1 * s;
          leg.material = pantsMat;
          leg.parent = root;

          const shoe = MeshBuilder.CreateBox(id + '_shoe' + side, {
              width: 0.14 * s,
              height: 0.08 * s,
              depth: 0.22 * s
          }, this.scene);
          shoe.position.y = 0.04 * s;
          shoe.position.x = side * 0.1 * s;
          shoe.position.z = 0.03 * s;
          shoe.material = shoeMat;
          shoe.parent = root;
      };
      createLeg(-1);
      createLeg(1);

      return root;
  }

  private updateVisitors(visitors: Record<string, Visitor>) {
      for (const id in visitors) {
          const v = visitors[id];
          if (!this.visitorNodes[id]) {
              const node = this.createHumanoid(
                  id,
                  pickRandom(SKIN_TONES),
                  pickRandom(SHIRT_COLORS),
                  pickRandom(PANTS_COLORS),
                  pickRandom(HAIR_COLORS),
                  0.75, 
                  true
              );
              this.visitorNodes[id] = node;
          }
          this.visitorNodes[id].position = new Vector3(v.pos.x, 0, v.pos.z);
      }

      // Delete old
      for (const id in this.visitorNodes) {
          if (!visitors[id]) {
              this.visitorNodes[id].dispose();
              delete this.visitorNodes[id];
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
              const mesh = MeshBuilder.CreateDisc(id, { radius: 0.5 }, this.scene);
              mesh.rotation.x = Math.PI / 2;
              mesh.material = this.vomitMat;
              this.vomitMeshes[id] = mesh;
          }
          this.vomitMeshes[id].position = new Vector3(v.pos.x, 0.05, v.pos.z);
      }

      for (const id in this.vomitMeshes) {
          if (!vomitPoints[id]) {
              this.vomitMeshes[id].dispose();
              delete this.vomitMeshes[id];
          }
      }
  }
}
