import { Settings } from 'lucide-react';
import { BattlefieldPanel } from './components/BattlefieldPanel';

interface PauseModalProps {
  soundEnabled: boolean;
  showRangeRing: boolean;
  onResume: () => void;
  onToggleSound: () => void;
  onToggleRangeRing: () => void;
  onReturnToTitle: () => void;
}

export function PauseModal({
  soundEnabled,
  showRangeRing,
  onResume,
  onToggleSound,
  onToggleRangeRing,
  onReturnToTitle,
}: PauseModalProps) {
  return (
    <BattlefieldPanel
      title="Settings"
      icon={<Settings className="w-4 h-4 text-amber-400" />}
      variant="center"
      ariaLabel="Settings"
      closeLabel="Resume Battle"
      onClose={onResume}
    >
      <div className="overflow-y-auto panel-scroll p-3 sm:p-4 flex flex-col gap-3">
        <p className="text-xs text-slate-400">
          Arena paused. Adjust battle display and audio options.
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            className="flex items-center justify-between w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#10151B] hover:bg-[#171E27] border border-[#334155] text-sm text-slate-200 transition-colors cursor-pointer"
          >
            <span>Sound Effects</span>
            <span className="font-mono-tabular text-xs font-bold text-amber-400">
              {soundEnabled ? 'On' : 'Off'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleRangeRing}
            className="flex items-center justify-between w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#10151B] hover:bg-[#171E27] border border-[#334155] text-sm text-slate-200 transition-colors cursor-pointer"
          >
            <span>Tactical Range Ring</span>
            <span className="font-mono-tabular text-xs font-bold text-amber-400">
              {showRangeRing ? 'Visible' : 'Hidden'}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Resume Battle
          </button>
          <button
            type="button"
            onClick={onReturnToTitle}
            className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-[#10151B] hover:bg-[#171E27] border border-[#334155] text-slate-300 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </div>
    </BattlefieldPanel>
  );
}
