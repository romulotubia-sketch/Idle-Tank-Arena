import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findEnemiesInRange,
  SkillExecutionContext,
} from './BaseSkill';

const ROCKET_LEVELS = GAME_BALANCE.skills.rocket_barrage;

export class RocketBarrageSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'rocket_barrage',
    name: 'Rocket Barrage',
    shortLabel: 'Rockets',
    rarity: 'rare',
    accentColor: '#FB7185',
    summary: 'Launches explosive rockets that detonate in an area on impact.',
  };

  getCooldown(level: number): number {
    return ROCKET_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = ROCKET_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const bonusAoe = col?.bonusAoeRadius ?? 0;

    const candidates = findEnemiesInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      spec.range,
      ctx.enemySystem.getActiveEnemies()
    );
    if (candidates.length === 0) return false;

    for (let i = 0; i < spec.rockets; i++) {
      const target = candidates[i % candidates.length];
      const baseAngle = Math.atan2(
        target.position.y - ctx.tank.position.y,
        target.position.x - ctx.tank.position.x
      );
      const fan = (i - (spec.rockets - 1) * 0.5) * 0.09;
      const angle = baseAngle + fan;

      ctx.combat.spawnProjectile({
        kind: 'rocket',
        x: ctx.tank.position.x + Math.cos(angle) * 44,
        y: ctx.tank.position.y + Math.sin(angle) * 44,
        angle,
        speed: spec.speed,
        damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
        radius: 6,
        ttl: 1.6,
        aoeRadius: spec.aoeRadius + bonusAoe,
        visualTier: tier,
      });
    }

    return true;
  }
}
