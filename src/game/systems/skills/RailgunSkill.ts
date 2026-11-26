import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

const RAILGUN_LEVELS = GAME_BALANCE.skills.railgun;

export class RailgunSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'railgun',
    name: 'Railgun',
    shortLabel: 'Railgun',
    rarity: 'epic',
    accentColor: '#22D3EE',
    summary: 'Fires an electromagnetic hyper-velocity slug that pierces enemies.',
  };

  getCooldown(level: number): number {
    return RAILGUN_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = RAILGUN_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const bonusPierce = col?.bonusPierce ?? 0;

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
    const startX = ctx.tank.position.x + Math.cos(angle) * 34;
    const startY = ctx.tank.position.y + Math.sin(angle) * 34;
    const beamEndX = ctx.tank.position.x + Math.cos(angle) * spec.range;
    const beamEndY = ctx.tank.position.y + Math.sin(angle) * spec.range;

    ctx.combat.spawnRailBeam(startX, startY, beamEndX, beamEndY, spec.beamWidth);
    ctx.combat.spawnProjectile({
      kind: 'rail_slug',
      x: startX,
      y: startY,
      angle,
      speed: spec.speed,
      damage: applySkillDamageBonus(spec.damage, ctx, damageMult),
      radius: 7 + (tier - 1) * 0.6,
      ttl: 0.9,
      pierceRemaining: spec.pierceCount + bonusPierce,
      visualTier: tier,
    });

    return true;
  }
}
