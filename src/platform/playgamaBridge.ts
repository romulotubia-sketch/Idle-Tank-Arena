// Lightweight adapter for Playgama Web Games SDK (Bridge)
// Safely falls back to browser localStorage when running outside Playgama's host wrapper.

interface PlaygamaBridgeGlobal {
  initialize?: () => Promise<void>;
  platform?: {
    sendMessage?: (message: string) => void;
    id?: string;
  };
  game?: {
    visibilityState?: string;
    on?: (event: string, cb: (state: string) => void) => void;
  };
  storage?: {
    get?: (keys: string[]) => Promise<Record<string, unknown>>;
    set?: (data: Record<string, unknown>) => Promise<void>;
  };
  advertisement?: {
    isRewardedSupported?: boolean;
    rewardedState?: string;
    showRewarded?: () => Promise<void>;
  };
}

declare global {
  interface Window {
    bridge?: PlaygamaBridgeGlobal;
  }
}

class PlaygamaPlatformAdapter {
  private initialized = false;
  private isPlaygamaHost = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window !== 'undefined' && window.bridge?.initialize) {
      try {
        await window.bridge.initialize();
        this.isPlaygamaHost = true;
      } catch {
        this.isPlaygamaHost = false;
      }
    }
  }

  notifyGameReady(): void {
    if (this.isPlaygamaHost) {
      window.bridge?.platform?.sendMessage?.('game_ready');
    }
  }

  notifyGameplayStart(): void {
    if (this.isPlaygamaHost) {
      window.bridge?.platform?.sendMessage?.('gameplay_started');
    }
  }

  notifyGameplayStop(): void {
    if (this.isPlaygamaHost) {
      window.bridge?.platform?.sendMessage?.('gameplay_stopped');
    }
  }

  isRewardedAdsSupported(): boolean {
    if (!this.isPlaygamaHost || typeof window === 'undefined') {
      return false;
    }
    return Boolean(window.bridge?.advertisement?.isRewardedSupported);
  }

  onVisibilityChange(handler: (isHidden: boolean) => void): () => void {
    const onBrowserVis = () => {
      handler(document.hidden);
    };
    document.addEventListener('visibilitychange', onBrowserVis);

    return () => {
      document.removeEventListener('visibilitychange', onBrowserVis);
    };
  }

  async loadStorage(key: string): Promise<string | null> {
    if (this.isPlaygamaHost && window.bridge?.storage?.get) {
      try {
        const res = await window.bridge.storage.get([key]);
        const val = res?.[key];
        if (typeof val === 'string') return val;
      } catch {
        // Fallback to localStorage below
      }
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async saveStorage(key: string, value: string): Promise<void> {
    if (this.isPlaygamaHost && window.bridge?.storage?.set) {
      try {
        await window.bridge.storage.set({ [key]: value });
      } catch {
        // Continue to localStorage fallback
      }
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage quota errors in restricted sandboxes
    }
  }
}

export const playgamaBridge = new PlaygamaPlatformAdapter();
