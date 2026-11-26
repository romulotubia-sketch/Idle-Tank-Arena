import { INITIAL_TANK_STATS, MOVEMENT_CONFIG } from '../constants';
import { PlayerTankState, TankStats } from '../types';

export function createPlayerTank(centerX: number, centerY: number): PlayerTankState {
  return {
    position: { x: centerX, y: centerY },
    movementOrigin: { x: centerX, y: centerY },
    movementRadius: MOVEMENT_CONFIG.boundaryRadius,
    hullAngle: -Math.PI / 2,
    turretAngle: -Math.PI / 2 + 0.38,
    idlePhase: 0,
    hitFlashTimer: 0,
    recoilOffset: 0,
    bodyRecoilX: 0,
    bodyRecoilY: 0,
    isMoving: false,
    stats: { ...INITIAL_TANK_STATS },
  };
}

export function cloneTankStats(stats: TankStats): TankStats {
  return { ...stats };
}
