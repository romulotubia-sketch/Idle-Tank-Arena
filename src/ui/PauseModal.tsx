import {
  Crosshair,
  Gamepad2,
  Hammer,
  Maximize2,
  Minimize2,
  Monitor,
  Music,
  Pause,
  Play,
  PlayCircle,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ForgeStatus,
  GameSettingsState,
  GraphicsQuality,
  MonetizationOfferId,
  MonetizationSnapshot,
} from '../game/types';
import { BattlefieldPanel } from './components/BattlefieldPanel';

export type PauseModalMode = 'pause' | 'settings';

interface PauseModalProps {
  mode: PauseModalMode;
  waveNumber: number;
  summonCost: number;
  forgeStatus: ForgeStatus;
  autoForgeEnabled: boolean;
  settings: GameSettingsState;
  monetization?: MonetizationSnapshot;
  fullscreenSupported?: boolean;
  isFullscreen?: boolean;
  adFeedback?: string | null;
  onChangeMode: (mode: PauseModalMode) => void;
  onResume: () => void;
  onToggleSound: () => void;
  onChangeSoundVolume: (volume: number) => void;
  onToggleMusic: () => void;
  onChangeMusicVolume: (volume: number) => void;
  onChangeGraphicsQuality: (quality: GraphicsQuality) => void;
  onToggleRangeRing: () => void;
  onToggleFullscreen?: () => void;
  onRequestRewardedOffer?: (
    offerId: Exclude<MonetizationOfferId, 'offline_reward_bonus'>
  ) => void;
  onReturnToTitle: () => void;
}

export function PauseModal({
  mode,
  waveNumber,
  summonCost,
  forgeStatus,
  autoForgeEnabled,
  settings,
  monetization,
  fullscreenSupported = false,
  isFullscreen = false,
  adFeedback = null,
  onChangeMode,
  onResume,
  onToggleSound,
  onChangeSoundVolume,
  onToggleMusic,
  onChangeMusicVolume,
  onChangeGraphicsQuality,
  onToggleRangeRing,
  onToggleFullscreen,
  onRequestRewardedOffer,
  onReturnToTitle,
}: PauseModalProps) {
  const sfxPct = Math.round(settings.soundVolume * 100);
  const musicPct = Math.round(settings.musicVolume * 100);
  const hasActiveForgePause = autoForgeEnabled || forgeStatus === 'forging';

  if (mode === 'pause') {
    return (
      <BattlefieldPanel
        title="Battle Paused"
        icon={<Pause className="w-4 h-4 text-sky-400" />}
        variant="center"
        ariaLabel="Battle Paused"
        closeLabel="Resume Battle"
        headerMeta={
          <span className="px-1.5 py-0.5 rounded bg-[#10151B] border border-[#2E3A48] font-mono-tabular text-[10px] font-bold text-amber-300">
            Wave {waveNumber}
          </span>
        }
        onClose={onResume}
      >
        <div className="overflow-y-auto panel-scroll p-3 sm:p-4 flex flex-col gap-3">
          <p className="text-xs text-slate-300 leading-relaxed">
            Combat, waves, and skill cooldowns are paused.
          </p>

          {hasActiveForgePause && (
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-950/45 border border-emerald-500/35 text-[11px] text-emerald-200">
              <Hammer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {autoForgeEnabled
                  ? 'Auto Forge timer is safely paused and will resume automatically.'
                  : 'Active Forge timer is paused cleanly.'}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-0.5">
            <button
              type="button"
              onClick={onResume}
              className="inline-flex items-center justify-center gap-2 w-full min-h-[42px] px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>Resume Battle</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeMode('settings')}
              className="inline-flex items-center justify-center gap-2 w-full min-h-[40px] px-4 py-2 rounded-lg bg-[#1A232E] hover:bg-[#222D3B] border border-[#334155] text-slate-100 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <Settings className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={onReturnToTitle}
              className="w-full min-h-[38px] px-4 py-2 rounded-lg bg-[#10151B] hover:bg-[#171E27] border border-[#2C3746] text-slate-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              Return to Title
            </button>
          </div>
        </div>
      </BattlefieldPanel>
    );
  }

  return (
    <BattlefieldPanel
      title="Settings"
      icon={<Settings className="w-4 h-4 text-amber-400" />}
      variant="modal"
      ariaLabel="Game Settings"
      closeLabel="Resume Battle"
      headerMeta={
        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-500/35 text-[10px] font-semibold text-sky-200">
          Paused · Wave {waveNumber}
        </span>
      }
      headerActions={
        <button
          type="button"
          onClick={onResume}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          <Play className="w-3.5 h-3.5 fill-current shrink-0" />
          <span>Resume</span>
        </button>
      }
      onClose={onResume}
    >
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto panel-scroll p-2.5 sm:p-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 landscape:grid-cols-2 gap-2.5 sm:gap-3">
            {/* Left Column: Audio & Graphics */}
            <div className="flex flex-col gap-2.5 sm:gap-3">
              {/* Audio Section */}
              <section
                aria-label="Audio settings"
                className="rounded-xl bg-[#0F141B] border border-[#283444] p-2.5 sm:p-3 flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Audio</span>
                </div>

                {/* Sound Effects */}
                <div className="flex flex-col gap-1.5 rounded-lg bg-[#151C25] border border-white/8 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                      {settings.soundEnabled ? (
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span>Sound Effects</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.soundEnabled}
                      aria-label="Toggle Sound Effects"
                      onClick={onToggleSound}
                      className={`min-w-[54px] min-h-[30px] px-2.5 rounded-md border text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                        settings.soundEnabled
                          ? 'bg-emerald-950/70 border-emerald-400/70 text-emerald-200'
                          : 'bg-[#10151B] border-[#334155] text-slate-400'
                      }`}
                    >
                      {settings.soundEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5 pt-0.5">
                    <label
                      htmlFor="sfx-volume-slider"
                      className="text-[11px] text-slate-400 whitespace-nowrap"
                    >
                      SFX Volume
                    </label>
                    <input
                      id="sfx-volume-slider"
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={sfxPct}
                      disabled={!settings.soundEnabled}
                      onChange={(e) =>
                        onChangeSoundVolume(Number(e.target.value) / 100)
                      }
                      aria-label="Sound Effects Volume"
                      className="flex-1 h-2 accent-amber-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <span className="w-9 text-right font-mono-tabular text-[11px] font-bold text-amber-300">
                      {sfxPct}%
                    </span>
                  </div>
                </div>

                {/* Music */}
                <div className="flex flex-col gap-1.5 rounded-lg bg-[#151C25] border border-white/8 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                      <Music
                        className={`w-3.5 h-3.5 shrink-0 ${
                          settings.musicEnabled ? 'text-sky-400' : 'text-slate-500'
                        }`}
                      />
                      <span>Music</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.musicEnabled}
                      aria-label="Toggle Music"
                      onClick={onToggleMusic}
                      className={`min-w-[54px] min-h-[30px] px-2.5 rounded-md border text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                        settings.musicEnabled
                          ? 'bg-sky-950/70 border-sky-400/70 text-sky-200'
                          : 'bg-[#10151B] border-[#334155] text-slate-400'
                      }`}
                    >
                      {settings.musicEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5 pt-0.5">
                    <label
                      htmlFor="music-volume-slider"
                      className="text-[11px] text-slate-400 whitespace-nowrap"
                    >
                      Music Volume
                    </label>
                    <input
                      id="music-volume-slider"
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={musicPct}
                      disabled={!settings.musicEnabled}
                      onChange={(e) =>
                        onChangeMusicVolume(Number(e.target.value) / 100)
                      }
                      aria-label="Music Volume"
                      className="flex-1 h-2 accent-sky-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <span className="w-9 text-right font-mono-tabular text-[11px] font-bold text-sky-300">
                      {musicPct}%
                    </span>
                  </div>
                </div>
              </section>

              {/* Graphics Section */}
              <section
                aria-label="Graphics settings"
                className="rounded-xl bg-[#0F141B] border border-[#283444] p-2.5 sm:p-3 flex flex-col gap-2"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Monitor className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Graphics</span>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Graphics quality preset"
                  className="grid grid-cols-2 gap-2"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={settings.graphicsQuality === 'high'}
                    onClick={() => onChangeGraphicsQuality('high')}
                    className={`flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      settings.graphicsQuality === 'high'
                        ? 'bg-amber-950/45 border-amber-400 text-white'
                        : 'bg-[#151C25] hover:bg-[#1B2430] border-[#2C3746] text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold">High</span>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Full particles, sparks &amp; crisp detail
                    </span>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={settings.graphicsQuality === 'low'}
                    onClick={() => onChangeGraphicsQuality('low')}
                    className={`flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      settings.graphicsQuality === 'low'
                        ? 'bg-emerald-950/45 border-emerald-400 text-white'
                        : 'bg-[#151C25] hover:bg-[#1B2430] border-[#2C3746] text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold">Low / Performance</span>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Fewer particles &amp; lighter VFX
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showRangeRing}
                  onClick={onToggleRangeRing}
                  className="flex items-center justify-between w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#151C25] hover:bg-[#1B2430] border border-white/8 text-xs text-slate-200 transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Crosshair className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Tactical Range Ring</span>
                  </span>
                  <span className="font-mono-tabular text-[11px] font-bold text-amber-300">
                    {settings.showRangeRing ? 'Visible' : 'Hidden'}
                  </span>
                </button>

                {fullscreenSupported && onToggleFullscreen && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isFullscreen}
                    onClick={onToggleFullscreen}
                    className="flex items-center justify-between w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#151C25] hover:bg-[#1B2430] border border-white/8 text-xs text-slate-200 transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      {isFullscreen ? (
                        <Minimize2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      )}
                      <span>Display Mode</span>
                    </span>
                    <span className="font-mono-tabular text-[11px] font-bold text-sky-300">
                      {isFullscreen ? 'Fullscreen' : 'Windowed'}
                    </span>
                  </button>
                )}
              </section>
            </div>

            {/* Right Column: Gameplay & Reference */}
            <div className="flex flex-col gap-2.5 sm:gap-3">
              <section
                aria-label="Gameplay guide"
                className="rounded-xl bg-[#0F141B] border border-[#283444] p-2.5 sm:p-3 flex flex-col gap-2.5 h-full"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Gamepad2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Gameplay Guide</span>
                </div>

                <div className="rounded-lg bg-[#151C25] border border-white/8 p-2.5 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                    <Crosshair className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Controls &amp; Combat</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Steer inside the deployment ring using{' '}
                    <span className="font-semibold text-white">WASD / Arrow Keys</span>{' '}
                    or the bottom-left{' '}
                    <span className="font-semibold text-white">Touch Joystick</span>.
                    Main cannon targeting and all 6 equipped skills fire automatically.
                  </p>
                </div>

                <div className="rounded-lg bg-[#151C25] border border-white/8 p-2.5 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                    <RotateCcw className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Auto Battle Recovery</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    When hull integrity reaches zero, your tank repairs automatically in ~2.2s and retries the current wave. All Coins, Tank Upgrades, Equipment, and Skills remain intact.
                  </p>
                </div>

                <div className="rounded-lg bg-[#151C25] border border-white/8 p-2.5 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Summon &amp; Skill Upgrading</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Summoning ({summonCost} Coins) rolls weighted rarities from Common (55%) to Legendary (2%). Duplicate skills directly upgrade matching equipped slots up to Lv.5—no manual merging needed.
                  </p>
                </div>

                {monetization && (
                  <div className="rounded-lg bg-[#151C25] border border-white/8 p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-100">
                        Optional Bonuses ({monetization.providerName})
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#10151B] border border-[#334155] text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                        {monetization.isAdPlaying
                          ? 'Ad Playing...'
                          : monetization.sdkConnected
                            ? 'Ready'
                            : 'Ad Unavailable'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 text-[11px]">
                      {/* Optional Supply Drop Bonus */}
                      {monetization.offers.optional_coin_bonus.enabled && (
                        <div className="flex items-center justify-between gap-2 rounded-md bg-[#10151B] border border-white/6 px-2 py-1.5">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-200 truncate">
                              {monetization.offers.optional_coin_bonus.label} (+
                              {monetization.optionalCoinBonusPreview} Coins)
                            </div>
                            <div className="font-mono-tabular text-[10px] text-slate-400">
                              {
                                monetization.offers.optional_coin_bonus
                                  .dailyRemaining
                              }
                              /
                              {
                                monetization.offers.optional_coin_bonus
                                  .dailyLimit
                              }{' '}
                              daily
                              {monetization.offers.optional_coin_bonus
                                .cooldownRemainingSec > 0
                                ? ` · ${monetization.offers.optional_coin_bonus.cooldownRemainingSec}s cd`
                                : ''}
                            </div>
                          </div>
                          {monetization.sdkConnected &&
                          onRequestRewardedOffer ? (
                            <button
                              type="button"
                              disabled={
                                !monetization.offers.optional_coin_bonus
                                  .canClaim || monetization.isAdPlaying
                              }
                              onClick={() =>
                                onRequestRewardedOffer('optional_coin_bonus')
                              }
                              className="inline-flex items-center gap-1 h-7 px-2 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-bold text-[10px] whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <PlayCircle className="w-3 h-3 shrink-0" />
                              <span>Watch Ad</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                              Offline
                            </span>
                          )}
                        </div>
                      )}

                      {/* Optional Temporary Boost */}
                      {monetization.offers.temporary_boost.enabled && (
                        <div className="flex items-center justify-between gap-2 rounded-md bg-[#10151B] border border-white/6 px-2 py-1.5">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-200 truncate">
                              {monetization.offers.temporary_boost.label}
                            </div>
                            <div className="font-mono-tabular text-[10px] text-slate-400">
                              {monetization.offers.temporary_boost.shortDesc} ·{' '}
                              {
                                monetization.offers.temporary_boost
                                  .dailyRemaining
                              }
                              /{monetization.offers.temporary_boost.dailyLimit}
                              {monetization.offers.temporary_boost
                                .cooldownRemainingSec > 0
                                ? ` · ${monetization.offers.temporary_boost.cooldownRemainingSec}s cd`
                                : ''}
                            </div>
                          </div>
                          {monetization.sdkConnected &&
                          onRequestRewardedOffer ? (
                            <button
                              type="button"
                              disabled={
                                !monetization.offers.temporary_boost.canClaim ||
                                monetization.isAdPlaying
                              }
                              onClick={() =>
                                onRequestRewardedOffer('temporary_boost')
                              }
                              className="inline-flex items-center gap-1 h-7 px-2 rounded bg-sky-500 hover:bg-sky-400 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-bold text-[10px] whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <PlayCircle className="w-3 h-3 shrink-0" />
                              <span>Watch Ad</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                              Offline
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {adFeedback && (
                      <div
                        role="status"
                        className="text-[10px] text-amber-200 bg-[#10151B] border border-amber-500/35 rounded px-2 py-1"
                      >
                        {adFeedback}
                      </div>
                    )}
                  </div>
                )}

                {hasActiveForgePause && (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/35 text-[11px] text-emerald-200 mt-auto">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {autoForgeEnabled
                        ? 'Auto Forge is paused safely while Settings is open.'
                        : 'Active Forge progress is paused safely.'}
                    </span>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* Bottom Footer Actions */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-white/10 bg-[#18202A]">
          <button
            type="button"
            onClick={onReturnToTitle}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#10151B] hover:bg-[#171E27] border border-[#334155] text-slate-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            Return to Title
          </button>

          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            <Play className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>Resume Battle</span>
          </button>
        </div>
      </div>
    </BattlefieldPanel>
  );
}
