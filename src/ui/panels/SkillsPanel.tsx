import { Lock } from 'lucide-react';
import { skillRegistry } from '../../game/systems/skills/SkillRegistry';
import { SkillSlot } from '../../game/types';

interface SkillsPanelProps {
  slots: SkillSlot[];
}

export function SkillsPanel({ slots }: SkillsPanelProps) {
  const equippedCount = slots.filter((s) => s.unlocked && s.skillId !== null).length;

  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-400">
            Combat Skill Matrix
          </h3>
          <span className="text-[11px] text-slate-500 font-mono-tabular">
            {equippedCount} / {slots.filter((s) => s.unlocked).length} Equipped
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => {
            const def = slot.skillId
              ? skillRegistry.getDefinition(slot.skillId)
              : undefined;
            return (
              <div
                key={slot.index}
                className={`aspect-square rounded-lg border flex flex-col items-center justify-center p-2 text-center ${
                  slot.unlocked
                    ? 'bg-[#1E252D] border-white/10 text-slate-300'
                    : 'bg-[#14181D] border-white/5 text-slate-600'
                }`}
              >
                {slot.unlocked ? (
                  def ? (
                    <>
                      <span className="font-mono-tabular text-[10px] text-amber-300">
                        Lv.{slot.level}
                      </span>
                      <span className="text-[11px] font-semibold text-white mt-0.5 truncate max-w-full">
                        {def.shortLabel}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono-tabular text-[11px] text-slate-500">
                        Slot {slot.index + 1}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        Empty
                      </span>
                    </>
                  )
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 mb-1 text-slate-600" />
                    <span className="text-[11px] text-slate-600">Locked</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-white/8 pt-3 text-xs text-slate-400 leading-relaxed">
        Duplicate summoned skills automatically upgrade matching equipped
        battlefield skills up to Level 5.
      </section>
    </div>
  );
}
