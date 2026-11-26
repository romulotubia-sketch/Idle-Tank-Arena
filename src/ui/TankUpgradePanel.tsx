import {
  Coins,
  Crosshair,
  Flame,
  Heart,
  Shield,
  Target,
  Zap,
} from 'lucide-react';
import { UpgradeSystem } from '../game/systems/UpgradeSystem';
import { UpgradeEntry, UpgradeId } from '../game/types';
import { BattlefieldPanel } from './components/BattlefieldPanel';

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
    <BattlefieldPanel
      title="Tank Upgrades"
      icon={<Shield className="w-4 h-4 text-amber-400" />}
      variant="drawer"
      ariaLabel="Tank Upgrades"
      closeLabel="Close Tank Upgrades"
      onClose={onClose}
      feedback={feedback}
      headerActions={
        <div className="flex items-center gap-1 bg-[#10151B] border border-amber-500/35 rounded-md px-2 py-1">
          <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-mono-tabular text-xs font-bold text-amber-300">
            {goldBalance}
          </span>
        </div>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto panel-scroll p-2 flex flex-col gap-1.5">
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
                      className={`font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 leading-none ${
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
                        · {armorReductionPct}% block
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
                className={`shrink-0 min-w-[76px] h-9 px-2.5 rounded-lg border font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer ${
                  entry.isMaxed
                    ? 'bg-[#151B22] border-white/10 text-slate-500 cursor-default'
                    : affordable
                      ? 'bg-amber-500 hover:bg-amber-400 border-amber-300/60 text-slate-950 shadow-sm'
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
    </BattlefieldPanel>
  );
}
