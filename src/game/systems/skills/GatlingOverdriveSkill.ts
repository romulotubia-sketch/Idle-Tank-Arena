import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import { SkillCollectionComputedBonuses } from '../SkillCollectionSystem';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const OVERDRIVE_LEVELS = GAME_BALANCE.skills.gatling_overdrive;

export class GatlingOverdriveSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'gatling_overdrive',
    name: 'Gatling Overdrive',
    shortLabel: 'Overdrive',
    rarity: 'rare',
    accentColor: '#F59E0B',
    summary: 'Temporarily supercharges weapon cycling speed while unleashing a rapid fan volley.',
  };

  getCooldown(level: number, bonuses?: SkillCollectionComputedBonuses): number {
    const base = OVERDRIVE_LEVELS[clampSkillLevel(level) - 1].interval;
    return base * (bonuses?.cooldownMultiplier ?? 1);
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = OVERDRIVE_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;

    if (ctx.enemySystem.countAliveEnemies() === 0) return false;
    const enemies = ctx.enemySystem.getActiveEnemies();

    const target = findNearestEnemyInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      spec.range + 90,
      enemies
    );
    if (!target) return false;

    ctx.activateOverdrive?.(spec.fireRateBonus, spec.duration);

    const baseAngle = Math.atan2(
      target.position.y - ctx.tank.position.y,
      target.position.x - ctx.tank.position.x
    );
    const dmg = applySkillDamageBonus(spec.bulletDamage, ctx, damageMult);
    const spreadStep = 0.085;

    for (let i = 0; i < spec.volleyBullets; i++) {
      const offset = (i - (spec.volleyBullets - 1) / 2) * spreadStep;
      const angle = baseAngle + offset;
      ctx.combat.spawnProjectile({
        kind: 'mg_bullet',
        x: ctx.tank.position.x + Math.cos(angle) * 48,
        y: ctx.tank.position.y + Math.sin(angle) * 48,
        angle,
        speed: spec.speed,
        damage: dmg,
        radius: 3.5,
        ttl: 0.72,
        pierceRemaining: 1,
        visualTier: tier,
      });
    }

    return true;
  }
}
