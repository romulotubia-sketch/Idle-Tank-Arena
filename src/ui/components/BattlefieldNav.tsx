import { BookOpen, Hammer, Package, SlidersHorizontal } from 'lucide-react';
import { skillRegistry } from '../../game/systems/skills/SkillRegistry';
import { ForgeStatus } from '../../game/types';

export type ActivePanelId =
  | 'upgrades'
  | 'equipment'
  | 'forge'
  | 'collection'
  | 'settings'
  | null;

interface BattlefieldNavProps {
  activePanel: ActivePanelId;
  forgeStatus: ForgeStatus;
  autoForgeEnabled?: boolean;
  equippedCount: number;
  unlockedSkillCount: number;
  hasAffordableUpgrade: boolean;
  hasAffordableCollectionUpgrade: boolean;
  onToggleCollection: () => void;
  onToggleForge: () => void;
  onToggleEquipment: () => void;
  onToggleUpgrades: () => void;
  layout: 'floating' | 'bar';
}

export function BattlefieldNav({
  activePanel,
  forgeStatus,
  autoForgeEnabled = false,
  equippedCount,
  unlockedSkillCount,
  hasAffordableUpgrade,
  hasAffordableCollectionUpgrade,
  onToggleCollection,
  onToggleForge,
  onToggleEquipment,
  onToggleUpgrades,
  layout,
}: BattlefieldNavProps) {
  const isBar = layout === 'bar';

  const items: {
    id: Exclude<ActivePanelId, null | 'settings'>;
    label: string;
    ariaLabel: string;
    meta?: string;
    highlight: boolean;
    highlightTone: 'emerald' | 'amber';
    icon: React.ReactNode;
    onClick: () => void;
  }[] = [
    {
      id: 'collection',
      label: 'Collection',
      ariaLabel: 'Open Skill Collection',
      meta: `${unlockedSkillCount}/${skillRegistry.getAllDefinitions().length}`,
      highlight: hasAffordableCollectionUpgrade,
      highlightTone: 'emerald',
      icon: <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />,
      onClick: onToggleCollection,
    },
    {
      id: 'forge',
      label: 'Forge',
      ariaLabel: 'Open Equipment Forge',
      meta: autoForgeEnabled
        ? 'Auto'
        : forgeStatus === 'result_ready'
          ? 'Ready'
          : undefined,
      highlight:
        autoForgeEnabled ||
        forgeStatus === 'result_ready' ||
        forgeStatus === 'forging',
      highlightTone: autoForgeEnabled ? 'emerald' : 'amber',
      icon: (
        <Hammer
          className={`w-4 h-4 shrink-0 ${
            autoForgeEnabled
              ? 'text-emerald-300'
              : forgeStatus === 'forging'
                ? 'text-amber-300'
                : 'text-amber-400'
          }`}
        />
      ),
      onClick: onToggleForge,
    },
    {
      id: 'equipment',
      label: 'Equip',
      ariaLabel: 'Open Tank Equipment',
      meta: `${equippedCount}/6`,
      highlight: false,
      highlightTone: 'amber',
      icon: <Package className="w-4 h-4 text-sky-400 shrink-0" />,
      onClick: onToggleEquipment,
    },
    {
      id: 'upgrades',
      label: 'Upgrades',
      ariaLabel: 'Open Tank Upgrades',
      highlight: hasAffordableUpgrade,
      highlightTone: 'amber',
      icon: <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />,
      onClick: onToggleUpgrades,
    },
  ];

  return (
    <nav
      aria-label="Tank progression navigation"
      className={
        isBar
          ? 'grid grid-cols-4 gap-1.5 px-2 py-1.5 bg-[#151B22] border-t border-[#2D3846] shrink-0'
          : 'flex items-center gap-1 p-1 rounded-xl bg-[#12171E]/92 border border-[#2D3846] shadow-xl backdrop-blur-[2px]'
      }
    >
      {items.map((item) => {
        const isOpen = activePanel === item.id;
        const toneBorder =
          isOpen
            ? 'bg-[#263241] border-amber-400 text-white'
            : item.highlight
              ? item.highlightTone === 'emerald'
                ? 'bg-[#16272B]/95 hover:bg-[#1C3338] border-emerald-400/70 text-emerald-100'
                : 'bg-[#282115]/95 hover:bg-[#342B1B] border-amber-400/70 text-amber-100'
              : 'bg-[#1A222C]/90 hover:bg-[#222C39] border-white/10 text-slate-200';

        return (
          <button
            key={item.id}
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              item.onClick();
            }}
            aria-label={item.ariaLabel}
            aria-pressed={isOpen}
            className={`relative flex items-center justify-center rounded-lg border transition-colors active:scale-95 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400 ${
              isBar
                ? 'flex-col gap-0.5 h-11 px-1.5 text-[10px] font-semibold'
                : 'flex-col md:flex-row gap-0.5 md:gap-1.5 min-w-[54px] md:min-w-0 h-11 md:h-9 px-2 md:px-2.5 text-[10px] md:text-xs font-semibold'
            } ${toneBorder}`}
          >
            {item.icon}
            <span className="leading-none">{item.label}</span>
            {item.meta && (
              <span className="hidden lg:inline font-mono-tabular text-[10px] text-slate-400">
                {item.meta}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
