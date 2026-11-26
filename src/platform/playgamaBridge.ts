// Modular Playgama Bridge v2 SDK Adapter
// Safely initializes Playgama Bridge when running inside Playgama and falls back
// cleanly to standalone browser mode (localStorage + ad-free fallback) outside it.

export type AdLifecycleState =
  | 'loading'
  | 'opened'
  | 'closed'
  | 'rewarded'
  | 'failed';

export interface RewardedAdExecutionResult {
  completed: boolean;
  rewarded: boolean;
  status: 'rewarded' | 'closed_early' | 'failed' | 'unavailable' | 'in_progress';
}

export interface InterstitialAdExecutionResult {
  shown: boolean;
  status: 'closed' | 'failed' | 'unavailable' | 'in_progress';
}

export interface LoadedStorageEntries {
  platform: Record<string, string | null>;
  local: Record<string, string | null>;
  usedPlatform: boolean;
}

interface PlaygamaBridgeGlobal {
  isInitialized?: boolean;
  EVENT_NAME?: {
    AUDIO_STATE_CHANGED?: string;
    PAUSE_STATE_CHANGED?: string;
    VISIBILITY_STATE_CHANGED?: string;
    REWARDED_STATE_CHANGED?: string;
    INTERSTITIAL_STATE_CHANGED?: string;
  };
  initialize?: (options?: Record<string, unknown>) => Promise<void>;
  platform?: {
    id?: string;
    language?: string;
    isAudioEnabled?: boolean;
    sendMessage?: (message: string) => void;
    on?: (event: string, cb: (payload: unknown) => void) => void;
    off?: (event: string, cb: (payload: unknown) => void) => void;
  };
  game?: {
    visibilityState?: string;
    on?: (event: string, cb: (state: string) => void) => void;
    off?: (event: string, cb: (state: string) => void) => void;
  };
  storage?: {
    isSupported?: (storageType?: string) => boolean;
    get?: (
      keys: string[] | string
    ) => Promise<unknown[] | Record<string, unknown>>;
    set?: (
      keysOrData: string[] | string | Record<string, unknown>,
      values?: unknown[] | unknown
    ) => Promise<void>;
  };
  advertisement?: {
    isRewardedSupported?: boolean;
    isInterstitialSupported?: boolean;
    rewardedState?: string;
    interstitialState?: string;
    minimumDelayBetweenInterstitial?: number;
    setMinimumDelayBetweenInterstitial?: (delaySec: number) => void;
    showRewarded?: (placement?: string) => Promise<void>;
    showInterstitial?: (placement?: string) => Promise<void>;
    on?: (event: string, cb: (state: string) => void) => void;
    off?: (event: string, cb: (state: string) => void) => void;
  };
}

declare global {
  interface Window {
    bridge?: PlaygamaBridgeGlobal;
  }
}

const DEFAULT_INIT_TIMEOUT_MS = 3500;
const AD_SETTLE_AFTER_PROMISE_MS = 1200;
const AD_HARD_TIMEOUT_MS = 90000;

function getWindowRef(): (Window & typeof globalThis) | undefined {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
    return (globalThis as unknown as { window?: Window & typeof globalThis })
      .window;
  }
  return undefined;
}

function getDocumentRef(): Document | undefined {
  if (typeof document !== 'undefined') return document;
  return undefined;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function waitForBridgeScriptIfPending(maxWaitMs = 1500): Promise<void> {
  const win = getWindowRef();
  const doc = getDocumentRef();
  if (!win || !doc || win.bridge) {
    return Promise.resolve();
  }
  const scriptEl = doc.getElementById(
    'playgama-bridge-sdk'
  ) as HTMLScriptElement | null;
  if (!scriptEl) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      scriptEl.removeEventListener('load', finish);
      scriptEl.removeEventListener('error', finish);
      resolve();
    };
    const timer = setTimeout(finish, maxWaitMs);
    scriptEl.addEventListener('load', finish, { once: true });
    scriptEl.addEventListener('error', finish, { once: true });
  });
}

class PlaygamaPlatformAdapter {
  private initPromise: Promise<void> | null = null;
  private initialized = false;
  private isPlaygamaHost = false;
  private gameReadySent = false;
  private lastGameplayMessage: 'gameplay_started' | 'gameplay_stopped' | null =
    null;

  private platformAudioEnabled = true;
  private platformPaused = false;
  private adPlaying = false;
  private eventsAttached = false;

  private audioListeners = new Set<(enabled: boolean) => void>();
  private pauseListeners = new Set<(paused: boolean) => void>();
  private adStateListeners = new Set<(isPlaying: boolean) => void>();
  private rewardedEventListeners = new Set<(state: string) => void>();
  private interstitialEventListeners = new Set<(state: string) => void>();

  async init(options?: { timeoutMs?: number }): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    const timeoutMs = options?.timeoutMs ?? DEFAULT_INIT_TIMEOUT_MS;
    this.initPromise = (async () => {
      try {
        await waitForBridgeScriptIfPending(1500);
        const win = getWindowRef();
        const bridge = win?.bridge;
        if (!bridge?.initialize) {
          this.isPlaygamaHost = false;
          this.platformAudioEnabled = true;
          return;
        }

        if (bridge.isInitialized !== true) {
          await withTimeout(Promise.resolve(bridge.initialize()), timeoutMs);
        }

        if (
          typeof bridge.isInitialized === 'boolean' &&
          !bridge.isInitialized
        ) {
          this.isPlaygamaHost = false;
          this.platformAudioEnabled = true;
          return;
        }

        this.isPlaygamaHost = true;
        this.platformAudioEnabled =
          typeof bridge.platform?.isAudioEnabled === 'boolean'
            ? bridge.platform.isAudioEnabled
            : true;
        this.attachSdkListeners(bridge);
        this.notifyAudioSubscribers();
      } catch {
        this.isPlaygamaHost = false;
        this.platformAudioEnabled = true;
      } finally {
        this.initialized = true;
      }
    })();

    return this.initPromise;
  }

  private attachSdkListeners(bridge: PlaygamaBridgeGlobal): void {
    if (this.eventsAttached) return;
    this.eventsAttached = true;

    const audioEvent =
      bridge.EVENT_NAME?.AUDIO_STATE_CHANGED ?? 'audio_state_changed';
    const pauseEvent =
      bridge.EVENT_NAME?.PAUSE_STATE_CHANGED ?? 'pause_state_changed';
    const visEvent =
      bridge.EVENT_NAME?.VISIBILITY_STATE_CHANGED ?? 'visibility_state_changed';
    const rewardedEvent =
      bridge.EVENT_NAME?.REWARDED_STATE_CHANGED ?? 'rewarded_state_changed';
    const interstitialEvent =
      bridge.EVENT_NAME?.INTERSTITIAL_STATE_CHANGED ??
      'interstitial_state_changed';

    bridge.platform?.on?.(audioEvent, (payload) => {
      if (typeof payload === 'boolean') {
        this.platformAudioEnabled = payload;
        this.notifyAudioSubscribers();
      }
    });

    bridge.platform?.on?.(pauseEvent, (payload) => {
      if (typeof payload === 'boolean') {
        this.platformPaused = payload;
        this.pauseListeners.forEach((cb) => cb(this.platformPaused));
      }
    });

    bridge.game?.on?.(visEvent, (state) => {
      if (state === 'hidden') {
        this.pauseListeners.forEach((cb) => cb(true));
      } else if (state === 'visible' && !this.platformPaused) {
        this.pauseListeners.forEach((cb) => cb(false));
      }
    });

    bridge.advertisement?.on?.(rewardedEvent, (state) => {
      this.rewardedEventListeners.forEach((cb) => cb(String(state)));
    });

    bridge.advertisement?.on?.(interstitialEvent, (state) => {
      this.interstitialEventListeners.forEach((cb) => cb(String(state)));
    });
  }

  private notifyAudioSubscribers(): void {
    this.audioListeners.forEach((cb) => cb(this.platformAudioEnabled));
  }

  private setAdPlaying(playing: boolean): void {
    if (this.adPlaying === playing) return;
    this.adPlaying = playing;
    this.adStateListeners.forEach((cb) => cb(playing));
  }

  private canUseSdk(): boolean {
    if (!this.isPlaygamaHost) return false;
    const bridge = getWindowRef()?.bridge;
    if (!bridge) return false;
    if (typeof bridge.isInitialized === 'boolean' && !bridge.isInitialized) {
      return false;
    }
    return true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isSdkAvailable(): boolean {
    return this.canUseSdk();
  }

  getPlatformId(): string {
    if (!this.canUseSdk()) return 'standalone';
    return getWindowRef()?.bridge?.platform?.id ?? 'standalone';
  }

  getLanguage(): string {
    if (!this.canUseSdk()) return 'en';
    const lang = getWindowRef()?.bridge?.platform?.language;
    return typeof lang === 'string' && lang.trim().length > 0 ? lang : 'en';
  }

  isAudioEnabled(): boolean {
    return this.platformAudioEnabled;
  }

  isAdPlaying(): boolean {
    return this.adPlaying;
  }

  notifyGameReady(): void {
    if (!this.canUseSdk() || this.gameReadySent) return;
    this.gameReadySent = true;
    try {
      getWindowRef()?.bridge?.platform?.sendMessage?.('game_ready');
    } catch {
      // Ignore host messaging errors
    }
  }

  notifyGameplayStart(): void {
    if (!this.canUseSdk()) return;
    if (this.lastGameplayMessage === 'gameplay_started') return;
    this.lastGameplayMessage = 'gameplay_started';
    try {
      getWindowRef()?.bridge?.platform?.sendMessage?.('gameplay_started');
    } catch {
      // Ignore host messaging errors
    }
  }

  notifyGameplayStop(): void {
    if (!this.canUseSdk()) return;
    if (this.lastGameplayMessage === 'gameplay_stopped') return;
    this.lastGameplayMessage = 'gameplay_stopped';
    try {
      getWindowRef()?.bridge?.platform?.sendMessage?.('gameplay_stopped');
    } catch {
      // Ignore host messaging errors
    }
  }

  isRewardedAdsSupported(): boolean {
    if (!this.canUseSdk()) return false;
    const ads = getWindowRef()?.bridge?.advertisement;
    return Boolean(ads?.isRewardedSupported && ads?.showRewarded);
  }

  isInterstitialAdsSupported(): boolean {
    if (!this.canUseSdk()) return false;
    const ads = getWindowRef()?.bridge?.advertisement;
    return Boolean(ads?.isInterstitialSupported && ads?.showInterstitial);
  }

  getMinimumDelayBetweenInterstitialSec(): number {
    if (!this.canUseSdk()) return 0;
    const delay =
      getWindowRef()?.bridge?.advertisement?.minimumDelayBetweenInterstitial;
    return typeof delay === 'number' && Number.isFinite(delay) && delay >= 0
      ? delay
      : 0;
  }

  async showRewardedAd(
    placementId?: string
  ): Promise<RewardedAdExecutionResult> {
    if (!this.isRewardedAdsSupported()) {
      return { completed: false, rewarded: false, status: 'unavailable' };
    }
    if (this.adPlaying) {
      return { completed: false, rewarded: false, status: 'in_progress' };
    }

    const ads = getWindowRef()?.bridge?.advertisement;
    const showRewardedFn = ads?.showRewarded?.bind(ads);
    if (!ads || !showRewardedFn) {
      return { completed: false, rewarded: false, status: 'unavailable' };
    }

    this.setAdPlaying(true);

    return new Promise<RewardedAdExecutionResult>((resolve) => {
      let settled = false;
      let sawRewarded = false;
      let postPromiseTimer: ReturnType<typeof setTimeout> | null = null;
      let hardTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = (result: RewardedAdExecutionResult) => {
        if (settled) return;
        settled = true;
        if (postPromiseTimer !== null) clearTimeout(postPromiseTimer);
        if (hardTimer !== null) clearTimeout(hardTimer);
        this.rewardedEventListeners.delete(onStateChange);
        this.setAdPlaying(false);
        resolve(result);
      };

      const onStateChange = (state: string) => {
        if (state === 'rewarded') {
          sawRewarded = true;
          return;
        }
        if (state === 'closed') {
          if (sawRewarded || ads.rewardedState === 'rewarded') {
            finish({ completed: true, rewarded: true, status: 'rewarded' });
          } else {
            finish({
              completed: false,
              rewarded: false,
              status: 'closed_early',
            });
          }
          return;
        }
        if (state === 'failed') {
          finish({ completed: false, rewarded: false, status: 'failed' });
        }
      };

      this.rewardedEventListeners.add(onStateChange);

      hardTimer = setTimeout(() => {
        finish({
          completed: sawRewarded,
          rewarded: sawRewarded,
          status: sawRewarded ? 'rewarded' : 'failed',
        });
      }, AD_HARD_TIMEOUT_MS);

      try {
        const callPromise =
          placementId !== undefined
            ? showRewardedFn(placementId)
            : showRewardedFn();

        Promise.resolve(callPromise).then(
          () => {
            if (settled) return;
            // Some host implementations emit 'rewarded'/'closed' synchronously or right after promise resolve
            if (ads.rewardedState === 'rewarded') {
              sawRewarded = true;
            }
            if (ads.rewardedState === 'closed' || ads.rewardedState === 'failed') {
              onStateChange(ads.rewardedState);
              return;
            }
            postPromiseTimer = setTimeout(() => {
              if (sawRewarded || ads.rewardedState === 'rewarded') {
                finish({ completed: true, rewarded: true, status: 'rewarded' });
              } else {
                finish({
                  completed: false,
                  rewarded: false,
                  status: 'closed_early',
                });
              }
            }, AD_SETTLE_AFTER_PROMISE_MS);
          },
          () => {
            finish({ completed: false, rewarded: false, status: 'failed' });
          }
        );
      } catch {
        finish({ completed: false, rewarded: false, status: 'failed' });
      }
    });
  }

  async showInterstitialAd(
    placementId?: string
  ): Promise<InterstitialAdExecutionResult> {
    if (!this.isInterstitialAdsSupported()) {
      return { shown: false, status: 'unavailable' };
    }
    if (this.adPlaying) {
      return { shown: false, status: 'in_progress' };
    }

    const ads = getWindowRef()?.bridge?.advertisement;
    const showInterstitialFn = ads?.showInterstitial?.bind(ads);
    if (!ads || !showInterstitialFn) {
      return { shown: false, status: 'unavailable' };
    }

    this.setAdPlaying(true);

    return new Promise<InterstitialAdExecutionResult>((resolve) => {
      let settled = false;
      let sawOpened = false;
      let postPromiseTimer: ReturnType<typeof setTimeout> | null = null;
      let hardTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = (result: InterstitialAdExecutionResult) => {
        if (settled) return;
        settled = true;
        if (postPromiseTimer !== null) clearTimeout(postPromiseTimer);
        if (hardTimer !== null) clearTimeout(hardTimer);
        this.interstitialEventListeners.delete(onStateChange);
        this.setAdPlaying(false);
        resolve(result);
      };

      const onStateChange = (state: string) => {
        if (state === 'opened') {
          sawOpened = true;
          return;
        }
        if (state === 'closed') {
          finish({ shown: true, status: 'closed' });
          return;
        }
        if (state === 'failed') {
          finish({ shown: false, status: 'failed' });
        }
      };

      this.interstitialEventListeners.add(onStateChange);

      hardTimer = setTimeout(() => {
        finish({ shown: sawOpened, status: sawOpened ? 'closed' : 'failed' });
      }, AD_HARD_TIMEOUT_MS);

      try {
        const callPromise =
          placementId !== undefined
            ? showInterstitialFn(placementId)
            : showInterstitialFn();

        Promise.resolve(callPromise).then(
          () => {
            if (settled) return;
            if (ads.interstitialState === 'closed') {
              finish({ shown: true, status: 'closed' });
              return;
            }
            if (ads.interstitialState === 'failed') {
              finish({ shown: false, status: 'failed' });
              return;
            }
            postPromiseTimer = setTimeout(() => {
              finish({
                shown: sawOpened,
                status: sawOpened ? 'closed' : 'failed',
              });
            }, AD_SETTLE_AFTER_PROMISE_MS);
          },
          () => {
            finish({ shown: false, status: 'failed' });
          }
        );
      } catch {
        finish({ shown: false, status: 'failed' });
      }
    });
  }

  onAudioStateChange(handler: (isEnabled: boolean) => void): () => void {
    this.audioListeners.add(handler);
    return () => {
      this.audioListeners.delete(handler);
    };
  }

  onPauseStateChange(handler: (isPaused: boolean) => void): () => void {
    this.pauseListeners.add(handler);
    return () => {
      this.pauseListeners.delete(handler);
    };
  }

  onAdStateChange(handler: (isPlaying: boolean) => void): () => void {
    this.adStateListeners.add(handler);
    return () => {
      this.adStateListeners.delete(handler);
    };
  }

  onVisibilityChange(handler: (isHidden: boolean) => void): () => void {
    const doc = getDocumentRef();
    const win = getWindowRef();

    const onBrowserVis = () => {
      if (doc) {
        handler(Boolean(doc.hidden));
      }
    };
    const onWindowBlur = () => {
      handler(true);
    };
    const onWindowFocus = () => {
      if (!doc?.hidden) {
        handler(false);
      }
    };

    doc?.addEventListener('visibilitychange', onBrowserVis);
    win?.addEventListener('blur', onWindowBlur);
    win?.addEventListener('focus', onWindowFocus);

    return () => {
      doc?.removeEventListener('visibilitychange', onBrowserVis);
      win?.removeEventListener('blur', onWindowBlur);
      win?.removeEventListener('focus', onWindowFocus);
    };
  }

  isFullscreenSupported(): boolean {
    const doc = getDocumentRef() as
      | (Document & {
          webkitFullscreenEnabled?: boolean;
          fullscreenEnabled?: boolean;
        })
      | undefined;
    if (!doc) return false;
    const el = doc.documentElement as
      | (HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void })
      | null;
    if (!el) return false;
    const enabledFlag =
      typeof doc.fullscreenEnabled === 'boolean'
        ? doc.fullscreenEnabled
        : typeof doc.webkitFullscreenEnabled === 'boolean'
          ? doc.webkitFullscreenEnabled
          : true;
    return Boolean(
      enabledFlag && (el.requestFullscreen || el.webkitRequestFullscreen)
    );
  }

  isFullscreenActive(): boolean {
    const doc = getDocumentRef() as
      | (Document & { webkitFullscreenElement?: Element | null })
      | undefined;
    if (!doc) return false;
    return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
  }

  async toggleFullscreen(): Promise<boolean> {
    const doc = getDocumentRef() as
      | (Document & {
          webkitFullscreenElement?: Element | null;
          webkitExitFullscreen?: () => Promise<void> | void;
        })
      | undefined;
    if (!doc || !this.isFullscreenSupported()) return false;

    try {
      if (this.isFullscreenActive()) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        return false;
      }

      const target = doc.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      if (target.requestFullscreen) {
        await target.requestFullscreen();
        return true;
      }
      if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
        return true;
      }
      return false;
    } catch {
      return this.isFullscreenActive();
    }
  }

  onFullscreenChange(handler: (isFullscreen: boolean) => void): () => void {
    const doc = getDocumentRef();
    if (!doc) return () => {};
    const onChange = () => {
      handler(this.isFullscreenActive());
    };
    doc.addEventListener('fullscreenchange', onChange);
    doc.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      doc.removeEventListener('fullscreenchange', onChange);
      doc.removeEventListener('webkitfullscreenchange', onChange);
    };
  }

  async loadStorageEntries(keys: string[]): Promise<LoadedStorageEntries> {
    const platform: Record<string, string | null> = {};
    const local: Record<string, string | null> = {};
    for (let i = 0; i < keys.length; i++) {
      platform[keys[i]] = null;
      local[keys[i]] = null;
    }

    const win = getWindowRef();
    let usedPlatform = false;

    if (this.canUseSdk() && win?.bridge?.storage?.get) {
      try {
        const res = await withTimeout(
          Promise.resolve(win.bridge.storage.get(keys)),
          2500
        );
        usedPlatform = true;
        if (Array.isArray(res)) {
          for (let i = 0; i < keys.length; i++) {
            const v = res[i];
            platform[keys[i]] =
              typeof v === 'string'
                ? v
                : v !== null && v !== undefined && typeof v === 'object'
                  ? JSON.stringify(v)
                  : null;
          }
        } else if (res && typeof res === 'object') {
          const obj = res as Record<string, unknown>;
          for (let i = 0; i < keys.length; i++) {
            const v = obj[keys[i]];
            platform[keys[i]] =
              typeof v === 'string'
                ? v
                : v !== null && v !== undefined && typeof v === 'object'
                  ? JSON.stringify(v)
                  : null;
          }
        }
      } catch {
        usedPlatform = false;
      }
    }

    try {
      const storage = win?.localStorage;
      if (storage) {
        for (let i = 0; i < keys.length; i++) {
          local[keys[i]] = storage.getItem(keys[i]);
        }
      }
    } catch {
      // Ignore storage restrictions
    }

    return { platform, local, usedPlatform };
  }

  async saveStorageEntries(entries: Record<string, string>): Promise<void> {
    const keys = Object.keys(entries);
    if (keys.length === 0) return;
    const values = keys.map((k) => entries[k]);
    const win = getWindowRef();

    if (this.canUseSdk() && win?.bridge?.storage?.set) {
      try {
        await win.bridge.storage.set(keys, values);
      } catch {
        // Fallback/continue to localStorage below
      }
    }

    try {
      const storage = win?.localStorage;
      if (storage) {
        for (let i = 0; i < keys.length; i++) {
          storage.setItem(keys[i], values[i]);
        }
      }
    } catch {
      // Ignore storage quota errors in restricted sandboxes
    }
  }

  async loadStorage(key: string): Promise<string | null> {
    const loaded = await this.loadStorageEntries([key]);
    return loaded.platform[key] ?? loaded.local[key] ?? null;
  }

  async saveStorage(key: string, value: string): Promise<void> {
    await this.saveStorageEntries({ [key]: value });
  }

  resetForTests(): void {
    this.initPromise = null;
    this.initialized = false;
    this.isPlaygamaHost = false;
    this.gameReadySent = false;
    this.lastGameplayMessage = null;
    this.platformAudioEnabled = true;
    this.platformPaused = false;
    this.adPlaying = false;
    this.eventsAttached = false;
    this.audioListeners.clear();
    this.pauseListeners.clear();
    this.adStateListeners.clear();
    this.rewardedEventListeners.clear();
    this.interstitialEventListeners.clear();
  }
}

export const playgamaBridge = new PlaygamaPlatformAdapter();
