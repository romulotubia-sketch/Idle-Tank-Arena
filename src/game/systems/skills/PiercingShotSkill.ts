import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const PIERCE_LEVELS = GAME_BALANCE.skills.piercing_shot;

export class PiercingShotSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'piercing_shot',
    name: 'Piercing Shot',
    shortLabel: 'Pierce',
    rarity: 'common',
    accentColor: '#FBBF24',
    summary: 'Fires a high-velocity penetrator round that slices through lined-up foes.',
  };

  getCooldown(level: number): number {
    return PIERCE_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = PIERCE_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const bonusPierce = col?.bonusPierce ?? 0;

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
      kind: 'pierce_slug',
      x: ctx.tank.position.x + Math.cos(angle) * 48,
      y: ctx.tank.position.y + Math.sin(angle) * 48,
      angle,
      speed: spec.speed,
      damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
      radius: 5.5,
      ttl: 1.0,
      pierceRemaining: spec.pierceCount + bonusPierce,
      visualTier: tier,
    });
    return true;
  }
}
