import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findEnemiesInRange,
  SkillExecutionContext,
} from './BaseSkill';

interface RocketLevelSpec {
  damage: number;
  aoeRadius: number;
  interval: number;
  range: number;
  rockets: number;
  speed: number;
}

const ROCKET_LEVELS: readonly RocketLevelSpec[] = [
  { damage: 26, aoeRadius: 56, interval: 3.0, range: 350, rockets: 2, speed: 410 }, // Lv1
  { damage: 34, aoeRadius: 64, interval: 2.75, range: 365, rockets: 2, speed: 430 }, // Lv2
  { damage: 44, aoeRadius: 74, interval: 2.55, range: 380, rockets: 3, speed: 450 }, // Lv3: 3-rocket salvo
  { damage: 56, aoeRadius: 84, interval: 2.3, range: 395, rockets: 4, speed: 470 }, // Lv4
  { damage: 72, aoeRadius: 96, interval: 2.05, range: 415, rockets: 5, speed: 500 }, // Lv5
];

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
        x: ctx.tank.position.x + Math.cos(angle) * 26,
        y: ctx.tank.position.y + Math.sin(angle) * 26,
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
