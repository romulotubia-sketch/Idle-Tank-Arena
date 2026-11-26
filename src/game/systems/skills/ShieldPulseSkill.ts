import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findEnemiesInRange,
  SkillExecutionContext,
} from './BaseSkill';

const SHIELD_LEVELS = GAME_BALANCE.skills.shield_pulse;

export class ShieldPulseSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'shield_pulse',
    name: 'Shield Pulse',
    shortLabel: 'Shield',
    rarity: 'uncommon',
    accentColor: '#14B8A6',
    summary: 'Projects a protective energy barrier while pulsing outward to repel nearby attackers.',
  };

  getCooldown(level: number): number {
    return SHIELD_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = SHIELD_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const shieldMult = col?.speedMultiplier ?? 1;

    const enemies = ctx.enemySystem.getActiveEnemies();
    const nearby = findEnemiesInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      spec.pulseRadius + 130,
      enemies
    );
    if (nearby.length === 0 && (ctx.tank.shieldHp ?? 0) > 0) {
      return false;
    }
    if (enemies.length === 0) return false;

    const shieldVal = Math.max(10, Math.round(spec.shieldAmount * shieldMult));
    ctx.grantShield?.(shieldVal, spec.duration);
    ctx.combat.spawnShieldPulseEffect(
      ctx.tank.position.x,
      ctx.tank.position.y,
      spec.pulseRadius
    );

    const pulseTargets = findEnemiesInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      spec.pulseRadius,
      enemies
    );
    const dmg = applySkillDamageBonus(spec.pulseDamage, ctx, damageMult);
    for (let i = 0; i < pulseTargets.length; i++) {
      const e = pulseTargets[i];
      const dx = e.position.x - ctx.tank.position.x;
      const dy = e.position.y - ctx.tank.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      if (!e.isBoss) {
        e.position.x = Math.max(
          24,
          Math.min(ctx.bounds.width - 24, e.position.x + nx * 24)
        );
        e.position.y = Math.max(
          24,
          Math.min(ctx.bounds.height - 24, e.position.y + ny * 24)
        );
      }
      ctx.combat.applyDirectDamage(
        e,
        dmg,
        ctx.enemySystem,
        '#5EEAD4',
        ctx.result,
        false,
        nx,
        ny
      );
    }

    return true;
  }
}
