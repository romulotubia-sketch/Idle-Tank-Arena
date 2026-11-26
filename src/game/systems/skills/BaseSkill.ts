import {
  ArenaBounds,
  EnemyInstance,
  PlayerTankState,
  SkillDefinition,
  SkillId,
} from '../../types';
import { CombatStepResult, CombatSystem } from '../CombatSystem';
import { EnemySystem } from '../EnemySystem';
import { SkillCollectionComputedBonuses } from '../SkillCollectionSystem';

export interface SkillExecutionContext {
  tank: PlayerTankState;
  bounds: ArenaBounds;
  enemySystem: EnemySystem;
  combat: CombatSystem;
  result: CombatStepResult;
  getCollectionBonuses?: (skillId: SkillId) => SkillCollectionComputedBonuses;
}

export interface CombatSkillModule {
  readonly definition: SkillDefinition;
  getCooldown(level: number, bonuses?: SkillCollectionComputedBonuses): number;
  execute(level: number, ctx: SkillExecutionContext): boolean;
}

export function clampSkillLevel(level: number): number {
  return Math.max(1, Math.min(5, Math.floor(level)));
}

export function applySkillDamageBonus(
  baseDamage: number,
  ctx: SkillExecutionContext,
  collectionDamageMultiplier = 1
): number {
  const bonusPct = Math.max(0, ctx.tank.stats.skillDamageBonus || 0);
  const combinedMultiplier = collectionDamageMultiplier * (1 + bonusPct / 100);
  return Math.max(1, Math.round(baseDamage * combinedMultiplier));
}

export function findNearestEnemyInRange(
  originX: number,
  originY: number,
  range: number,
  enemies: readonly EnemyInstance[]
): EnemyInstance | null {
  const rangeSq = range * range;
  let nearest: EnemyInstance | null = null;
  let bestDistSq = Infinity;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.isDying || e.hp <= 0) continue;
    const dx = e.position.x - originX;
    const dy = e.position.y - originY;
    const dSq = dx * dx + dy * dy;
    if (dSq <= rangeSq && dSq < bestDistSq) {
      bestDistSq = dSq;
      nearest = e;
    }
  }
  return nearest;
}

export function findEnemiesInRange(
  originX: number,
  originY: number,
  range: number,
  enemies: readonly EnemyInstance[]
): EnemyInstance[] {
  const rangeSq = range * range;
  const list: EnemyInstance[] = [];
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.isDying || e.hp <= 0) continue;
    const dx = e.position.x - originX;
    const dy = e.position.y - originY;
    if (dx * dx + dy * dy <= rangeSq) {
      list.push(e);
    }
  }
  return list;
}
