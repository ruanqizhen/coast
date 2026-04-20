import { Scene, Sound } from '@babylonjs/core';

/**
 * SoundManager: audio framework using Babylon.js Sound API.
 * Ships in mute mode — ready to accept audio assets.
 */
export class SoundManager {
  private enabled: boolean = false;
  private bgmTracks: Sound[] = [];
  
  // Sound categories for spatial audio
  private facilitySounds: Map<string, Sound> = new Map();

  constructor(scene: Scene) {
      // Scene parameter is passed for future audio implementation
      void scene;
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
      void vol; // Placeholder
  }

  /** Set BGM volume (0-1) */
  setBGMVolume(vol: number) {
    const finalVol = Math.max(0, Math.min(1, vol));
    for (const track of this.bgmTracks) {
      track.setVolume(finalVol);
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
    void heavy; // Placeholder
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
    // Placeholder: would load 3 tracks and cycle them
  }

  /** Stop BGM */
  stopBGM() {
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
