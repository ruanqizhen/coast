import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, Mesh } from '@babylonjs/core';
import { useParkState } from '../store/useParkState';
import type { Visitor, Staff, VomitPoint } from '../types';

export class EntityManager {
  private scene: Scene;
  
  private visitorMeshes: Record<string, Mesh> = {};
  private staffMeshes: Record<string, Mesh> = {};
  private vomitMeshes: Record<string, Mesh> = {};

  private visitorMat: StandardMaterial;
  private cleanerMat: StandardMaterial;
  private mechanicMat: StandardMaterial;
  private vomitMat: StandardMaterial;

  constructor(scene: Scene) {
    this.scene = scene;

    // Materials
    this.visitorMat = new StandardMaterial('visMat', scene);
    this.visitorMat.diffuseColor = new Color3(1, 0.8, 0.6); // Skin tone placeholder

    this.cleanerMat = new StandardMaterial('clnMat', scene);
    this.cleanerMat.diffuseColor = new Color3(0.2, 0.8, 0.2); // Green uniform

    this.mechanicMat = new StandardMaterial('mecMat', scene);
    this.mechanicMat.diffuseColor = new Color3(0.2, 0.2, 0.8); // Blue uniform

    this.vomitMat = new StandardMaterial('vomMAt', scene);
    this.vomitMat.diffuseColor = new Color3(0.5, 0.6, 0.1); // Greenish yellow
    
    // Subscribe
    useParkState.subscribe((state, prevState) => {
        this.updateVisitors(state.visitors);
        this.updateStaff(state.staff);
        this.updateVomitPoints(state.vomitPoints);
    });
  }

  private updateVisitors(visitors: Record<string, Visitor>) {
      // Create or update
      for (const id in visitors) {
          const v = visitors[id];
          if (!this.visitorMeshes[id]) {
              const mesh = MeshBuilder.CreateCapsule(id, { height: 1.8, radius: 0.4 }, this.scene);
              mesh.material = this.visitorMat;
              this.visitorMeshes[id] = mesh;
          }
          this.visitorMeshes[id].position = new Vector3(v.pos.x, 0.9, v.pos.z);
      }
      
      // Delete old
      for (const id in this.visitorMeshes) {
          if (!visitors[id]) {
              this.visitorMeshes[id].dispose();
              delete this.visitorMeshes[id];
          }
      }
  }

  private updateStaff(staff: Record<string, Staff>) {
      for (const id in staff) {
          const s = staff[id];
          if (!this.staffMeshes[id]) {
              const mesh = MeshBuilder.CreateCapsule(id, { height: 1.8, radius: 0.4 }, this.scene);
              mesh.material = s.type === 'cleaner' ? this.cleanerMat : this.mechanicMat;
              this.staffMeshes[id] = mesh;
          }
          this.staffMeshes[id].position = new Vector3(s.pos.x, 0.9, s.pos.z);
      }
      
      for (const id in this.staffMeshes) {
          if (!staff[id]) {
              this.staffMeshes[id].dispose();
              delete this.staffMeshes[id];
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
