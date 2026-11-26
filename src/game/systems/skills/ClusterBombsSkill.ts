import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const CLUSTER_LEVELS = GAME_BALANCE.skills.cluster_bombs;

export class ClusterBombsSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'cluster_bombs',
    name: 'Cluster Bombs',
    shortLabel: 'Cluster',
    rarity: 'rare',
    accentColor: '#EA580C',
    summary: 'Launches heavy submunition shells that split into multiple secondary explosives.',
  };

  getCooldown(level: number): number {
    return CLUSTER_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = CLUSTER_LEVELS[tier - 1];
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
      kind: 'cluster_bomb',
      x: ctx.tank.position.x + Math.cos(angle) * 48,
      y: ctx.tank.position.y + Math.sin(angle) * 48,
      angle,
      speed: spec.speed,
      damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
      radius: 7,
      ttl: 1.6,
      aoeRadius: spec.bombletAoe + bonusAoe,
      splitCount: spec.bomblets,
      splitDamage: applySkillDamageBonus(spec.bombletDamage, ctx, damageMult),
      splitRadius: 56 + bonusAoe * 0.5,
      visualTier: tier,
    });
    return true;
  }
}
