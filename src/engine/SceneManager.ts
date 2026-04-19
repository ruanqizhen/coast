import { Engine, Scene, Vector3, HemisphericLight, ArcRotateCamera, DirectionalLight, Color3, Color4, ShadowGenerator } from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';
import { GridManager } from './GridManager';
import { FacilityManager } from './FacilityManager';
import { EntityManager } from './EntityManager';
import { RoadRenderer } from './RoadRenderer';

export class SceneManager {
  private _canvas: HTMLCanvasElement;
  private _engine: Engine;
  public scene: Scene;
  public camera: ArcRotateCamera;
  public shadowGenerator: ShadowGenerator;
  
  public gridManager: GridManager;
  public facilityManager: FacilityManager;
  public entityManager: EntityManager;
  public roadRenderer: RoadRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.scene = new Scene(this._engine);

    // Sky background
    this.scene.clearColor = new Color4(0.53, 0.81, 0.98, 1.0); // Sky blue

    // Camera — isometric-style top-down view
    const gridCenter = (CONSTANTS.GRID_SIZE * CONSTANTS.CELL_SIZE) / 2;
    this.camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2,   // alpha: look from south
      Math.PI / 3,    // beta: ~60° angle (more isometric)
      120,            // radius: zoom level
      new Vector3(gridCenter, 0, gridCenter),
      this.scene
    );
    this.camera.attachControl(this._canvas, true);
    this.camera.lowerRadiusLimit = 20;
    this.camera.upperRadiusLimit = 300;
    this.camera.wheelPrecision = 5;
    this.camera.lowerBetaLimit = 0.3;  // Prevent flipping below ground
    this.camera.upperBetaLimit = Math.PI / 2 - 0.1;

    // Ambient lighting
    const hemiLight = new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 0.7;
    hemiLight.groundColor = new Color3(0.4, 0.4, 0.4);

    const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), this.scene);
    sun.intensity = 0.5;
    sun.position = new Vector3(100, 200, 100);

    // Shadows
    this.shadowGenerator = new ShadowGenerator(2048, sun);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;

    // Default environment for PBR reflections
    this.scene.createDefaultEnvironment({
      createSkybox: false,
      createGround: false,
      environmentTexture: "https://playground.babylonjs.com/textures/environment.dds" // Built-in Babylon CDN texture for reflections
    });

    // Subsystems
    this.gridManager = new GridManager(this.scene);
    this.facilityManager = new FacilityManager(this.scene, this.shadowGenerator);
    this.entityManager = new EntityManager(this.scene);
    this.roadRenderer = new RoadRenderer(this.scene);

    // Render loop
    this._engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener('resize', () => {
      this._engine.resize();
    });
  }

  public dispose() {
    this._engine.dispose();
  }
}
