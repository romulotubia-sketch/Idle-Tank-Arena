import { ReactNode } from 'react';
import { X } from 'lucide-react';

export type BattlefieldPanelVariant = 'modal' | 'wide' | 'drawer' | 'center';

interface BattlefieldPanelProps {
  title: string;
  icon: ReactNode;
  variant?: BattlefieldPanelVariant;
  headerMeta?: ReactNode;
  headerActions?: ReactNode;
  feedback?: { text: string; tone: 'success' | 'error' } | null;
  onClose: () => void;
  closeLabel?: string;
  ariaLabel?: string;
  children: ReactNode;
}

export function BattlefieldPanel({
  title,
  icon,
  variant = 'modal',
  headerMeta,
  headerActions,
  feedback,
  onClose,
  closeLabel = 'Close panel',
  ariaLabel,
  children,
}: BattlefieldPanelProps) {
  const backdropClass =
    variant === 'drawer'
      ? 'justify-end items-stretch p-1.5 sm:p-2.5'
      : variant === 'center'
        ? 'justify-center items-center p-3 sm:p-4'
        : 'justify-center items-center p-1.5 sm:p-2.5';

  const containerClass =
    variant === 'drawer'
      ? 'w-full max-w-[360px] h-full'
      : variant === 'center'
        ? 'w-full max-w-sm max-h-full'
        : variant === 'wide'
          ? 'w-full h-full max-w-[1120px] max-h-[680px]'
          : 'w-full h-full max-w-[980px] max-h-[640px]';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className={`absolute inset-0 z-30 flex bg-[#0B0F14]/70 backdrop-blur-[2px] pointer-events-auto ${backdropClass}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex flex-col bg-[#131920]/98 border border-[#334155] rounded-xl shadow-2xl overflow-hidden animate-toast-in ${containerClass}`}
      >
        <header className="flex items-center justify-between gap-2 px-3 py-1.5 sm:py-2 border-b border-white/10 bg-[#18202A] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 flex items-center">{icon}</span>
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
              {title}
            </h2>
            {headerMeta && (
              <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                {headerMeta}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {headerActions}
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onClose();
              }}
              aria-label={closeLabel}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-[#202934] hover:bg-[#2B3746] active:bg-[#1A222B] border border-white/12 text-slate-200 hover:text-white transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={`px-3 py-1.5 text-xs font-semibold border-b shrink-0 ${
              feedback.tone === 'error'
                ? 'bg-rose-950/75 border-rose-500/40 text-rose-200'
                : 'bg-emerald-950/75 border-emerald-500/40 text-emerald-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
