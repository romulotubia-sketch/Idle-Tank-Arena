import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

interface CannonLevelSpec {
  damage: number;
  interval: number;
  range: number;
  speed: number;
  salvoCount: number;
  pierceCount: number;
  shellRadius: number;
}

const CANNON_LEVELS: readonly CannonLevelSpec[] = [
  { damage: 38, interval: 2.2, range: 350, speed: 600, salvoCount: 1, pierceCount: 1, shellRadius: 7 },   // Lv1
  { damage: 52, interval: 1.98, range: 365, speed: 645, salvoCount: 1, pierceCount: 1, shellRadius: 7.5 }, // Lv2
  { damage: 68, interval: 1.8, range: 382, speed: 690, salvoCount: 1, pierceCount: 2, shellRadius: 8 },   // Lv3: AP pierce
  { damage: 88, interval: 1.6, range: 400, speed: 735, salvoCount: 2, pierceCount: 2, shellRadius: 8.5 }, // Lv4: Twin salvo
  { damage: 116, interval: 1.4, range: 420, speed: 780, salvoCount: 2, pierceCount: 3, shellRadius: 9.5 }, // Lv5: Twin heavy AP
];

export class CannonSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'cannon',
    name: 'Heavy Cannon',
    shortLabel: 'Cannon',
    rarity: 'common',
    accentColor: '#F59E0B',
    summary: 'Fires high-velocity armor-piercing shells at a single target.',
  };

  getCooldown(level: number): number {
    return CANNON_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = CANNON_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const speedMult = col?.speedMultiplier ?? 1;

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

    for (let i = 0; i < spec.salvoCount; i++) {
      const spread = spec.salvoCount > 1 ? (i - 0.5) * 0.08 : 0;
      const angle = baseAngle + spread;
      const spawnX = ctx.tank.position.x + Math.cos(angle) * 36;
      const spawnY = ctx.tank.position.y + Math.sin(angle) * 36;

      ctx.combat.spawnProjectile({
        kind: 'heavy_shell',
        x: spawnX,
        y: spawnY,
        angle,
        speed: Math.round(spec.speed * speedMult),
        damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
        radius: spec.shellRadius,
        ttl: 1.6,
        pierceRemaining: spec.pierceCount,
        visualTier: tier,
      });
    }

    return true;
  }
}
