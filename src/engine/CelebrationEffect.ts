import { Scene, ParticleSystem, DynamicTexture, Color4, Vector3 } from '@babylonjs/core';

/**
 * CelebrationEffect: golden particle burst when park achieves a new star rating.
 */
export class CelebrationEffect {
  static trigger(scene: Scene, position: Vector3) {
    const tex = new DynamicTexture('celebTex', 64, scene, false);
    const ctx = tex.getContext();
    // Star-shaped particle
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    // Inner glow
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 28);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,240,200,0.6)');
    grad.addColorStop(1, 'rgba(255,200,50,0)');
    ctx.fillStyle = grad;
    ctx.fill();
    tex.update();

    const ps = new ParticleSystem('celebration', 200, scene);
    ps.particleTexture = tex;
    ps.emitter = position;
    ps.minEmitBox = new Vector3(-5, 0, -5);
    ps.maxEmitBox = new Vector3(5, 2, 5);
    ps.color1 = new Color4(1, 0.85, 0.2, 1);
    ps.color2 = new Color4(1, 0.95, 0.5, 0.8);
    ps.colorDead = new Color4(1, 0.8, 0.1, 0);
    ps.minSize = 0.15; ps.maxSize = 0.5;
    ps.minLifeTime = 1.0; ps.maxLifeTime = 2.5;
    ps.emitRate = 200;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, 3, 0);
    ps.direction1 = new Vector3(-5, 8, -5);
    ps.direction2 = new Vector3(5, 15, 5);
    ps.minEmitPower = 1; ps.maxEmitPower = 4;
    ps.updateSpeed = 0.01;
    ps.targetStopDuration = 1.5;
    ps.start();

    // Auto-dispose after 3 seconds
    setTimeout(() => {
      ps.stop();
      setTimeout(() => { ps.dispose(); tex.dispose(); }, 1500);
    }, 2500);
  }
}
