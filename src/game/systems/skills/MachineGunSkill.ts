import { SkillDefinition } from '../../types';
import { SkillCollectionComputedBonuses } from '../SkillCollectionSystem';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

interface MachineGunLevelSpec {
  damage: number;
  interval: number;
  range: number;
  speed: number;
  bulletsPerBurst: number;
  pierceCount: number;
}

const MG_LEVELS: readonly MachineGunLevelSpec[] = [
  { damage: 8, interval: 0.3, range: 290, speed: 690, bulletsPerBurst: 1, pierceCount: 1 },   // Lv1
  { damage: 10, interval: 0.25, range: 305, speed: 720, bulletsPerBurst: 1, pierceCount: 1 }, // Lv2
  { damage: 12, interval: 0.22, range: 320, speed: 745, bulletsPerBurst: 2, pierceCount: 1 }, // Lv3: Twin-linked
  { damage: 15, interval: 0.19, range: 338, speed: 775, bulletsPerBurst: 2, pierceCount: 2 }, // Lv4: AP rounds
  { damage: 20, interval: 0.15, range: 360, speed: 810, bulletsPerBurst: 3, pierceCount: 2 }, // Lv5: Tri-barrel rotary AP
];

export class MachineGunSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'machine_gun',
    name: 'Machine Gun',
    shortLabel: 'MG',
    rarity: 'common',
    accentColor: '#FACC15',
    summary: 'Rapidly suppresses nearby enemies with high-rate tracer rounds.',
  };

  getCooldown(level: number, bonuses?: SkillCollectionComputedBonuses): number {
    const baseCd = MG_LEVELS[clampSkillLevel(level) - 1].interval;
    const mult = bonuses?.cooldownMultiplier ?? 1;
    return Math.max(0.08, Math.round(baseCd * mult * 1000) / 1000);
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = MG_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;

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

    for (let i = 0; i < spec.bulletsPerBurst; i++) {
      const jitter = (Math.random() - 0.5) * 0.11;
      const offsetAngle =
        spec.bulletsPerBurst > 1 ? (i - (spec.bulletsPerBurst - 1) * 0.5) * 0.06 : 0;
      const angle = baseAngle + offsetAngle + jitter;

      ctx.combat.spawnProjectile({
        kind: 'mg_bullet',
        x: ctx.tank.position.x + Math.cos(angle) * 28,
        y: ctx.tank.position.y + Math.sin(angle) * 28,
        angle,
        speed: spec.speed,
        damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
        radius: 3.5,
        ttl: 1.0,
        pierceRemaining: spec.pierceCount,
        visualTier: tier,
      });
    }

    return true;
  }
}
