import { Engine, Scene, Vector3, HemisphericLight, Matrix, ArcRotateCamera, AbstractMesh } from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';
import { GridManager } from './GridManager';
import { FacilityManager } from './FacilityManager';
import { EntityManager } from './EntityManager';

export class SceneManager {
  private _canvas: HTMLCanvasElement;
  private _engine: Engine;
  public scene: Scene;
  public camera: ArcRotateCamera;
  
  public gridManager: GridManager;
  public facilityManager: FacilityManager;
  public entityManager: EntityManager;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._engine = new Engine(canvas, true);
    this.scene = new Scene(this._engine);

    // Initial config
    this.scene.clearColor = null;

    // Camera
    // Position camera looking down at the center of the grid 
    const gridCenter = (CONSTANTS.GRID_SIZE * CONSTANTS.CELL_SIZE) / 2;
    this.camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 4, 100, new Vector3(gridCenter, 0, gridCenter), this.scene);
    this.camera.attachControl(this._canvas, true);
    this.camera.lowerRadiusLimit = 10;
    this.camera.upperRadiusLimit = 200;
    this.camera.wheelPrecision = 10;

    // Lighting
    const light = new HemisphericLight("light", new Vector3(0.5, 1, 0.2), this.scene);
    light.intensity = 0.8;

    // Manage Subsystems
    this.gridManager = new GridManager(this.scene);
    this.facilityManager = new FacilityManager(this.scene);
    this.entityManager = new EntityManager(this.scene);

    // Render loop
    this._engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener("resize", () => {
      this._engine.resize();
    });
  }

  public dispose() {
    this._engine.dispose();
  }
}
