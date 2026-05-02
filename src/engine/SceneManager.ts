import { Engine, Scene, Vector3, HemisphericLight, ArcRotateCamera, DirectionalLight, PointLight, Color3, Color4, ShadowGenerator, ParticleSystem, DynamicTexture } from '@babylonjs/core';
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
  private _speedChangeHandler: ((e: Event) => void) | null = null;
  private _nightLights: PointLight[] = [];
  private _dustPS: ParticleSystem | null = null;
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

    // Subsystems (LODManager before EntityManager so it can be injected)
    this.gridManager = new GridManager(this.scene);
    this.facilityManager = new FacilityManager(this.scene, this.shadowGenerator);
    this.lodManager = new LODManager(this.scene, this.camera);
    this.entityManager = new EntityManager(this.scene, this.lodManager);
    this.roadRenderer = new RoadRenderer(this.scene);
    this.soundManager = new SoundManager(this.scene);

    // Distance fog for atmosphere
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogStart = 80;
    this.scene.fogEnd = 280;
    this.scene.fogColor = new Color3(0.53, 0.81, 0.98);

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
      // t=0 (midnight), t=0.25 (dawn), t=0.5 (noon), t=0.75 (dusk)
      const sunAngle = (t - 0.25) * Math.PI * 2;
      const sunHeight = Math.sin(t * Math.PI * 2);
      const sunRadius = 250;
      this.sunLight.position = new Vector3(
        Math.cos(sunAngle) * sunRadius,
        Math.max(10, sunHeight * sunRadius),
        Math.sin(sunAngle) * sunRadius * 0.5
      );

      // Intensity: peaks at noon (t=0.5), dim at midnight (t=0,1)
      const nightFactor = Math.sin(t * Math.PI);
      this.sunLight.intensity = 0.1 + nightFactor * 0.5;
      const skyR = 0.05 + nightFactor * 0.48;
      const skyG = 0.05 + nightFactor * 0.76;
      const skyB = 0.1 + nightFactor * 0.88;
      this.scene.clearColor = new Color4(skyR, skyG, skyB, 1.0);
      this.scene.fogColor = new Color3(skyR, skyG, skyB);
      // Night lights: fade in when dark (nightFactor < 0.3)
      const nightLightIntensity = Math.max(0, (0.3 - nightFactor) / 0.3) * 0.8;
      for (const light of this._nightLights) {
        light.intensity = nightLightIntensity;
      }
      // Dust more visible in daylight
      if (this._dustPS) {
        this._dustPS.color1 = new Color4(1, 1, 0.9, 0.04 + nightFactor * 0.1);
        this._dustPS.color2 = new Color4(1, 1, 0.95, 0.03 + nightFactor * 0.06);
      }
    };

    this._speedChangeHandler = (e: Event) => {
      this._currentSimSpeed = (e as CustomEvent).detail;
    };
    window.addEventListener('onSpeedChange', this._speedChangeHandler);

    // ── Ambient Dust Particles ──
    const dustTex = new DynamicTexture('dustTex', 32, this.scene, false);
    const dctx = dustTex.getContext();
    dctx.beginPath(); dctx.arc(16, 16, 14, 0, Math.PI * 2);
    dctx.fillStyle = 'white'; dctx.fill();
    dustTex.update();

    const dustPS = new ParticleSystem('ambientDust', 300, this.scene);
    dustPS.particleTexture = dustTex;
    dustPS.emitter = new Vector3(gridCenter, 0, gridCenter);
    dustPS.minEmitBox = new Vector3(-gridCenter * 0.5, 2, -gridCenter * 0.5);
    dustPS.maxEmitBox = new Vector3(gridCenter * 0.5, 15, gridCenter * 0.5);
    dustPS.color1 = new Color4(1, 1, 0.9, 0.12);
    dustPS.color2 = new Color4(1, 1, 0.95, 0.08);
    dustPS.colorDead = new Color4(1, 1, 1, 0);
    dustPS.minSize = 0.02; dustPS.maxSize = 0.08;
    dustPS.minLifeTime = 3; dustPS.maxLifeTime = 8;
    dustPS.emitRate = 8;
    dustPS.blendMode = ParticleSystem.BLENDMODE_ADDITIVE;
    dustPS.gravity = new Vector3(0, -0.15, 0);
    dustPS.direction1 = new Vector3(-0.1, 0.05, -0.1);
    dustPS.direction2 = new Vector3(0.1, 0.15, 0.1);
    dustPS.minEmitPower = 0.1; dustPS.maxEmitPower = 0.5;
    dustPS.updateSpeed = 0.005;
    dustPS.start();
    this._dustPS = dustPS;

    // ── Night Lighting ──
    this._nightLights = [];
    const gridCenterWorld = gridCenter;
    // Place lights along a central path
    for (let i = 1; i <= 5; i++) {
      const lx = gridCenterWorld + (i - 3) * 15;
      const light = new PointLight(`nightLight_${i}`, new Vector3(lx, 4, 20), this.scene);
      light.diffuse = new Color3(1.0, 0.85, 0.55);
      light.intensity = 0;
      light.range = 25;
      this._nightLights.push(light);
    }
    // Additional entrance lights
    for (let i = 0; i < 3; i++) {
      const light = new PointLight(`entryLight_${i}`, new Vector3(gridCenterWorld + (i - 1) * 10, 3, 6), this.scene);
      light.diffuse = new Color3(1.0, 0.9, 0.7);
      light.intensity = 0;
      light.range = 18;
      this._nightLights.push(light);
    }

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
    if (this._speedChangeHandler) {
      window.removeEventListener('onSpeedChange', this._speedChangeHandler);
    }
    this.soundManager.dispose();
    this._engine.dispose();
  }
}
