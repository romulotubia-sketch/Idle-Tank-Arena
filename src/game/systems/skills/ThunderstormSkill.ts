import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findEnemiesInRange,
  SkillExecutionContext,
} from './BaseSkill';

const THUNDER_LEVELS = GAME_BALANCE.skills.thunderstorm;

export class ThunderstormSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'thunderstorm',
    name: 'Thunderstorm',
    shortLabel: 'Storm',
    rarity: 'legendary',
    accentColor: '#60A5FA',
    summary: 'Summons staggered skyborne lightning bolts across the battlefield.',
  };

  getCooldown(level: number): number {
    return THUNDER_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = THUNDER_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const bonusRange = col?.bonusRange ?? 0;

    const candidates = findEnemiesInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      spec.range + bonusRange,
      ctx.enemySystem.getActiveEnemies()
    );
    if (candidates.length === 0) return false;

    const dmg = applySkillDamageBonus(spec.damage, ctx, damageMult);
    for (let i = 0; i < spec.strikes; i++) {
      const target = candidates[i % candidates.length];
      const jitterX = i >= candidates.length ? (Math.random() - 0.5) * 32 : 0;
      const jitterY = i >= candidates.length ? (Math.random() - 0.5) * 32 : 0;
      ctx.combat.scheduleDelayedStrike({
        kind: 'thunder',
        x: Math.max(24, Math.min(ctx.bounds.width - 24, target.position.x + jitterX)),
        y: Math.max(24, Math.min(ctx.bounds.height - 24, target.position.y + jitterY)),
        delaySec: 0.04 + i * 0.14,
        radius: spec.aoeRadius,
        damage: dmg,
        color: '#60A5FA',
      });
    }

    return true;
  }
}
