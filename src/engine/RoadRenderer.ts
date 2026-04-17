/**
 * RoadRenderer — subscribes to Zustand park state and renders road tiles as flat
 * Babylon.js meshes on the ground plane. Supports normal (grey) and wide (light grey)
 * road types. Staff-only roads are rendered differently.
 */
import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, Mesh } from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';
import { useParkState } from '../store/useParkState';
import type { RoadTile } from '../types';

export class RoadRenderer {
  private scene: Scene;
  private meshes: Map<string, Mesh> = new Map();
  private matNormal: StandardMaterial;
  private matWide: StandardMaterial;
  private matStaff: StandardMaterial;

  constructor(scene: Scene) {
    this.scene = scene;

    this.matNormal = new StandardMaterial('road_normal', scene);
    this.matNormal.diffuseColor = Color3.FromHexString('#888888');
    this.matNormal.specularColor = new Color3(0.05, 0.05, 0.05);

    this.matWide = new StandardMaterial('road_wide', scene);
    this.matWide.diffuseColor = Color3.FromHexString('#AAAAAA');
    this.matWide.specularColor = new Color3(0.05, 0.05, 0.05);

    this.matStaff = new StandardMaterial('road_staff', scene);
    this.matStaff.diffuseColor = Color3.FromHexString('#997755');
    this.matStaff.specularColor = new Color3(0.05, 0.05, 0.05);

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
      }
    }

    // Remove meshes for tiles that no longer exist
    for (const [key, mesh] of this.meshes) {
      if (!seen.has(key)) {
        mesh.dispose();
        this.meshes.delete(key);
      }
    }
  }

  public dispose() {
    for (const mesh of this.meshes.values()) {
      mesh.dispose();
    }
    this.meshes.clear();
  }
}
