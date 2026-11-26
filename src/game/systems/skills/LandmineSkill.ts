import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  SkillExecutionContext,
} from './BaseSkill';

interface LandmineLevelSpec {
  damage: number;
  aoeRadius: number;
  interval: number;
  maxMines: number;
  deployCount: number;
  triggerRadius: number;
  armTimer: number;
}

const MINE_LEVELS: readonly LandmineLevelSpec[] = [
  { damage: 42, aoeRadius: 64, interval: 3.4, maxMines: 4, deployCount: 1, triggerRadius: 24, armTimer: 0.4 },   // Lv1
  { damage: 55, aoeRadius: 72, interval: 3.1, maxMines: 5, deployCount: 1, triggerRadius: 26, armTimer: 0.35 },  // Lv2
  { damage: 70, aoeRadius: 80, interval: 2.8, maxMines: 6, deployCount: 2, triggerRadius: 28, armTimer: 0.3 },   // Lv3: Deploys 2 mines
  { damage: 88, aoeRadius: 90, interval: 2.5, maxMines: 8, deployCount: 2, triggerRadius: 31, armTimer: 0.25 },  // Lv4
  { damage: 112, aoeRadius: 102, interval: 2.2, maxMines: 10, deployCount: 3, triggerRadius: 34, armTimer: 0.2 }, // Lv5
];

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
      const dist = 78 + Math.random() * 140;
      const rawX = ctx.tank.position.x + Math.cos(angle) * dist;
      const rawY = ctx.tank.position.y + Math.sin(angle) * dist;

      const x = Math.max(pad, Math.min(ctx.bounds.width - pad, rawX));
      const y = Math.max(pad, Math.min(ctx.bounds.height - pad, rawY));

      // Double-check safe clearance from tank body
      if (Math.hypot(x - ctx.tank.position.x, y - ctx.tank.position.y) < 58) {
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
