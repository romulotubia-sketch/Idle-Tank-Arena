import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findEnemiesInRange,
  SkillExecutionContext,
} from './BaseSkill';

const SHOCKWAVE_LEVELS = GAME_BALANCE.skills.shockwave;

export class ShockwaveSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'shockwave',
    name: 'Shockwave',
    shortLabel: 'Shockwave',
    rarity: 'common',
    accentColor: '#94A3B8',
    summary: 'Emits a kinetic blast ring around the tank that damages and pushes back enemies.',
  };

  getCooldown(level: number): number {
    return SHOCKWAVE_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = SHOCKWAVE_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const radius = spec.radius + (col?.bonusAoeRadius ?? 0);

    const targets = findEnemiesInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      radius,
      ctx.enemySystem.getActiveEnemies()
    );
    if (targets.length === 0) return false;

    ctx.combat.spawnShockwaveRing(
      ctx.tank.position.x,
      ctx.tank.position.y,
      radius,
      '#CBD5E1'
    );

    const dmg = applySkillDamageBonus(spec.damage, ctx, damageMult);
    const pad = 24;
    for (let i = 0; i < targets.length; i++) {
      const e = targets[i];
      const dx = e.position.x - ctx.tank.position.x;
      const dy = e.position.y - ctx.tank.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      // Knock back non-boss enemies cleanly inside bounds
      const pushDist = e.isBoss ? spec.knockback * 0.28 : spec.knockback;
      e.position.x = Math.max(
        pad,
        Math.min(ctx.bounds.width - pad, e.position.x + nx * pushDist)
      );
      e.position.y = Math.max(
        pad,
        Math.min(ctx.bounds.height - pad, e.position.y + ny * pushDist)
      );

      ctx.combat.applyDirectDamage(
        e,
        dmg,
        ctx.enemySystem,
        '#E2E8F0',
        ctx.result,
        false,
        nx,
        ny
      );
    }

    return true;
  }
}
