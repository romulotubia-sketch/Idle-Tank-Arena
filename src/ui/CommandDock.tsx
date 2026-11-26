import { DockTab, GameHudSnapshot } from '../game/types';
import { ForgePanel } from './panels/ForgePanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { SkillsPanel } from './panels/SkillsPanel';
import { TankPanel } from './panels/TankPanel';

interface CommandDockProps {
  activeTab: DockTab;
  onSelectTab: (tab: DockTab) => void;
  snapshot: GameHudSnapshot;
}

const TABS: { id: DockTab; label: string }[] = [
  { id: 'tank', label: 'Tank' },
  { id: 'skills', label: 'Skills' },
  { id: 'forge', label: 'Forge' },
  { id: 'inventory', label: 'Bag' },
];

export function CommandDock({
  activeTab,
  onSelectTab,
  snapshot,
}: CommandDockProps) {
  return (
    <aside
      aria-label="Tank command systems"
      className="flex flex-col w-full h-[44%] landscape:h-full md:h-full landscape:w-[280px] md:w-[300px] lg:w-[340px] shrink-0 bg-[#191F27] border-t landscape:border-t-0 landscape:border-l md:border-t-0 md:border-l border-white/10"
    >
      {/* Segmented Navigation Tabs */}
      <nav
        aria-label="Command dock tabs"
        className="grid grid-cols-4 gap-1 p-1.5 bg-[#14191F] border-b border-white/10 shrink-0"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[36px] px-2 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400 ${
                isActive
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Scrollable Panel Content */}
      <div className="flex-1 overflow-y-auto panel-scroll p-3 sm:p-4">
        {activeTab === 'tank' && (
          <TankPanel
            stats={snapshot.tank.stats}
            upgrades={snapshot.upgrades}
          />
        )}
        {activeTab === 'skills' && (
          <SkillsPanel slots={snapshot.skillSlots} />
        )}
        {activeTab === 'forge' && (
          <ForgePanel equipmentSlots={snapshot.equipmentSlots} />
        )}
        {activeTab === 'inventory' && (
          <InventoryPanel
            slots={snapshot.inventorySlots}
            capacity={snapshot.inventoryCapacity}
          />
        )}
      </div>
    </aside>
  );
}
