import { Scene, Sound } from '@babylonjs/core';

/**
 * SoundManager: audio framework using Babylon.js Sound API.
 * Ships in mute mode — ready to accept audio assets.
 */
export class SoundManager {
  private scene: Scene;
  private enabled: boolean = false;
  private bgmEnabled: boolean = false;
  private sfxVolume: number = 0.5;
  private bgmVolume: number = 0.3;

  private bgmTracks: Sound[] = [];
  private currentBgmIndex: number = 0;

  // Sound categories for spatial audio
  private facilitySounds: Map<string, Sound> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /** Enable/disable all sounds */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAllSounds();
    }
  }

  /** Set SFX volume (0-1) */
  setSFXVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  /** Set BGM volume (0-1) */
  setBGMVolume(vol: number) {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    for (const track of this.bgmTracks) {
      track.setVolume(this.bgmVolume);
    }
  }

  /** Play UI click sound */
  playUIClick() {
    if (!this.enabled) return;
    // Placeholder: would load and play a short click sound
    // new Sound("click", "/sounds/click.wav", this.scene, null, { volume: this.sfxVolume, autoplay: true });
  }

  /** Play placement sound */
  playPlace() {
    if (!this.enabled) return;
    // Placeholder
  }

  /** Play demolish sound */
  playDemolish() {
    if (!this.enabled) return;
    // Placeholder
  }

  /** Play error/invalid action sound */
  playError() {
    if (!this.enabled) return;
    // Placeholder
  }

  /** Play facility breakdown alarm */
  playBreakdownAlarm() {
    if (!this.enabled) return;
    // Placeholder
  }

  /** Start rain sound effect (looping, fade in) */
  startRainSound(heavy: boolean = false) {
    if (!this.enabled) return;
    // Placeholder: spatial rain ambient
  }

  /** Stop rain sound (fade out) */
  stopRainSound() {
    // Placeholder
  }

  /** Start BGM loop */
  startBGM() {
    if (!this.enabled) return;
    this.bgmEnabled = true;
    // Placeholder: would load 3 tracks and cycle them
  }

  /** Stop BGM */
  stopBGM() {
    this.bgmEnabled = false;
    for (const track of this.bgmTracks) {
      track.stop();
    }
  }

  /** Stop all sounds */
  private stopAllSounds() {
    this.stopBGM();
    this.stopRainSound();
    for (const [, sound] of this.facilitySounds) {
      sound.stop();
    }
  }

  dispose() {
    this.stopAllSounds();
    this.facilitySounds.clear();
    this.bgmTracks = [];
  }
}
