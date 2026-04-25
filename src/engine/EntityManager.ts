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
      scale: number = 1.0
  ): TransformNode {
      const root = new TransformNode(id, this.scene);

      // Materials (unique per entity for color variety)
      const skinMat = new StandardMaterial(id + '_skin', this.scene);
      skinMat.diffuseColor = skinColor;
      skinMat.specularColor = new Color3(0.15, 0.12, 0.1);

      const shirtMat = new StandardMaterial(id + '_shirt', this.scene);
      shirtMat.diffuseColor = shirtColor;
      shirtMat.specularColor = new Color3(0.08, 0.08, 0.08);

      const pantsMat = new StandardMaterial(id + '_pants', this.scene);
      pantsMat.diffuseColor = pantsColor;
      pantsMat.specularColor = new Color3(0.05, 0.05, 0.05);

      const hairMat = new StandardMaterial(id + '_hair', this.scene);
      hairMat.diffuseColor = hairColor;
      hairMat.specularColor = new Color3(0.2, 0.18, 0.15);

      const shoeMat = new StandardMaterial(id + '_shoe', this.scene);
      shoeMat.diffuseColor = new Color3(0.12, 0.12, 0.12);

      const s = scale;

      // ── Head (sphere) ──
      const head = MeshBuilder.CreateSphere(id + '_head', { diameter: 0.45 * s, segments: 10 }, this.scene);
      head.position.y = 1.55 * s;
      head.material = skinMat;
      head.parent = root;

      // ── Hair (flattened sphere on top of head) ──
      const hair = MeshBuilder.CreateSphere(id + '_hair', { diameter: 0.48 * s, segments: 8 }, this.scene);
      hair.position.y = 1.65 * s;
      hair.scaling = new Vector3(1, 0.5, 1);
      hair.material = hairMat;
      hair.parent = root;

      // ── Torso (tapered cylinder) ──
      const torso = MeshBuilder.CreateCylinder(id + '_torso', {
          diameterTop: 0.35 * s,
          diameterBottom: 0.3 * s,
          height: 0.6 * s,
          tessellation: 10
      }, this.scene);
      torso.position.y = 1.1 * s;
      torso.material = shirtMat;
      torso.parent = root;

      // ── Arms (two thin capsule-like cylinders) ──
      const createArm = (side: number) => {
          const arm = MeshBuilder.CreateCylinder(id + '_arm' + side, {
              diameter: 0.12 * s,
              height: 0.55 * s,
              tessellation: 8
          }, this.scene);
          arm.position.y = 1.05 * s;
          arm.position.x = side * 0.25 * s;
          arm.material = shirtMat;
          arm.parent = root;

          // Hand
          const hand = MeshBuilder.CreateSphere(id + '_hand' + side, { diameter: 0.1 * s, segments: 6 }, this.scene);
          hand.position.y = 0.75 * s;
          hand.position.x = side * 0.25 * s;
          hand.material = skinMat;
          hand.parent = root;
      };
      createArm(-1);
      createArm(1);

      // ── Legs (two cylinders) ──
      const createLeg = (side: number) => {
          const leg = MeshBuilder.CreateCylinder(id + '_leg' + side, {
              diameter: 0.15 * s,
              height: 0.55 * s,
              tessellation: 8
          }, this.scene);
          leg.position.y = 0.45 * s;
          leg.position.x = side * 0.1 * s;
          leg.material = pantsMat;
          leg.parent = root;

          // Shoe
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
                  1.0
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
              const isCleaner = s.type === 'cleaner';
              const node = this.createHumanoid(
                  id,
                  new Color3(0.87, 0.72, 0.55),
                  isCleaner ? this.cleanerShirtMat.diffuseColor.clone() : this.mechanicShirtMat.diffuseColor.clone(),
                  isCleaner ? this.cleanerPantsMat.diffuseColor.clone() : this.mechanicPantsMat.diffuseColor.clone(),
                  pickRandom(HAIR_COLORS),
                  1.1 // Staff slightly taller
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
