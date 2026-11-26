import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const FROST_LEVELS = GAME_BALANCE.skills.frost_cannon;

export class FrostCannonSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'frost_cannon',
    name: 'Frost Cannon',
    shortLabel: 'Frost',
    rarity: 'uncommon',
    accentColor: '#38BDF8',
    summary: 'Fires cryo-charged shells that burst in an icy zone and slow enemy movement.',
  };

  getCooldown(level: number): number {
    return FROST_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = FROST_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const bonusAoe = col?.bonusAoeRadius ?? 0;

    const target = findNearestEnemyInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      spec.range,
      ctx.enemySystem.getActiveEnemies()
    );
    if (!target) return false;

    const angle = Math.atan2(
      target.position.y - ctx.tank.position.y,
      target.position.x - ctx.tank.position.x
    );
    ctx.combat.spawnProjectile({
      kind: 'frost_shell',
      x: ctx.tank.position.x + Math.cos(angle) * 46,
      y: ctx.tank.position.y + Math.sin(angle) * 46,
      angle,
      speed: spec.speed,
      damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
      radius: 6.5,
      ttl: 1.4,
      aoeRadius: spec.aoeRadius + bonusAoe,
      slowFactor: spec.slowFactor,
      slowDuration: spec.slowDuration,
      visualTier: tier,
    });
    return true;
  }
}
