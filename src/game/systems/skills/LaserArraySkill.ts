import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const LASER_LEVELS = GAME_BALANCE.skills.laser_array;

export class LaserArraySkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'laser_array',
    name: 'Laser Array',
    shortLabel: 'Laser',
    rarity: 'epic',
    accentColor: '#F43F5E',
    summary: 'Projects synchronized high-intensity crimson laser beams slicing through enemy formations.',
  };

  getCooldown(level: number): number {
    return LASER_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = LASER_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const bonusRange = col?.bonusRange ?? 0;

    const enemies = ctx.enemySystem.getActiveEnemies();
    const effectiveRange = spec.range + bonusRange;
    const target = findNearestEnemyInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      effectiveRange,
      enemies
    );
    if (!target) return false;

    const baseAngle = Math.atan2(
      target.position.y - ctx.tank.position.y,
      target.position.x - ctx.tank.position.x
    );
    const dmg = applySkillDamageBonus(spec.damage, ctx, damageMult);

    const beamCount: number = spec.beams;
    for (let b = 0; b < beamCount; b++) {
      const offset =
        beamCount <= 1
          ? 0
          : (b - (beamCount - 1) / 2) * (spec.sweepSpread / (beamCount - 1)) * 2;
      const angle = baseAngle + offset;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const startX = ctx.tank.position.x + cos * 46;
      const startY = ctx.tank.position.y + sin * 46;
      const endX = ctx.tank.position.x + cos * effectiveRange;
      const endY = ctx.tank.position.y + sin * effectiveRange;

      ctx.combat.spawnLaserBeam(
        startX,
        startY,
        endX,
        endY,
        spec.beamWidth,
        '#F43F5E'
      );

      const segDx = endX - startX;
      const segDy = endY - startY;
      const lenSq = segDx * segDx + segDy * segDy || 1;

      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (enemy.isDying || enemy.hp <= 0) continue;
        const t = Math.max(
          0,
          Math.min(
            1,
            ((enemy.position.x - startX) * segDx +
              (enemy.position.y - startY) * segDy) /
              lenSq
          )
        );
        const projX = startX + t * segDx;
        const projY = startY + t * segDy;
        const dist = Math.hypot(enemy.position.x - projX, enemy.position.y - projY);
        if (dist <= spec.beamWidth + enemy.radius + 6) {
          ctx.combat.applyDirectDamage(
            enemy,
            dmg,
            ctx.enemySystem,
            '#FB7185',
            ctx.result,
            false,
            cos,
            sin
          );
        }
      }
    }

    return true;
  }
}
