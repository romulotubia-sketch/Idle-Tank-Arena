import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const SHRAPNEL_LEVELS = GAME_BALANCE.skills.shrapnel_burst;

export class ShrapnelBurstSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'shrapnel_burst',
    name: 'Shrapnel Burst',
    shortLabel: 'Shrapnel',
    rarity: 'uncommon',
    accentColor: '#FB923C',
    summary: 'Fires an armored canister shell that ruptures on impact into jagged shrapnel fragments.',
  };

  getCooldown(level: number): number {
    return SHRAPNEL_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = SHRAPNEL_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const speedMult = col?.speedMultiplier ?? 1;

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
      kind: 'shrapnel_shell',
      x: ctx.tank.position.x + Math.cos(angle) * 46,
      y: ctx.tank.position.y + Math.sin(angle) * 46,
      angle,
      speed: spec.speed * speedMult,
      damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
      radius: 6,
      ttl: 1.3,
      splitCount: spec.shards,
      splitDamage: applySkillDamageBonus(spec.shardDamage, ctx, damageMult),
      splitRadius: spec.shardSpeed * speedMult,
      visualTier: tier,
    });
    return true;
  }
}
