import { Scene, Sound } from '@babylonjs/core';

let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (!sharedCtx) {
    try { sharedCtx = new AudioContext(); } catch { return null; }
  }
  if (sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
}

export class SoundManager {
  private enabled: boolean = true;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private rainNode: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private bgmNodes: OscillatorNode[] = [];
  private bgmPlaying: boolean = false;
  private scene: Scene | null = null;

  // Facility spatial sounds
  private facilitySounds: Map<string, Sound> = new Map();

  constructor(scene?: Scene) {
    this.scene = scene ?? null;
    const ctx = getCtx();
    if (ctx) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(ctx.destination);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = ctx.createGain();
      this.bgmGain.gain.value = 0.15;
      this.bgmGain.connect(this.masterGain);
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAllSounds();
    } else {
      this.startBGM();
    }
  }

  setSFXVolume(vol: number) {
    if (this.sfxGain) this.sfxGain.gain.value = Math.max(0, Math.min(1, vol));
  }

  setBGMVolume(vol: number) {
    if (this.bgmGain) this.bgmGain.gain.value = Math.max(0, Math.min(1, vol));
  }

  // ── UI Click: short high beep ──
  playUIClick() {
    if (!this.enabled) return;
    const ctx = getCtx(); if (!ctx || !this.sfxGain) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05);
  }

  // ── Placement: low thud ──
  playPlace() {
    if (!this.enabled) return;
    const ctx = getCtx(); if (!ctx || !this.sfxGain) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
  }

  // ── Demolish: lower rumble ──
  playDemolish() {
    if (!this.enabled) return;
    const ctx = getCtx(); if (!ctx || !this.sfxGain) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
  }

  // ── Error: buzz ──
  playError() {
    if (!this.enabled) return;
    const ctx = getCtx(); if (!ctx || !this.sfxGain) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 150;
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
  }

  // ── Breakdown alarm: repeating 3-tone pattern ──
  playBreakdownAlarm() {
    if (!this.enabled) return;
    const ctx = getCtx(); if (!ctx || !this.sfxGain) return;
    const freqs = [600, 450, 600];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.15;
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t); osc.stop(t + 0.12);
    });
  }

  // ── Rain ambient: filtered noise ──
  startRainSound(heavy: boolean = false) {
    if (!this.enabled) return;
    this.stopRainSound();
    const ctx = getCtx(); if (!ctx || !this.masterGain) return;

    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    this.rainNode = ctx.createBufferSource();
    this.rainNode.buffer = buffer;
    this.rainNode.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = heavy ? 400 : 800;
    bandpass.Q.value = heavy ? 0.5 : 1.2;

    this.rainGain = ctx.createGain();
    this.rainGain.gain.setValueAtTime(0, ctx.currentTime);
    this.rainGain.gain.linearRampToValueAtTime(heavy ? 0.06 : 0.03, ctx.currentTime + 1);

    this.rainNode.connect(bandpass);
    bandpass.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    this.rainNode.start();
  }

  stopRainSound() {
    if (!this.rainNode) return;
    const ctx = getCtx();
    if (ctx && this.rainGain) {
      this.rainGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    }
    const node = this.rainNode;
    setTimeout(() => { try { node.stop(); } catch {} }, 900);
    this.rainNode = null;
    this.rainGain = null;
  }

  // ── BGM: simple procedural melody loops ──
  startBGM() {
    if (!this.enabled || this.bgmPlaying) return;
    const ctx = getCtx(); if (!ctx || !this.bgmGain) return;
    this.bgmPlaying = true;

    // Gentle pentatonic melody
    const notes = [262, 294, 330, 392, 440, 523, 587, 659];
    const pattern = [0, 2, 4, 2, 0, 2, 5, 4, 2, 1, 0, 1, 4, 3, 2, 0];

    const playLoop = () => {
      if (!this.bgmPlaying || !this.enabled) return;
      const c = getCtx(); if (!c) return;
      const bpm = 100;
      const noteLen = 60 / bpm;

      pattern.forEach((ni, i) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = notes[ni % notes.length] * 0.5; // lower octave for bass
        const t = c.currentTime + i * noteLen * 0.5;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.08, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + noteLen * 0.45);
        osc.connect(g);
        g.connect(this.bgmGain!);
        osc.start(t);
        osc.stop(t + noteLen * 0.5);
        // Harmony line
        if (i % 2 === 0) {
          const osc2 = c.createOscillator();
          const g2 = c.createGain();
          osc2.type = 'triangle';
          osc2.frequency.value = notes[(ni + 4) % notes.length] * 0.25;
          g2.gain.setValueAtTime(0, t);
          g2.gain.linearRampToValueAtTime(0.05, t + 0.03);
          g2.gain.exponentialRampToValueAtTime(0.001, t + noteLen * 0.45);
          osc2.connect(g2);
          g2.connect(this.bgmGain!);
          osc2.start(t);
          osc2.stop(t + noteLen * 0.5);
        }
      });

      // Schedule next loop
      const loopDuration = pattern.length * noteLen * 0.5 * 1000;
      setTimeout(playLoop, loopDuration);
    };

    playLoop();
  }

  stopBGM() {
    this.bgmPlaying = false;
  }

  // ── Facility spatial sounds ──
  playFacilitySound(instanceId: string, typeId: string) {
    if (!this.enabled || !this.scene) return;
    // Placeholder for 3D spatial audio per facility type
    // Would load from audio assets or synthesize per-type loops
  }

  stopFacilitySound(instanceId: string) {
    const sound = this.facilitySounds.get(instanceId);
    if (sound) {
      sound.stop();
      this.facilitySounds.delete(instanceId);
    }
  }

  private stopAllSounds() {
    this.stopBGM();
    this.stopRainSound();
    for (const [, sound] of this.facilitySounds) {
      sound.stop();
    }
    this.facilitySounds.clear();
  }

  dispose() {
    this.stopAllSounds();
    this.facilitySounds.clear();
    this.bgmNodes = [];
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    this.sfxGain = null;
    this.bgmGain = null;
  }
}
