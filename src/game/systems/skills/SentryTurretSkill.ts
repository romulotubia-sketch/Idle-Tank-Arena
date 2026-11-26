import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  SkillExecutionContext,
} from './BaseSkill';

const SENTRY_LEVELS = GAME_BALANCE.skills.sentry_turret;

export class SentryTurretSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'sentry_turret',
    name: 'Sentry Turret',
    shortLabel: 'Turret',
    rarity: 'epic',
    accentColor: '#10B981',
    summary: 'Deploys automated perimeter turrets that independently track and suppress enemies.',
  };

  getCooldown(level: number): number {
    return SENTRY_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = SENTRY_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const bonusRange = col?.bonusRange ?? 0;

    if (ctx.enemySystem.countAliveEnemies() === 0) return false;

    const angle = Math.random() * Math.PI * 2;
    const dist = 56 + Math.random() * 24;
    const padding = 36;
    const x = Math.max(
      padding,
      Math.min(ctx.bounds.width - padding, ctx.tank.position.x + Math.cos(angle) * dist)
    );
    const y = Math.max(
      padding,
      Math.min(ctx.bounds.height - padding, ctx.tank.position.y + Math.sin(angle) * dist)
    );

    ctx.combat.deploySentryTurret(
      x,
      y,
      applySkillDamageBonus(spec.damage, ctx, damageMult),
      spec.range + bonusRange,
      spec.fireInterval,
      spec.duration,
      spec.maxTurrets,
      tier
    );
    return true;
  }
}
