import { TankStats, UpgradeEntry } from '../../game/types';

interface TankPanelProps {
  stats: TankStats;
  upgrades: UpgradeEntry[];
}

export function TankPanel({ stats, upgrades }: TankPanelProps) {
  const statRows = [
    { label: 'Firepower', value: `${stats.attackPower}` },
    { label: 'Fire Rate', value: `${stats.fireRate.toFixed(1)} / s` },
    { label: 'Hull Max HP', value: `${stats.maxHp}` },
    { label: 'Armor', value: `${stats.armor}` },
    { label: 'Range', value: `${stats.range} m` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="text-xs font-semibold text-slate-400 mb-2">
          Tank Specifications
        </h3>
        <div className="divide-y divide-white/8 border border-white/10 rounded-lg bg-[#161B21]">
          {statRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between px-3 py-2 text-xs"
            >
              <span className="text-slate-300">{row.label}</span>
              <span className="font-mono-tabular font-semibold text-slate-100">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-400">
            Upgrade Blueprints
          </h3>
          <span className="text-[11px] text-slate-500">Standby</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {upgrades.map((up) => (
            <div
              key={up.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1E252D] border border-white/8 text-xs"
            >
              <div className="min-w-0">
                <div className="font-medium text-slate-200 truncate">
                  {up.label}
                </div>
                <div className="text-[11px] text-slate-400 font-mono-tabular">
                  Lv {up.level} · +{up.perLevelBonus} {up.unit}
                </div>
              </div>
              <span className="font-mono-tabular text-[11px] text-amber-400/80 shrink-0">
                {up.baseCost} Gold
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
