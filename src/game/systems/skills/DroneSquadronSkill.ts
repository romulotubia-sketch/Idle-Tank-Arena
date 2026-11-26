import { GAME_BALANCE } from '../../balanceConfig';
import { SkillDefinition } from '../../types';
import { SkillCollectionComputedBonuses } from '../SkillCollectionSystem';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  SkillExecutionContext,
} from './BaseSkill';

const DRONE_LEVELS = GAME_BALANCE.skills.drone_squadron;

export class DroneSquadronSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'drone_squadron',
    name: 'Drone Squadron',
    shortLabel: 'Drones',
    rarity: 'legendary',
    accentColor: '#F59E0B',
    summary: 'Launches orbiting tactical combat drones that autonomously fire on nearby targets.',
  };

  getCooldown(level: number, bonuses?: SkillCollectionComputedBonuses): number {
    const base = DRONE_LEVELS[clampSkillLevel(level) - 1].interval;
    return base * (bonuses?.cooldownMultiplier ?? 1);
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const tier = clampSkillLevel(level);
    const spec = DRONE_LEVELS[tier - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const fireIntervalMult = col?.cooldownMultiplier ?? 1;

    if (ctx.enemySystem.countAliveEnemies() === 0) return false;

    ctx.combat.deployDroneSquadron(
      ctx.tank.position.x,
      ctx.tank.position.y,
      spec.drones,
      applySkillDamageBonus(spec.damage, ctx, damageMult),
      spec.range,
      spec.fireInterval * fireIntervalMult,
      spec.duration,
      tier
    );
    return true;
  }
}
