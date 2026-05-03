/**
 * RoadRenderer — subscribes to Zustand park state and renders road tiles as flat
 * Babylon.js meshes on the ground plane. Supports normal (grey) and wide (light grey)
 * road types. Staff-only roads are rendered differently.
 */
import { Scene, MeshBuilder, PBRMaterial, Color3, Vector3, Mesh } from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';
import { useParkState } from '../store/useParkState';
import type { RoadTile } from '../types';

export class RoadRenderer {
  private scene: Scene;
  private meshes: Map<string, Mesh> = new Map();
  private markings: Map<string, Mesh> = new Map();
  private matNormal: PBRMaterial;
  private matWide: PBRMaterial;
  private matStaff: PBRMaterial;
  private matMarking: PBRMaterial;

  constructor(scene: Scene) {
    this.scene = scene;

    this.matNormal = new PBRMaterial('road_normal', scene);
    this.matNormal.albedoColor = Color3.FromHexString('#777777');
    this.matNormal.roughness = 0.85; this.matNormal.metallic = 0.05;

    this.matWide = new PBRMaterial('road_wide', scene);
    this.matWide.albedoColor = Color3.FromHexString('#999999');
    this.matWide.roughness = 0.85; this.matWide.metallic = 0.05;

    this.matStaff = new PBRMaterial('road_staff', scene);
    this.matStaff.albedoColor = Color3.FromHexString('#997755');
    this.matStaff.roughness = 0.9; this.matStaff.metallic = 0.02;

    this.matMarking = new PBRMaterial('road_marking', scene);
    this.matMarking.albedoColor = Color3.FromHexString('#DDDDDD');
    this.matMarking.roughness = 0.7; this.matMarking.metallic = 0.05;
    this.matMarking.emissiveColor = new Color3(0.05, 0.05, 0.05);

    // Subscribe to park state changes
    useParkState.subscribe((state, prevState) => {
      if (state.roads !== prevState.roads) {
        this.syncRoads(state.roads);
      }
    });
  }

  private syncRoads(roads: RoadTile[]) {
    const seen = new Set<string>();
    const cs = CONSTANTS.CELL_SIZE;

    for (const tile of roads) {
      const key = `${tile.x}_${tile.z}`;
      seen.add(key);

      if (!this.meshes.has(key)) {
        // Create a flat box slightly above ground to avoid z-fighting
        const mesh = MeshBuilder.CreateBox(`road_${key}`, {
          width: cs,
          depth: cs,
          height: 0.05,
        }, this.scene);

        const cx = tile.x * cs + cs / 2;
        const cz = tile.z * cs + cs / 2;
        mesh.position = new Vector3(cx, 0.03, cz);
        mesh.isPickable = false;

        if (tile.type === 'wide') {
          mesh.material = this.matWide;
          // Wide road is 2 cells wide on Z axis — scale accordingly
          mesh.scaling.z = 2;
        } else if (tile.type === 'staff') {
          mesh.material = this.matStaff;
        } else {
          mesh.material = this.matNormal;
        }

        this.meshes.set(key, mesh);

        // Add dashed center line for wide roads
        if (tile.type === 'wide' && tile.x % 2 === 0) {
          const markKey = `mark_${key}`;
          if (!this.markings.has(markKey)) {
            const mark = MeshBuilder.CreateBox(`roadmark_${key}`, {
              width: 0.1, depth: 0.15, height: 0.02,
            }, this.scene);
            mark.position = new Vector3(cx, 0.08, cz);
            mark.material = this.matMarking;
            mark.isPickable = false;
            this.markings.set(markKey, mark);
          }
        }
      }
    }

    // Remove meshes for tiles that no longer exist
    for (const [key, mesh] of this.meshes) {
      if (!seen.has(key)) {
        mesh.dispose();
        this.meshes.delete(key);
        const markKey = `mark_${key}`;
        if (this.markings.has(markKey)) {
          this.markings.get(markKey)!.dispose();
          this.markings.delete(markKey);
        }
      }
    }
  }

  public dispose() {
    for (const mesh of this.meshes.values()) mesh.dispose();
    for (const mark of this.markings.values()) mark.dispose();
    this.meshes.clear();
    this.markings.clear();
  }
}
