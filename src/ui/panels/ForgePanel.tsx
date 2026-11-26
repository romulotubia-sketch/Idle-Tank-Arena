import { EQUIPMENT_SLOT_ORDER } from '../../game/constants';
import { EquipmentItem, EquipmentSlotType } from '../../game/types';

interface ForgePanelProps {
  equipmentSlots: Record<EquipmentSlotType, EquipmentItem | null>;
}

export function ForgePanel({ equipmentSlots }: ForgePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-400">
            Tank Equipment Loadout
          </h3>
          <span className="text-[11px] text-slate-500">6 Equipment Slots</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {EQUIPMENT_SLOT_ORDER.map(({ slot, label }) => {
            const item = equipmentSlots[slot];
            return (
              <div
                key={slot}
                className="flex flex-col justify-between min-h-[68px] p-2.5 rounded-lg bg-[#1E252D] border border-white/10"
              >
                <span className="text-[11px] font-medium text-slate-400">
                  {label}
                </span>
                <span className="text-xs text-slate-500">
                  {item ? item.name : 'Unassigned'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="p-3 rounded-lg bg-[#161B21] border border-white/8">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-medium text-slate-200">Forge Chamber</span>
          <span className="font-mono-tabular text-[11px] text-slate-500">
            Tier 1
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Equipment crafting and armor forging modules are scaffolded and
          awaiting activation.
        </p>
      </section>
    </div>
  );
}
