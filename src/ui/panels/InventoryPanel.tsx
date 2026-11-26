import { InventorySlot } from '../../game/types';

interface InventoryPanelProps {
  slots: InventorySlot[];
  capacity: number;
}

export function InventoryPanel({ slots, capacity }: InventoryPanelProps) {
  const usedCount = slots.filter((slot) => slot.itemId !== null).length;

  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-400">
            Storage Bay
          </h3>
          <span className="text-[11px] text-slate-500 font-mono-tabular">
            {usedCount} / {capacity} Slots
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {slots.map((slot) => (
            <div
              key={slot.index}
              className="aspect-square rounded-md bg-[#161B21] border border-white/8 flex items-center justify-center text-[11px] font-mono-tabular text-slate-600"
            >
              {slot.itemId ? slot.quantity : slot.index + 1}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
