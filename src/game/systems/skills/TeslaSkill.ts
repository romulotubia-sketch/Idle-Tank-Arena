import { EnemyInstance, SkillDefinition, Vector2 } from '../../types';
import {
  applySkillDamageBonus,
  clampSkillLevel,
  CombatSkillModule,
  findNearestEnemyInRange,
  SkillExecutionContext,
} from './BaseSkill';

interface TeslaLevelSpec {
  damage: number;
  interval: number;
  range: number;
  chainTargets: number;
  chainRadius: number;
  chainRetention: number;
}

const TESLA_LEVELS: readonly TeslaLevelSpec[] = [
  { damage: 24, interval: 1.9, range: 320, chainTargets: 2, chainRadius: 120, chainRetention: 0.78 },  // Lv1
  { damage: 32, interval: 1.75, range: 335, chainTargets: 3, chainRadius: 135, chainRetention: 0.83 }, // Lv2
  { damage: 42, interval: 1.6, range: 350, chainTargets: 4, chainRadius: 150, chainRetention: 0.88 },  // Lv3
  { damage: 54, interval: 1.4, range: 370, chainTargets: 5, chainRadius: 165, chainRetention: 0.92 },  // Lv4
  { damage: 70, interval: 1.25, range: 390, chainTargets: 6, chainRadius: 185, chainRetention: 0.96 }, // Lv5
];

export class TeslaSkill implements CombatSkillModule {
  readonly definition: SkillDefinition = {
    id: 'tesla',
    name: 'Tesla Coil',
    shortLabel: 'Tesla',
    rarity: 'epic',
    accentColor: '#38BDF8',
    summary: 'Discharges high-voltage arcs that chain across nearby enemies.',
  };

  getCooldown(level: number): number {
    return TESLA_LEVELS[clampSkillLevel(level) - 1].interval;
  }

  execute(level: number, ctx: SkillExecutionContext): boolean {
    const spec = TESLA_LEVELS[clampSkillLevel(level) - 1];
    const col = ctx.getCollectionBonuses?.(this.definition.id);
    const damageMult = col?.damageMultiplier ?? 1;
    const effectiveChainTargets =
      spec.chainTargets + (col?.bonusChainTargets ?? 0);
    const effectiveChainRadius =
      spec.chainRadius + (col?.bonusChainRadius ?? 0);

    const enemies = ctx.enemySystem.getActiveEnemies();
    const first = findNearestEnemyInRange(
      ctx.tank.position.x,
      ctx.tank.position.y,
      spec.range,
      enemies
    );
    if (!first) return false;

    const hitUids = new Set<number>();
    const chainPoints: Vector2[] = [
      { x: ctx.tank.position.x, y: ctx.tank.position.y },
    ];

    let current: EnemyInstance | null = first;
    let currentDamage = applySkillDamageBonus(spec.damage, ctx, damageMult);

    for (let hop = 0; hop < effectiveChainTargets && current; hop++) {
      hitUids.add(current.uid);
      chainPoints.push({ x: current.position.x, y: current.position.y });

      ctx.combat.applyDirectDamage(
        current,
        currentDamage,
        ctx.enemySystem,
        '#38BDF8',
        ctx.result
      );

      currentDamage = Math.max(4, Math.round(currentDamage * spec.chainRetention));

      // Find next nearest unhit enemy within effectiveChainRadius
      let next: EnemyInstance | null = null;
      let bestDistSq = effectiveChainRadius * effectiveChainRadius;
      for (let i = 0; i < enemies.length; i++) {
        const candidate = enemies[i];
        if (candidate.isDying || candidate.hp <= 0 || hitUids.has(candidate.uid)) {
          continue;
        }
        const dx = candidate.position.x - current.position.x;
        const dy = candidate.position.y - current.position.y;
        const dSq = dx * dx + dy * dy;
        if (dSq <= bestDistSq) {
          bestDistSq = dSq;
          next = candidate;
        }
      }
      current = next;
    }

    ctx.combat.spawnLightningArc(chainPoints);
    return true;
  }
}
