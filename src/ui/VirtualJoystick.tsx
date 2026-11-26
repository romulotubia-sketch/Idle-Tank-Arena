import { useCallback, useEffect, useRef, useState } from 'react';

interface VirtualJoystickProps {
  onMove: (x: number, y: number) => void;
}

const MAX_RADIUS = 26;

export function VirtualJoystick({ onMove }: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isDragging, setIsDragging] = useState(false);

  const updateFromClientPos = useCallback(
    (clientX: number, clientY: number) => {
      const base = baseRef.current;
      if (!base) return;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;

      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist > MAX_RADIUS) {
        dx = (dx / dist) * MAX_RADIUS;
        dy = (dy / dist) * MAX_RADIUS;
      }

      setKnobOffset({ x: dx, y: dy });
      onMove(dx / MAX_RADIUS, dy / MAX_RADIUS);
    },
    [onMove]
  );

  const resetKnob = useCallback(() => {
    activePointerId.current = null;
    setIsDragging(false);
    setKnobOffset({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);

  useEffect(() => {
    if (!isDragging) return;

    const onWinMove = (e: PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      updateFromClientPos(e.clientX, e.clientY);
    };

    const onWinUp = (e: PointerEvent) => {
      if (activePointerId.current !== e.pointerId) return;
      resetKnob();
    };

    window.addEventListener('pointermove', onWinMove);
    window.addEventListener('pointerup', onWinUp);
    window.addEventListener('pointercancel', onWinUp);
    window.addEventListener('blur', resetKnob);

    return () => {
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinUp);
      window.removeEventListener('blur', resetKnob);
    };
  }, [isDragging, resetKnob, updateFromClientPos]);

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="Tank movement joystick"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (activePointerId.current !== null) return;
        activePointerId.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Window fallback listeners handle environments without pointer capture
        }
        setIsDragging(true);
        updateFromClientPos(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        e.stopPropagation();
        updateFromClientPos(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        e.stopPropagation();
        resetKnob();
      }}
      onPointerCancel={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        resetKnob();
      }}
      onLostPointerCapture={() => {
        if (activePointerId.current !== null) {
          resetKnob();
        }
      }}
      className={`touch-none select-none relative w-[84px] h-[84px] sm:w-24 sm:h-24 rounded-full border-2 flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing ${
        isDragging
          ? 'bg-[#121820]/88 border-amber-400/85'
          : 'bg-[#121820]/65 border-slate-500/50 hover:border-slate-400/75'
      }`}
    >
      {/* Inner directional ring */}
      <div
        className="pointer-events-none absolute inset-2.5 rounded-full border border-white/10"
        aria-hidden="true"
      />

      {/* Thumb Knob */}
      <div
        className={`pointer-events-none w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 shadow-lg transition-colors ${
          isDragging
            ? 'bg-amber-400 border-amber-200'
            : 'bg-[#2C3746] border-slate-400/80'
        }`}
        style={{
          transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
        }}
      />
    </div>
  );
}
