import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const RICOCHET_LEVELS = GAME_BALANCE.skills.ricochet;

export class RicochetSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'ricochet',
    name: 'Ricochet',
    shortLabel: 'Ricochet',
    rarity: 'uncommon',
    accentColor: '#2DD4BF',
    summary: 'Launches magnetized kinetic discs that bounce dynamically between nearby enemies.',
  };

  getCooldown(level: number): number {
    return RICOCHET_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = RICOCHET_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const bonusBounces = col?.bonusPierce ?? 0;

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
      kind: 'ricochet_slug',
      x: ctx.tank.position.x + Math.cos(angle) * 46,
      y: ctx.tank.position.y + Math.sin(angle) * 46,
      angle,
      speed: spec.speed,
      damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
      radius: 5.5,
      ttl: 1.6,
      pierceRemaining: 1,
      ricochetRemaining: spec.bounces + bonusBounces,
      ricochetRange: spec.bounceRadius,
      ricochetRetention: spec.retention,
      visualTier: tier,
    });
    return true;
  }
}
