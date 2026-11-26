import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const PLASMA_LEVELS = GAME_BALANCE.skills.plasma_cannon;

export class PlasmaCannonSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'plasma_cannon',
    name: 'Plasma Cannon',
    shortLabel: 'Plasma',
    rarity: 'epic',
    accentColor: '#A855F7',
    summary: 'Fires volatile plasma spheres that detonate into lingering energy vortices.',
  };

  getCooldown(level: number): number {
    return PLASMA_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = PLASMA_LEVELS[tier - 1];
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
      kind: 'plasma_orb',
      x: ctx.tank.position.x + Math.cos(angle) * 48,
      y: ctx.tank.position.y + Math.sin(angle) * 48,
      angle,
      speed: spec.speed,
      damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
      radius: 9,
      ttl: 1.8,
      aoeRadius: spec.aoeRadius + bonusAoe,
      splitDamage: applySkillDamageBonus(spec.vortexDamage, ctx, damageMult),
      visualTier: tier,
    });
    return true;
  }
}
