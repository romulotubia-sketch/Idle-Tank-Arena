import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findEnemiesInRange,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

interface FlameLevelSpec {
  damage: number;
  interval: number;
  range: number;
  coneHalfAngle: number;
  closeBonusRatio: number;
}

const FLAME_LEVELS: readonly FlameLevelSpec[] = [
  { damage: 9, interval: 0.35, range: 155, coneHalfAngle: 0.44, closeBonusRatio: 1.0 },   // Lv1
  { damage: 12, interval: 0.31, range: 170, coneHalfAngle: 0.5, closeBonusRatio: 1.1 },  // Lv2
  { damage: 16, interval: 0.28, range: 185, coneHalfAngle: 0.56, closeBonusRatio: 1.2 }, // Lv3: Wider flame arc
  { damage: 21, interval: 0.24, range: 202, coneHalfAngle: 0.62, closeBonusRatio: 1.35 }, // Lv4: Intense inner sear
  { damage: 28, interval: 0.21, range: 220, coneHalfAngle: 0.7, closeBonusRatio: 1.5 },   // Lv5: Napalm surge
];

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export class FlameThrowerSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'flame_thrower',
    name: 'Flame Thrower',
    shortLabel: 'Flamer',
    rarity: 'rare',
    accentColor: '#FB923C',
    summary: 'Sprays a continuous thermal cone that scorches nearby enemies.',
  };

  getCooldown(level: number): number {
    return FLAME_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const spec = FLAME_LEVELS[clampSkillLevel(level) - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const effectiveRange = spec.range + (col?.bonusRange ?? 0);
    const effectiveConeHalfAngle =
      spec.coneHalfAngle + (col?.bonusConeAngle ?? 0);

    const enemies = ctx.enemySystem.getActiveEnemies();
    const primary = findNearestEnemyInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      effectiveRange,
      enemies
    );
    if (!primary) return false;

    const aimAngle = Math.atan2(
      primary.position.y - ctx.tank.position.y,
      primary.position.x - ctx.tank.position.x
    );
    const nozzleX = ctx.tank.position.x + Math.cos(aimAngle) * 28;
    const nozzleY = ctx.tank.position.y + Math.sin(aimAngle) * 28;

    ctx.combat.spawnFlameCone(
      nozzleX,
      nozzleY,
      aimAngle,
      effectiveRange,
      effectiveConeHalfAngle
    );

    const candidates = findEnemiesInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      effectiveRange + 16,
      enemies
    );
    const innerRangeSq = (effectiveRange * 0.55) * (effectiveRange * 0.55);
    for (let i = 0; i < candidates.length; i++) {
      const e = candidates[i];
      const dx = e.position.x - ctx.tank.position.x;
      const dy = e.position.y - ctx.tank.position.y;
      const eAngle = Math.atan2(dy, dx);
      if (
        Math.abs(normalizeAngle(eAngle - aimAngle)) <=
        effectiveConeHalfAngle + 0.14
      ) {
        const isInner = dx * dx + dy * dy <= innerRangeSq;
        const rawHitDmg = isInner
          ? Math.round(spec.damage * spec.closeBonusRatio)
          : spec.damage;
        const hitDmg = applySkillDamageBonus(rawHitDmg, ctx, damageMult);
        ctx.combat.applyDirectDamage(
          e,
          hitDmg,
          ctx.enemySystem,
          '#FB923C',
          ctx.result
        );
      }
    }

    return true;
  }
}
