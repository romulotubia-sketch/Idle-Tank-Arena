import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const CANNON_LEVELS = GAME_BALANCE.skills.cannon;

export class CannonSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'cannon',
    name: 'Heavy Cannon',
    shortLabel: 'Cannon',
    rarity: 'common',
    accentColor: '#F59E0B',
    summary: 'Fires high-velocity armor-piercing shells at a single target.',
  };

  getCooldown(level: number): number {
    return CANNON_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = CANNON_LEVELS[tier - 1];
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

    const baseAngle = Math.atan2(
      target.position.y - ctx.tank.position.y,
      target.position.x - ctx.tank.position.x
    );

    for (let i = 0; i < spec.salvoCount; i++) {
      const spread = spec.salvoCount > 1 ? (i - 0.5) * 0.08 : 0;
      const angle = baseAngle + spread;
      const spawnX = ctx.tank.position.x + Math.cos(angle) * 36;
      const spawnY = ctx.tank.position.y + Math.sin(angle) * 36;

      ctx.combat.spawnProjectile({
        kind: 'heavy_shell',
        x: spawnX,
        y: spawnY,
        angle,
        speed: Math.round(spec.speed * speedMult),
        damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
        radius: spec.shellRadius,
        ttl: 1.6,
        pierceRemaining: spec.pierceCount,
        visualTier: tier,
      });
    }

    return true;
  }
}
