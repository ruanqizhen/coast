import { Engine, Scene, Vector3, HemisphericLight, ArcRotateCamera, DirectionalLight, Color3, Color4, ShadowGenerator } from '@babylonjs/core';
import { CONSTANTS } from '../config/constants';
import { GridManager } from './GridManager';
import { FacilityManager } from './FacilityManager';
import { EntityManager } from './EntityManager';
import { RoadRenderer } from './RoadRenderer';
import { SoundManager } from './SoundManager';
import { LODManager } from './LODManager';
import { useParkState } from '../store/useParkState';

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
  public soundManager: SoundManager;
  public lodManager: LODManager;
  public sunLight: DirectionalLight;
  private _currentSimSpeed: number = 1;
  private updateDayNight: () => void = () => {};

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
    this.camera.upperBetaLimit = Math.PI / 2 - 0.1;

    this.camera.onViewMatrixChangedObservable.add(() => {
      window.dispatchEvent(new CustomEvent('onCameraRotate', { detail: { alpha: this.camera.alpha } }));
    });

    // Ambient lighting
    const hemiLight = new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 0.7;
    hemiLight.groundColor = new Color3(0.4, 0.4, 0.4);

    const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), this.scene);
    sun.intensity = 0.5;
    sun.position = new Vector3(100, 200, 100);
    this.sunLight = sun;

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
    this.entityManager = new EntityManager(this.scene, this.lodManager);
    this.roadRenderer = new RoadRenderer(this.scene);
    this.soundManager = new SoundManager(this.scene);
    this.lodManager = new LODManager(this.scene, this.camera);

    // Render loop
    this._engine.runRenderLoop(() => {
      this.updateDayNight();
      this.scene.render();
    });

    window.addEventListener('resize', () => {
      this._engine.resize();
    });

    // ── Day/Night Cycle ──
    let dayFraction = 0.5; // Start at noon
    const DAY_DURATION_MS = 60000; // 60s per game day
    const DAY_NIGHT_TRANSITION = 0.1; // 10% of day = dawn/dusk

    const updateDayTick = () => {
      // Advance by a tiny fraction each real frame (~16ms at 60fps)
      // Each real second = 1/60 of a game day at 1× speed
      const speed = 1; // default, will be overridden by day tick events
      dayFraction = (dayFraction + (16 / DAY_DURATION_MS) * speed) % 1;
    };

    // Use scene render observer for smooth interpolation
    let lastFrameTime = performance.now();
    this.scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const dtMs = now - lastFrameTime;
      lastFrameTime = now;
      const speed = this._currentSimSpeed;
      dayFraction = (dayFraction + (dtMs / DAY_DURATION_MS) * speed) % 1;
    });

    this.updateDayNight = () => {
      const t = dayFraction;
      // Sun: rises in east (morning), sets in west (evening)
      // Map t=0 (midnight) → angle=-90°, t=0.25 (dawn) → angle=0°, t=0.5 (noon) → angle=90°, t=0.75 (dusk) → angle=180°
      const sunAngle = (t - 0.25) * Math.PI * 2;
      const sunHeight = Math.sin(t * Math.PI * 2);
      const sunRadius = 250;
      this.sunLight.position = new Vector3(
        Math.cos(sunAngle) * sunRadius,
        Math.max(10, sunHeight * sunRadius),
        Math.sin(sunAngle) * sunRadius * 0.5
      );

      // Intensity: peak at noon, dim at night
      const nightFactor = Math.max(0, Math.sin(t * Math.PI));
      this.sunLight.intensity = 0.1 + nightFactor * 0.5;
      this.scene.clearColor = new Color4(
        0.05 + nightFactor * 0.48,
        0.05 + nightFactor * 0.76,
        0.1 + nightFactor * 0.88,
        1.0
      );
    };

    // Listen for speed changes
    const self = this;
    window.addEventListener('onSpeedChange', (e: Event) => {
      self._currentSimSpeed = (e as CustomEvent).detail;
    });

    // ── 3D Picking Logic ──
    this.scene.onPointerDown = (_evt, pickResult) => {
        // Only pick if not in placement mode
        const pState = useParkState.getState();
        if (pState.placementMode || pState.coasterBuilderMode) return;

        if (pickResult.hit && pickResult.pickedMesh) {
            let mesh = pickResult.pickedMesh;
            
            // Find root or parent with ID
            let targetId: string | null = null;
            let current: any = mesh;
            while (current) {
                if (current.id && (current.id.startsWith('fac_') || current.id.startsWith('vis_'))) {
                    targetId = current.id;
                    break;
                }
                current = current.parent;
            }

            if (targetId) {
                if (targetId.startsWith('fac_')) {
                    pState.selectFacility(targetId);
                    pState.selectVisitor(null);
                } else if (targetId.startsWith('vis_')) {
                    pState.selectVisitor(targetId);
                    pState.selectFacility(null);
                }
            } else {
                // Clicked ground or nothing
                pState.selectFacility(null);
                pState.selectVisitor(null);
            }
        } else {
            pState.selectFacility(null);
            pState.selectVisitor(null);
        }
    };
  }

  public dispose() {
    this.soundManager.dispose();
    this._engine.dispose();
  }
}
