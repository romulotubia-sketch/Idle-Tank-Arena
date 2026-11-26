import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findEnemiesInRange,
  SkillExecutionContext,
} from './BaseSkill';

const MORTAR_LEVELS = GAME_BALANCE.skills.mortar;

export class MortarSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'mortar',
    name: 'Siege Mortar',
    shortLabel: 'Mortar',
    rarity: 'rare',
    accentColor: '#F97316',
    summary: 'Lobs high-arc artillery shells onto enemy positions for heavy AoE.',
  };

  getCooldown(level: number): number {
    return MORTAR_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = MORTAR_LEVELS[tier - 1];
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

    for (let i = 0; i < spec.shells; i++) {
      const target = candidates[(candidates.length - 1 - i + candidates.length) % candidates.length];
      const scatterX = i === 0 ? 0 : (Math.random() - 0.5) * 32;
      const scatterY = i === 0 ? 0 : (Math.random() - 0.5) * 32;
      const tx = target.position.x + scatterX;
      const ty = target.position.y + scatterY;
      const angle = Math.atan2(ty - ctx.tank.position.y, tx - ctx.tank.position.x);

      ctx.combat.spawnProjectile({
        kind: 'mortar_shell',
        x: ctx.tank.position.x,
        y: ctx.tank.position.y,
        angle,
        speed: 0,
        damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
        radius: 6,
        aoeRadius: spec.aoeRadius + bonusAoe,
        targetX: tx,
        targetY: ty,
        flightDuration: spec.flightDuration + i * 0.1,
        visualTier: tier,
      });
    }

    return true;
  }
}
