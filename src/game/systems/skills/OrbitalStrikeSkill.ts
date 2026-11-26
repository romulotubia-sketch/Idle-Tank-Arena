import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findEnemiesInRange,
  SkillExecutionContext,
} from './BaseSkill';

const ORBITAL_LEVELS = GAME_BALANCE.skills.orbital_strike;

export class OrbitalStrikeSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'orbital_strike',
    name: 'Orbital Strike',
    shortLabel: 'Orbital',
    rarity: 'legendary',
    accentColor: '#22D3EE',
    summary: 'Calls down a devastating satellite laser strike on the densest enemy cluster.',
  };

  getCooldown(level: number): number {
    return ORBITAL_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = ORBITAL_LEVELS[tier - 1];
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

    const effectiveRadius = spec.aoeRadius + bonusAoe;
    const clusterRadSq = effectiveRadius * effectiveRadius;
    let bestTarget = candidates[0];
    let bestScore = -1;

    for (let i = 0; i < candidates.length; i++) {
      const a = candidates[i];
      let score = a.isBoss ? 3 : 1;
      for (let j = 0; j < candidates.length; j++) {
        if (i === j) continue;
        const b = candidates[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        if (dx * dx + dy * dy <= clusterRadSq) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestTarget = a;
      }
    }

    ctx.combat.scheduleDelayedStrike({
      kind: 'orbital',
      x: bestTarget.position.x,
      y: bestTarget.position.y,
      delaySec: spec.delaySec,
      radius: effectiveRadius,
      damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
      color: '#22D3EE',
    });

    return true;
  }
}
