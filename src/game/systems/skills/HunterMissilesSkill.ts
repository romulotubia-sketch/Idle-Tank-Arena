import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findEnemiesInRange,
  SkillExecutionContext,
} from './BaseSkill';

const HUNTER_LEVELS = GAME_BALANCE.skills.hunter_missiles;

export class HunterMissilesSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'hunter_missiles',
    name: 'Hunter Missiles',
    shortLabel: 'Hunter',
    rarity: 'rare',
    accentColor: '#EC4899',
    summary: 'Launches agile seeking micro-missiles that steer mid-flight onto active targets.',
  };

  getCooldown(level: number): number {
    return HUNTER_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = HUNTER_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const speedMult = col?.speedMultiplier ?? 1;

    const candidates = findEnemiesInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      spec.range,
      ctx.enemySystem.getActiveEnemies()
    );
    if (candidates.length === 0) return false;

    // Sort closest first so missiles distribute cleanly across threats
    candidates.sort((a, b) => {
      const da =
        (a.position.x - ctx.tank.position.x) ** 2 +
        (a.position.y - ctx.tank.position.y) ** 2;
      const db =
        (b.position.x - ctx.tank.position.x) ** 2 +
        (b.position.y - ctx.tank.position.y) ** 2;
      return da - db;
    });

    const dmg = applySkillDamageBonus(spec.damage, ctx, damageMult);
    const primaryTarget = candidates[0];
    const baseAngle = Math.atan2(
      primaryTarget.position.y - ctx.tank.position.y,
      primaryTarget.position.x - ctx.tank.position.x
    );

    const spreadStep = 0.24;
    for (let i = 0; i < spec.missiles; i++) {
      const target = candidates[i % candidates.length];
      const offset = (i - (spec.missiles - 1) / 2) * spreadStep;
      const launchAngle = baseAngle + offset;

      ctx.combat.spawnProjectile({
        kind: 'hunter_missile',
        x: ctx.tank.position.x + Math.cos(launchAngle) * 44,
        y: ctx.tank.position.y + Math.sin(launchAngle) * 44,
        angle: launchAngle,
        speed: spec.speed * speedMult,
        damage: dmg,
        radius: 5.5,
        ttl: 2.2,
        aoeRadius: spec.aoeRadius,
        homingTurnRate: spec.turnRate,
        homingTargetUid: target.uid,
        visualTier: tier,
      });
    }

    return true;
  }
}
