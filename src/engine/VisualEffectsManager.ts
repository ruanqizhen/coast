import { Scene, MeshBuilder, DynamicTexture, StandardMaterial, Color3, Vector3, Mesh } from '@babylonjs/core';

interface FloatText {
  mesh: Mesh;
  material: StandardMaterial;
  spawnedAt: number;
  duration: number;
  startY: number;
}

/**
 * VisualEffectsManager: emotion bubbles above visitors, floating income text.
 * Lightweight billboard-based visuals.
 */
export class VisualEffectsManager {
  private scene: Scene;
  private emotionMeshes: Map<string, Mesh> = new Map();
  private floatTexts: FloatText[] = [];
  private emojiTexCache: Map<string, DynamicTexture> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /** Draw a simple emoji face on a DynamicTexture */
  private getEmojiTexture(mood: 'happy' | 'neutral' | 'unhappy' | 'angry'): DynamicTexture {
    if (this.emojiTexCache.has(mood)) return this.emojiTexCache.get(mood)!;

    const tex = new DynamicTexture(`emoji_${mood}`, 64, this.scene, false);
    const ctx = tex.getContext();

    // Face circle
    const colors: Record<string, { bg: string; eye: string; mouth: string }> = {
      happy:   { bg: '#4CAF50', eye: '#1a1a1a', mouth: '#1a1a1a' },
      neutral: { bg: '#FFC107', eye: '#1a1a1a', mouth: '#1a1a1a' },
      unhappy: { bg: '#FF9800', eye: '#1a1a1a', mouth: '#1a1a1a' },
      angry:   { bg: '#F44336', eye: '#1a1a1a', mouth: '#1a1a1a' },
    };
    const c = colors[mood];

    ctx.fillStyle = c.bg;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = c.eye;
    ctx.beginPath();
    ctx.arc(22, 22, 4, 0, Math.PI * 2);
    ctx.arc(42, 22, 4, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = c.mouth;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (mood === 'happy') {
      ctx.arc(32, 30, 14, 0.1, Math.PI - 0.1);
    } else if (mood === 'neutral') {
      ctx.moveTo(20, 38);
      ctx.lineTo(44, 38);
    } else if (mood === 'unhappy') {
      ctx.arc(32, 48, 12, Math.PI + 0.3, -0.3);
    } else {
      ctx.arc(32, 42, 10, Math.PI + 0.3, -0.3);
    }
    ctx.stroke();

    tex.update();
    this.emojiTexCache.set(mood, tex);
    return tex;
  }

  /** Update or create emotion bubble above a visitor */
  updateVisitorEmotion(visitorId: string, satisfaction: number, worldPos: Vector3) {
    let mood: 'happy' | 'neutral' | 'unhappy' | 'angry';
    if (satisfaction >= 70) mood = 'happy';
    else if (satisfaction >= 40) mood = 'neutral';
    else if (satisfaction >= 20) mood = 'unhappy';
    else mood = 'angry';

    let mesh = this.emotionMeshes.get(visitorId);
    if (!mesh) {
      mesh = MeshBuilder.CreatePlane(`emotion_${visitorId}`, { width: 0.6, height: 0.6 }, this.scene);
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.isPickable = false;
      this.emotionMeshes.set(visitorId, mesh);
    }

    const tex = this.getEmojiTexture(mood);
    if (mesh.material) (mesh.material as StandardMaterial).dispose();
    const mat = new StandardMaterial(`emojiMat_${visitorId}`, this.scene);
    mat.diffuseTexture = tex;
    mat.diffuseTexture.hasAlpha = true;
    mat.useAlphaFromDiffuseTexture = true;
    mat.backFaceCulling = false;
    mesh.material = mat;

    mesh.position.copyFromFloats(worldPos.x, worldPos.y + 2.2, worldPos.z);
  }

  /** Remove emotion bubble */
  removeVisitorEmotion(visitorId: string) {
    const mesh = this.emotionMeshes.get(visitorId);
    if (mesh) {
      if (mesh.material) (mesh.material as StandardMaterial).dispose();
      mesh.dispose();
      this.emotionMeshes.delete(visitorId);
    }
  }

  /** Spawn floating income text above a position */
  spawnIncomePopup(worldPos: Vector3, amount: number) {
    // Create dynamic texture with text
    const tex = new DynamicTexture(`popup_${Date.now()}`, 128, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, 128, 128);
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.fillStyle = '#F4A223';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+$${amount}`, 64, 64);
    tex.update();

    const mat = new StandardMaterial(`popupMat_${Date.now()}`, this.scene);
    mat.diffuseTexture = tex;
    mat.diffuseTexture.hasAlpha = true;
    mat.useAlphaFromDiffuseTexture = true;
    mat.backFaceCulling = false;
    mat.emissiveColor = new Color3(0.3, 0.2, 0);

    const mesh = MeshBuilder.CreatePlane(`popup_${Date.now()}`, { width: 2.5, height: 1.2 }, this.scene);
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.material = mat;
    mesh.position.copyFromFloats(worldPos.x, worldPos.y + 3, worldPos.z);
    mesh.isPickable = false;

    this.floatTexts.push({
      mesh, material: mat,
      spawnedAt: Date.now(),
      duration: 2000,
      startY: mesh.position.y,
    });
  }

  /** Update floating texts (call each frame) */
  update() {
    const now = Date.now();
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      const elapsed = now - ft.spawnedAt;
      const progress = elapsed / ft.duration;
      if (progress >= 1) {
        ft.material.dispose();
        ft.mesh.dispose();
        this.floatTexts.splice(i, 1);
      } else {
        ft.mesh.position.y = ft.startY + progress * 2;
        ft.material.alpha = 1 - progress;
      }
    }
  }

  dispose() {
    for (const [, mesh] of this.emotionMeshes) {
      if (mesh.material) (mesh.material as StandardMaterial).dispose();
      mesh.dispose();
    }
    this.emotionMeshes.clear();
    for (const ft of this.floatTexts) {
      ft.material.dispose();
      ft.mesh.dispose();
    }
    this.floatTexts.length = 0;
    for (const [, tex] of this.emojiTexCache) tex.dispose();
    this.emojiTexCache.clear();
  }
}
