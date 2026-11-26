import { useCallback, useEffect, useRef } from 'react';
import { GameEngine } from '../game/engine/GameEngine';
import { ForgeStatus, GamePhase, PlayerTankState } from '../game/types';
import { ActivePanelId, BattlefieldNav } from './components/BattlefieldNav';
import { VirtualJoystick } from './VirtualJoystick';

interface BattlefieldCanvasProps {
  engine: GameEngine;
  tank: PlayerTankState;
  phase: GamePhase;
  activePanel: ActivePanelId;
  forgeStatus: ForgeStatus;
  autoForgeEnabled?: boolean;
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
  activePanel,
  forgeStatus,
  autoForgeEnabled = false,
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
  const hpColorClass =
    hpPct <= 25
      ? 'bg-rose-500'
      : hpPct <= 55
        ? 'bg-amber-400'
        : 'bg-emerald-500';
  const hpTextClass =
    hpPct <= 25
      ? 'text-rose-300'
      : hpPct <= 55
        ? 'text-amber-300'
        : 'text-emerald-400';

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onPointerDown={() => {
        containerRef.current?.focus({ preventScroll: true });
      }}
      className="relative flex-1 w-full h-full min-h-[160px] bg-[#202B1E] overflow-hidden select-none outline-none"
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        aria-label="Idle Tank Arena Battlefield"
      />

      {/* Slim Tank Hull HP Indicator (top-left) */}
      <div className="pointer-events-none absolute top-2 left-2 flex flex-col gap-1 bg-[#12171E]/88 border border-[#2E3A48] rounded-md px-2 py-1 shadow-md">
        <div className="flex items-center justify-between gap-2 text-[10px] leading-none">
          <span className="font-semibold text-slate-300">Hull</span>
          <span className={`font-mono-tabular font-bold ${hpTextClass}`}>
            {tank.stats.hp}/{tank.stats.maxHp}
          </span>
        </div>
        <div className="w-24 sm:w-32 h-1.5 bg-[#090C10] rounded-xs overflow-hidden border border-white/10">
          <div
            className={`h-full transition-transform duration-200 origin-left ${hpColorClass}`}
            style={{ transform: `scaleX(${hpPct / 100})` }}
          />
        </div>
      </div>

      {/* Virtual Joystick anchored comfortably at lower-left */}
      {phase === 'ACTIVE' && (
        <div className="absolute bottom-2 left-2.5 z-10">
          <VirtualJoystick onMove={handleJoystickMove} />
        </div>
      )}

      {/* Compact Floating Navigation Toolbar (Landscape & Desktop; Portrait renders dedicated bar below canvas) */}
      {phase === 'ACTIVE' && (
        <div className="hidden sm:block landscape:block absolute bottom-2 right-2.5 z-10">
          <BattlefieldNav
            layout="floating"
            activePanel={activePanel}
            forgeStatus={forgeStatus}
            autoForgeEnabled={autoForgeEnabled}
            equippedCount={equippedCount}
            unlockedSkillCount={unlockedSkillCount}
            hasAffordableUpgrade={hasAffordableUpgrade}
            hasAffordableCollectionUpgrade={hasAffordableCollectionUpgrade}
            onToggleCollection={onToggleCollection}
            onToggleForge={onToggleForge}
            onToggleEquipment={onToggleEquipment}
            onToggleUpgrades={onToggleUpgrades}
          />
        </div>
      )}
    </div>
  );
}
