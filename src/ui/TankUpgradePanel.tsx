import {
  Coins,
  Crosshair,
  Flame,
  Heart,
  Shield,
  Target,
  X,
  Zap,
} from 'lucide-react';
import { UpgradeSystem } from '../game/systems/UpgradeSystem';
import { UpgradeEntry, UpgradeId } from '../game/types';

export interface UpgradeFeedbackInfo {
  text: string;
  tone: 'success' | 'error';
}

interface TankUpgradePanelProps {
  upgrades: UpgradeEntry[];
  goldBalance: number;
  feedback: UpgradeFeedbackInfo | null;
  highlightedUpgradeId: UpgradeId | null;
  onPurchaseUpgrade: (upgradeId: UpgradeId) => void;
  onClose: () => void;
}

function renderUpgradeIcon(id: UpgradeId) {
  switch (id) {
    case 'attack':
      return <Crosshair className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'attack_speed':
      return <Zap className="w-4 h-4 text-sky-400 shrink-0" />;
    case 'crit_chance':
      return <Target className="w-4 h-4 text-yellow-300 shrink-0" />;
    case 'crit_damage':
      return <Flame className="w-4 h-4 text-orange-400 shrink-0" />;
    case 'max_hp':
      return <Heart className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'armor':
      return <Shield className="w-4 h-4 text-slate-300 shrink-0" />;
  }
}

function formatCurrentStat(entry: UpgradeEntry): string {
  switch (entry.id) {
    case 'attack':
      return `${Math.round(entry.currentValue)} DMG`;
    case 'attack_speed':
      return `${entry.currentValue.toFixed(2)}/s`;
    case 'crit_chance':
      return `${entry.currentValue.toFixed(1)}%`;
    case 'crit_damage':
      return `${entry.currentValue.toFixed(2)}x`;
    case 'max_hp':
      return `${Math.round(entry.currentValue)} HP`;
    case 'armor':
      return `${Math.round(entry.currentValue)} ARM`;
  }
}

function formatNextBonus(entry: UpgradeEntry): string {
  switch (entry.id) {
    case 'attack':
      return `+${Math.round(entry.nextBonus)} DMG`;
    case 'attack_speed':
      return `+${entry.nextBonus.toFixed(2)}/s`;
    case 'crit_chance':
      return `+${entry.nextBonus.toFixed(1)}%`;
    case 'crit_damage':
      return `+${entry.nextBonus.toFixed(2)}x`;
    case 'max_hp':
      return `+${Math.round(entry.nextBonus)} HP`;
    case 'armor':
      return `+${Math.round(entry.nextBonus)} ARM`;
  }
}

export function TankUpgradePanel({
  upgrades,
  goldBalance,
  feedback,
  highlightedUpgradeId,
  onPurchaseUpgrade,
  onClose,
}: TankUpgradePanelProps) {
  return (
    <aside
      aria-label="Tank Upgrades"
      className="absolute top-2 right-2 bottom-2 z-20 w-[305px] sm:w-[345px] max-w-[calc(100%-16px)] flex flex-col bg-[#141A21]/95 border border-[#334155] rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-[#1A222C]">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
          <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
            Tank Upgrades
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-[#12161B] border border-amber-500/35 rounded-md px-2 py-0.5">
            <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-mono-tabular text-xs font-bold text-amber-300">
              {goldBalance}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Close Tank Upgrades"
            className="w-7 h-7 flex items-center justify-center rounded-md bg-[#202934] hover:bg-[#2B3746] border border-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transient upgrade or insufficient coin feedback */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`px-3 py-1.5 text-[11px] font-semibold border-b ${
            feedback.tone === 'error'
              ? 'bg-rose-950/70 border-rose-500/40 text-rose-200'
              : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Six Permanent Tank Upgrades */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
        {upgrades.map((entry) => {
          const affordable = !entry.isMaxed && goldBalance >= entry.nextCost;
          const isHighlighted = highlightedUpgradeId === entry.id;
          const armorReductionPct =
            entry.id === 'armor'
              ? Math.round(
                  UpgradeSystem.computeArmorReductionRatio(entry.currentValue) *
                    100
                )
              : null;

          return (
            <div
              key={entry.id}
              className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
                isHighlighted
                  ? 'bg-emerald-950/45 border-emerald-400/80 animate-summon-pop'
                  : 'bg-[#1A212B] border-white/10'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-md bg-[#12171E] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  {renderUpgradeIcon(entry.id)}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {entry.label}
                    </span>
                    <span
                      className={`font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                        entry.isMaxed
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                          : 'bg-[#11161C] border-white/10 text-slate-300'
                      }`}
                    >
                      {entry.isMaxed ? 'MAX' : `Lv.${entry.level}`}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[11px] font-mono-tabular mt-0.5">
                    <span className="font-semibold text-white">
                      {formatCurrentStat(entry)}
                    </span>
                    {!entry.isMaxed && (
                      <span className="text-emerald-400 font-semibold">
                        ({formatNextBonus(entry)})
                      </span>
                    )}
                    {armorReductionPct !== null && (
                      <span className="text-[10px] text-slate-400 font-sans">
                        · {armorReductionPct}% dmg block
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={entry.isMaxed}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPurchaseUpgrade(entry.id);
                }}
                aria-label={
                  entry.isMaxed
                    ? `${entry.label} maxed`
                    : `Upgrade ${entry.label} for ${entry.nextCost} Coins`
                }
                className={`shrink-0 min-w-[78px] h-9 px-2.5 rounded-lg border font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 ${
                  entry.isMaxed
                    ? 'bg-[#151B22] border-white/10 text-slate-500 cursor-default'
                    : affordable
                      ? 'bg-[#D97706] hover:bg-[#F59E0B] border-amber-300/60 text-slate-950 shadow-sm'
                      : 'bg-[#202732] hover:bg-[#27303D] border-white/10 text-slate-400'
                }`}
              >
                {entry.isMaxed ? (
                  <span>MAXED</span>
                ) : (
                  <>
                    <Coins
                      className={`w-3.5 h-3.5 shrink-0 ${
                        affordable ? 'text-slate-950' : 'text-amber-500/70'
                      }`}
                    />
                    <span className="font-mono-tabular">{entry.nextCost}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
