import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const ACID_LEVELS = GAME_BALANCE.skills.acid_shells;

export class AcidShellsSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'acid_shells',
    name: 'Acid Shells',
    shortLabel: 'Acid',
    rarity: 'uncommon',
    accentColor: '#84CC16',
    summary: 'Launches corrosive rounds that splash acid and melt armor with damage over time.',
  };

  getCooldown(level: number): number {
    return ACID_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = ACID_LEVELS[tier - 1];
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
      kind: 'acid_shell',
      x: ctx.tank.position.x + Math.cos(angle) * 46,
      y: ctx.tank.position.y + Math.sin(angle) * 46,
      angle,
      speed: spec.speed,
      damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
      radius: 6,
      ttl: 1.4,
      aoeRadius: spec.aoeRadius + bonusAoe,
      acidDps: applySkillDamageBonus(spec.acidDps, ctx, damageMult),
      acidDuration: spec.acidDuration,
      visualTier: tier,
    });
    return true;
  }
}
