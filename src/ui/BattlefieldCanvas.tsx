import { useCallback, useEffect, useRef } from 'react';
import { BookOpen, Hammer, Package, SlidersHorizontal } from 'lucide-react';
import { GameEngine } from '../game/engine/GameEngine';
import { ForgeStatus, GamePhase, PlayerTankState } from '../game/types';
import { VirtualJoystick } from './VirtualJoystick';

interface BattlefieldCanvasProps {
  engine: GameEngine;
  tank: PlayerTankState;
  phase: GamePhase;
  isUpgradesOpen: boolean;
  isEquipmentOpen: boolean;
  isForgeOpen: boolean;
  isCollectionOpen: boolean;
  forgeStatus: ForgeStatus;
  equippedCount: number;
  unlockedSkillCount: number;
  hasAffordableUpgrade: boolean;
  hasAffordableCollectionUpgrade: boolean;
  onToggleUpgrades: () => void;
  onToggleEquipment: () => void;
  onToggleForge: () => void;
  onToggleCollection: () => void;
}

type MoveDirectionKey = 'up' | 'down' | 'left' | 'right';

function mapKeyboardEventToDirection(e: KeyboardEvent): MoveDirectionKey | null {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      return 'up';
    case 'KeyS':
    case 'ArrowDown':
      return 'down';
    case 'KeyA':
    case 'ArrowLeft':
      return 'left';
    case 'KeyD':
    case 'ArrowRight':
      return 'right';
  }

  switch (e.key) {
    case 'w':
    case 'W':
    case 'ArrowUp':
      return 'up';
    case 's':
    case 'S':
    case 'ArrowDown':
      return 'down';
    case 'a':
    case 'A':
    case 'ArrowLeft':
      return 'left';
    case 'd':
    case 'D':
    case 'ArrowRight':
      return 'right';
    default:
      return null;
  }
}

export function BattlefieldCanvas({
  engine,
  tank,
  phase,
  isUpgradesOpen,
  isEquipmentOpen,
  isForgeOpen,
  isCollectionOpen,
  forgeStatus,
  equippedCount,
  unlockedSkillCount,
  hasAffordableUpgrade,
  hasAffordableCollectionUpgrade,
  onToggleUpgrades,
  onToggleEquipment,
  onToggleForge,
  onToggleCollection,
}: BattlefieldCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeDirsRef = useRef<Set<MoveDirectionKey>>(new Set());
  const joystickVectorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const syncMovementInput = useCallback(() => {
    if (phase !== 'ACTIVE') {
      engine.setMovementInput(0, 0);
      return;
    }

    const dirs = activeDirsRef.current;
    let kx = 0;
    let ky = 0;
    if (dirs.has('left')) kx -= 1;
    if (dirs.has('right')) kx += 1;
    if (dirs.has('up')) ky -= 1;
    if (dirs.has('down')) ky += 1;

    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      engine.setMovementInput(kx / len, ky / len);
    } else {
      engine.setMovementInput(
        joystickVectorRef.current.x,
        joystickVectorRef.current.y
      );
    }
  }, [engine, phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    engine.attachCanvas(canvas);

    const observer = new ResizeObserver(() => {
      engine.handleResize(canvas);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      engine.detachCanvas();
    };
  }, [engine]);

  useEffect(() => {
    if (phase !== 'ACTIVE') {
      activeDirsRef.current.clear();
      joystickVectorRef.current = { x: 0, y: 0 };
      engine.setMovementInput(0, 0);
      return;
    }

    // Focus battlefield container so WASD / Arrow keys work immediately after Start/Restart
    containerRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      const dir = mapKeyboardEventToDirection(e);
      if (!dir) return;
      e.preventDefault();
      if (!activeDirsRef.current.has(dir)) {
        activeDirsRef.current.add(dir);
        syncMovementInput();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const dir = mapKeyboardEventToDirection(e);
      if (!dir) return;
      if (activeDirsRef.current.delete(dir)) {
        syncMovementInput();
      }
    };

    const handleBlur = () => {
      activeDirsRef.current.clear();
      joystickVectorRef.current = { x: 0, y: 0 };
      engine.setMovementInput(0, 0);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('blur', handleBlur);
    };
  }, [engine, phase, syncMovementInput]);

  const handleJoystickMove = useCallback(
    (x: number, y: number) => {
      joystickVectorRef.current = { x, y };
      syncMovementInput();
    },
    [syncMovementInput]
  );

  const hpPct = Math.max(
    0,
    Math.min(100, Math.round((tank.stats.hp / tank.stats.maxHp) * 100))
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onPointerDown={() => {
        containerRef.current?.focus({ preventScroll: true });
      }}
      className="relative flex-1 w-full h-full min-h-[180px] bg-[#202B1E] overflow-hidden select-none outline-none"
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        aria-label="Idle Tank Arena Battlefield"
      />

      {/* Compact tank hull integrity badge tucked in top-left corner */}
      <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-col gap-1 bg-[#141A21]/92 border border-[#334155] rounded-lg px-2.5 py-1.5 shadow-md">
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="font-semibold text-slate-200 whitespace-nowrap">
            Tank Hull
          </span>
          <span className="font-mono-tabular text-emerald-400 font-bold whitespace-nowrap">
            {tank.stats.hp} / {tank.stats.maxHp}
          </span>
        </div>
        <div className="w-32 sm:w-40 h-1.5 bg-[#0B0F14] rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-emerald-500 transition-transform duration-200 origin-left"
            style={{ transform: `scaleX(${hpPct / 100})` }}
          />
        </div>
      </div>

      {/* Subtle desktop & mobile movement cue */}
      {phase === 'ACTIVE' && (
        <div className="pointer-events-none hidden sm:flex items-center gap-2 absolute top-2.5 right-2.5 bg-[#141A21]/85 border border-white/10 rounded-md px-2.5 py-1 text-[11px] text-slate-300">
          <span>Move: WASD / Arrows or Joystick</span>
        </div>
      )}

      {/* Virtual Joystick for mobile & touch movement */}
      {phase === 'ACTIVE' && (
        <div className="absolute bottom-3 left-3 z-10">
          <VirtualJoystick onMove={handleJoystickMove} />
        </div>
      )}

      {/* Permanent Tank Upgrades, Equipment, Forge & Skill Collection toggle buttons at bottom-right */}
      {phase === 'ACTIVE' &&
        !isUpgradesOpen &&
        !isEquipmentOpen &&
        !isForgeOpen &&
        !isCollectionOpen && (
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleCollection();
              }}
              aria-label="Open Skill Collection"
              className={`relative flex items-center gap-1.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl border shadow-lg text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                hasAffordableCollectionUpgrade
                  ? 'bg-[#17282D]/95 hover:bg-[#1E353C] border-emerald-400/75 text-emerald-200'
                  : 'bg-[#18202A]/92 hover:bg-[#212B38] border-[#334155] text-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Skills</span>
              <span className="font-mono-tabular text-[10px] text-slate-400">
                {unlockedSkillCount}/8
              </span>
              {hasAffordableCollectionUpgrade && (
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-xs bg-emerald-400 shadow-sm"
                />
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleForge();
              }}
              aria-label="Open Equipment Forge"
              className={`relative flex items-center gap-1.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl border shadow-lg text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                forgeStatus === 'result_ready'
                  ? 'bg-[#2A2116]/95 hover:bg-[#372B1C] border-amber-400 text-amber-200'
                  : 'bg-[#18202A]/92 hover:bg-[#212B38] border-[#334155] text-slate-100'
              }`}
            >
              <Hammer
                className={`w-4 h-4 shrink-0 ${
                  forgeStatus === 'forging'
                    ? 'text-amber-300 animate-pulse'
                    : 'text-amber-400'
                }`}
              />
              <span>Forge</span>
              {forgeStatus !== 'idle' && (
                <span
                  aria-hidden="true"
                  className={`w-2 h-2 rounded-xs ${
                    forgeStatus === 'result_ready'
                      ? 'bg-emerald-400'
                      : 'bg-amber-400 animate-pulse'
                  }`}
                />
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleEquipment();
              }}
              aria-label="Open Tank Equipment"
              className="relative flex items-center gap-1.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl border shadow-lg text-xs sm:text-sm font-bold bg-[#18202A]/92 hover:bg-[#212B38] border-[#334155] text-slate-100 transition-all active:scale-95"
            >
              <Package className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Equipment</span>
              <span className="font-mono-tabular text-[10px] text-slate-400">
                {equippedCount}/6
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleUpgrades();
              }}
              aria-label="Open Tank Upgrades"
              className={`relative flex items-center gap-1.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl border shadow-lg text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                hasAffordableUpgrade
                  ? 'bg-[#1D2733]/95 hover:bg-[#253241] border-amber-400/70 text-amber-200'
                  : 'bg-[#18202A]/92 hover:bg-[#212B38] border-[#334155] text-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Upgrades</span>
              {hasAffordableUpgrade && (
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-xs bg-amber-400 shadow-sm"
                />
              )}
            </button>
          </div>
        )}
    </div>
  );
}
