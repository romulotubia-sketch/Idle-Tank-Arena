// Lightweight Web Audio API sound effects and ambient tactical music controller

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

const AMBIENT_PROGRESSION: readonly number[] = [
  110.0, // A2
  130.81, // C3
  146.83, // D3
  130.81, // C3
  98.0, // G2
  130.81, // C3
  123.47, // B2
  110.0, // A2
];

class SoundEffectsController {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private enabled = true;
  private soundVolume = 0.75;
  private musicEnabled = true;
  private musicVolume = 0.4;
  private musicShouldPlay = false;
  private musicTimerId: number | null = null;
  private musicStep = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.updateSfxMasterGain();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setSoundVolume(volume: number): void {
    this.soundVolume = clampVolume(volume);
    this.updateSfxMasterGain();
  }

  getSoundVolume(): number {
    return this.soundVolume;
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.refreshMusicState();
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = clampVolume(volume);
    this.refreshMusicState();
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  syncMusicPlayback(shouldPlay: boolean): void {
    this.musicShouldPlay = shouldPlay;
    this.refreshMusicState();
  }

  unlockAudio(): void {
    const ctx = this.ensureBaseContext();
    if (!ctx) return;
    if (this.musicEnabled && this.musicShouldPlay && this.musicVolume > 0) {
      this.startMusicLoop();
    }
  }

  private ensureBaseContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (!this.ctx) return null;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.sfxGain) {
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.enabled ? this.soundVolume : 0;
      this.sfxGain.connect(this.ctx.destination);
    }

    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value =
        this.musicEnabled && this.musicShouldPlay
          ? this.musicVolume * 0.22
          : 0;
      this.musicGain.connect(this.ctx.destination);
    }

    return this.ctx;
  }

  private updateSfxMasterGain(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const target = this.enabled ? this.soundVolume : 0;
    this.sfxGain.gain.setTargetAtTime(target, now, 0.02);
  }

  private refreshMusicState(): void {
    const active =
      this.musicEnabled && this.musicShouldPlay && this.musicVolume > 0.005;
    if (!active) {
      this.stopMusicLoop();
      if (this.ctx && this.musicGain) {
        this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      }
      return;
    }

    const ctx = this.ensureBaseContext();
    if (ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(
        this.musicVolume * 0.22,
        ctx.currentTime,
        0.08
      );
      this.startMusicLoop();
    }
  }

  private startMusicLoop(): void {
    if (typeof window === 'undefined') return;
    if (this.musicTimerId !== null) return;

    this.scheduleAmbientBar();
    this.musicTimerId = window.setInterval(() => {
      if (!this.musicEnabled || !this.musicShouldPlay || this.musicVolume <= 0.005) {
        this.stopMusicLoop();
        return;
      }
      this.scheduleAmbientBar();
    }, 1500);
  }

  private stopMusicLoop(): void {
    if (typeof window === 'undefined') return;
    if (this.musicTimerId !== null) {
      window.clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
  }

  private scheduleAmbientBar(): void {
    const ctx = this.ctx;
    const musicBus = this.musicGain;
    if (!ctx || !musicBus || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const rootFreq =
      AMBIENT_PROGRESSION[this.musicStep % AMBIENT_PROGRESSION.length];
    const harmonyFreq = rootFreq * (this.musicStep % 2 === 0 ? 1.5 : 1.2);
    this.musicStep++;

    // Warm low-pass filtered pad note
    const padOsc = ctx.createOscillator();
    const padFilter = ctx.createBiquadFilter();
    const padEnv = ctx.createGain();

    padOsc.type = 'triangle';
    padOsc.frequency.setValueAtTime(rootFreq, now);
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(340, now);

    padEnv.gain.setValueAtTime(0.0001, now);
    padEnv.gain.linearRampToValueAtTime(0.32, now + 0.35);
    padEnv.gain.exponentialRampToValueAtTime(0.0008, now + 1.48);

    padOsc.connect(padFilter);
    padFilter.connect(padEnv);
    padEnv.connect(musicBus);

    padOsc.start(now);
    padOsc.stop(now + 1.5);

    // Gentle fifth/minor-third tactical shimmer
    const chimeOsc = ctx.createOscillator();
    const chimeEnv = ctx.createGain();
    chimeOsc.type = 'sine';
    chimeOsc.frequency.setValueAtTime(harmonyFreq * 2, now + 0.15);

    chimeEnv.gain.setValueAtTime(0.0001, now + 0.15);
    chimeEnv.gain.linearRampToValueAtTime(0.11, now + 0.32);
    chimeEnv.gain.exponentialRampToValueAtTime(0.0005, now + 1.35);

    chimeOsc.connect(chimeEnv);
    chimeEnv.connect(musicBus);

    chimeOsc.start(now + 0.15);
    chimeOsc.stop(now + 1.4);
  }

  private ensureContext(): { ctx: AudioContext; destination: GainNode } | null {
    if (!this.enabled || this.soundVolume <= 0.005 || typeof window === 'undefined') {
      return null;
    }
    const ctx = this.ensureBaseContext();
    if (!ctx || !this.sfxGain) return null;
    return { ctx, destination: this.sfxGain };
  }

  playClick(pitch = 520): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.72, now + 0.045);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.055);
  }

  playDeploy(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const notes = [330, 440, 587];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.055;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.055, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  playCannonFire(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.11);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.125);
  }

  playHit(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  playExplosion(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  playDefeat(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const notes = [310, 240, 175];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.11;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.045, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + 0.23);
    });
  }

  playSummon(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const notes = [440, 554, 659];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.045;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + 0.14);
    });
  }

  playSkillUpgrade(newLevel: number): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const base = 420 + (newLevel - 2) * 55;
    const notes = [base, base * 1.25, base * 1.5, base * 2];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.04;

      osc.type = idx === notes.length - 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + 0.17);
    });
  }

  playInvalid(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(135, now + 0.12);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  playWaveClear(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.055, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + 0.19);
    });
  }

  playBossAlert(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const notes = [180, 145, 180];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.14;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.05, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + 0.13);
    });
  }

  playUpgrade(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const notes = [480, 640];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.04;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.055, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + 0.13);
    });
  }

  playEquip(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const notes = [360, 540];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.035;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.055, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + 0.11);
    });
  }

  playUnequip(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.08);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.095);
  }

  playForgeStart(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const strikes = [0, 0.14];
    strikes.forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + offset;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 220 : 280, start);
      osc.frequency.exponentialRampToValueAtTime(110, start + 0.09);

      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + 0.11);
    });
  }

  playForgeComplete(rarityTier = 1): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const base = 440 + Math.max(0, rarityTier - 1) * 55;
    const notes = [base, base * 1.25, base * 1.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.05;

      osc.type = idx === 2 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + 0.17);
    });
  }

  playDismantle(): void {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, destination } = audio;

    const now = ctx.currentTime;
    const notes = [520, 680];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.04;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.05, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + 0.11);
    });
  }
}

export const soundEffects = new SoundEffectsController();
