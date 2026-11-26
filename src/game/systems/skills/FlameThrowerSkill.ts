import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findEnemiesInRange,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const FLAME_LEVELS = GAME_BALANCE.skills.flame_thrower;

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
