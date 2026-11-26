import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  SkillExecutionContext,
} from './BaseSkill';

const MINE_LEVELS = GAME_BALANCE.skills.landmines;

export class LandmineSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'landmines',
    name: 'Landmines',
    shortLabel: 'Mines',
    rarity: 'common',
    accentColor: '#A3E635',
    summary: 'Deploys proximity mines around the arena perimeter that detonate on contact.',
  };

  getCooldown(level: number): number {
    return MINE_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const spec = MINE_LEVELS[clampSkillLevel(level) - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const bonusAoe = col?.bonusAoeRadius ?? 0;
    const bonusMaxMines = col?.bonusMaxMines ?? 0;
    const pad = ctx.bounds.safeMargin + 24;

    for (let i = 0; i < spec.deployCount; i++) {
      // Deploy at a safe perimeter ring around the tank (never directly on the tank!)
      const angle = Math.random() * Math.PI * 2;
      const dist = 88 + Math.random() * 135;
      const rawX = ctx.tank.position.x + Math.cos(angle) * dist;
      const rawY = ctx.tank.position.y + Math.sin(angle) * dist;

      const x = Math.max(pad, Math.min(ctx.bounds.width - pad, rawX));
      const y = Math.max(pad, Math.min(ctx.bounds.height - pad, rawY));

      // Double-check safe clearance from tank body
      if (Math.hypot(x - ctx.tank.position.x, y - ctx.tank.position.y) < 68) {
        continue;
      }

      ctx.combat.deployLandmine(
        x,
        y,
        applySkillDamageBonus(spec.damage, ctx, damageMult),
        spec.aoeRadius + bonusAoe,
        spec.maxMines + bonusMaxMines,
        spec.triggerRadius,
        spec.armTimer
      );
    }

    return true;
  }
}
