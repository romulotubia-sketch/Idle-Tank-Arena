import { ALL_SKILL_IDS, SKILL_COLLECTION_CONFIG } from '../constants';
import {
  SavedSkillCollectionEntry,
  SavedSkillCollectionState,
  SkillCollectionEntry,
  SkillId,
} from '../types';

interface InternalSkillRecord {
  skillId: SkillId;
  unlocked: boolean;
  collectionLevel: number;
  fragments: number;
}

export interface SkillSummonCollectionResult {
  unlockedNew: boolean;
  fragmentsAwarded: number;
  entry: SkillCollectionEntry;
}

export type SkillCollectionUpgradeFailureReason =
  | 'not_found'
  | 'not_unlocked'
  | 'max_level'
  | 'insufficient_fragments'
  | 'cooldown_locked';

export interface SkillCollectionUpgradeResult {
  success: boolean;
  reason?: SkillCollectionUpgradeFailureReason;
  entry?: SkillCollectionEntry;
  previousLevel?: number;
  newLevel?: number;
  costPaid?: number;
}

export interface SkillCollectionComputedBonuses {
  collectionLevel: number;
  damageMultiplier: number;
  cooldownMultiplier: number;
  speedMultiplier: number;
  bonusAoeRadius: number;
  bonusRange: number;
  bonusConeAngle: number;
  bonusPierce: number;
  bonusChainRadius: number;
  bonusChainTargets: number;
  bonusMaxMines: number;
}

export interface SkillCollectionPreviewRow {
  label: string;
  currentText: string;
  nextText: string | null;
}

const VALID_SKILL_ID_SET = new Set<SkillId>(ALL_SKILL_IDS);
const INITIAL_UNLOCK_SET = new Set<SkillId>(
  SKILL_COLLECTION_CONFIG.initiallyUnlocked
);

export class SkillCollectionSystem {
  private readonly records = new Map<SkillId, InternalSkillRecord>();
  private lastUpgradeTimestampMs = -10000;
  private readonly minUpgradeIntervalMs = 180;

  constructor() {
    this.resetToInitial();
  }

  resetToInitial(): void {
    this.records.clear();
    for (let i = 0; i < ALL_SKILL_IDS.length; i++) {
      const skillId = ALL_SKILL_IDS[i];
      const initiallyUnlocked = INITIAL_UNLOCK_SET.has(skillId);
      this.records.set(skillId, {
        skillId,
        unlocked: initiallyUnlocked,
        collectionLevel: initiallyUnlocked ? 1 : 0,
        fragments: 0,
      });
    }
  }

  static getUpgradeCostForLevel(
    currentLevel: number,
    unlocked: boolean
  ): number | null {
    if (!unlocked || currentLevel < 1) return null;
    if (currentLevel >= SKILL_COLLECTION_CONFIG.maxLevel) return null;
    const cost = SKILL_COLLECTION_CONFIG.upgradeCostsByLevel[currentLevel - 1];
    return typeof cost === 'number' && cost > 0 ? cost : null;
  }

  private toPublicEntry(record: InternalSkillRecord): SkillCollectionEntry {
    const nextUpgradeCost = SkillCollectionSystem.getUpgradeCostForLevel(
      record.collectionLevel,
      record.unlocked
    );
    const isMaxLevel =
      record.unlocked &&
      record.collectionLevel >= SKILL_COLLECTION_CONFIG.maxLevel;
    const canUpgrade =
      record.unlocked &&
      !isMaxLevel &&
      nextUpgradeCost !== null &&
      record.fragments >= nextUpgradeCost;

    return {
      skillId: record.skillId,
      unlocked: record.unlocked,
      collectionLevel: record.collectionLevel,
      maxCollectionLevel: SKILL_COLLECTION_CONFIG.maxLevel,
      fragments: record.fragments,
      nextUpgradeCost,
      canUpgrade,
      isMaxLevel,
    };
  }

  getEntry(skillId: SkillId): SkillCollectionEntry | undefined {
    const rec = this.records.get(skillId);
    return rec ? this.toPublicEntry(rec) : undefined;
  }

  getAllEntries(): SkillCollectionEntry[] {
    const list: SkillCollectionEntry[] = [];
    for (let i = 0; i < ALL_SKILL_IDS.length; i++) {
      const rec = this.records.get(ALL_SKILL_IDS[i]);
      if (rec) list.push(this.toPublicEntry(rec));
    }
    return list;
  }

  isUnlocked(skillId: SkillId): boolean {
    return Boolean(this.records.get(skillId)?.unlocked);
  }

  getUnlockedSkillIds(): SkillId[] {
    const ids: SkillId[] = [];
    for (let i = 0; i < ALL_SKILL_IDS.length; i++) {
      const id = ALL_SKILL_IDS[i];
      if (this.records.get(id)?.unlocked) {
        ids.push(id);
      }
    }
    return ids;
  }

  getUnlockedCount(): number {
    let count = 0;
    for (let i = 0; i < ALL_SKILL_IDS.length; i++) {
      if (this.records.get(ALL_SKILL_IDS[i])?.unlocked) {
        count += 1;
      }
    }
    return count;
  }

  hasAnyAffordableUpgrade(): boolean {
    for (let i = 0; i < ALL_SKILL_IDS.length; i++) {
      const rec = this.records.get(ALL_SKILL_IDS[i]);
      if (!rec) continue;
      if (this.toPublicEntry(rec).canUpgrade) return true;
    }
    return false;
  }

  recordSummon(skillId: SkillId): SkillSummonCollectionResult {
    const rec = this.records.get(skillId);
    if (!rec) {
      throw new Error(`Unknown skillId in SkillCollectionSystem: ${skillId}`);
    }

    if (!rec.unlocked) {
      rec.unlocked = true;
      rec.collectionLevel = Math.max(1, rec.collectionLevel);
      const awarded = SKILL_COLLECTION_CONFIG.firstDiscoveryFragments;
      rec.fragments = Math.max(0, rec.fragments + awarded);
      return {
        unlockedNew: true,
        fragmentsAwarded: awarded,
        entry: this.toPublicEntry(rec),
      };
    }

    const awarded = SKILL_COLLECTION_CONFIG.duplicateDiscoveryFragments;
    rec.fragments = Math.max(0, rec.fragments + awarded);
    return {
      unlockedNew: false,
      fragmentsAwarded: awarded,
      entry: this.toPublicEntry(rec),
    };
  }

  awardBonusFragments(skillId: SkillId, amount: number): number {
    const cleanAmount = Math.max(0, Math.floor(amount));
    if (cleanAmount <= 0) return 0;
    const rec = this.records.get(skillId);
    if (!rec) return 0;
    if (!rec.unlocked) {
      rec.unlocked = true;
      rec.collectionLevel = Math.max(1, rec.collectionLevel);
    }
    rec.fragments = Math.max(0, rec.fragments + cleanAmount);
    return cleanAmount;
  }

  upgradeSkill(
    skillId: SkillId,
    nowMs: number = performance.now()
  ): SkillCollectionUpgradeResult {
    if (nowMs - this.lastUpgradeTimestampMs < this.minUpgradeIntervalMs) {
      return { success: false, reason: 'cooldown_locked' };
    }

    const rec = this.records.get(skillId);
    if (!rec) {
      return { success: false, reason: 'not_found' };
    }

    if (!rec.unlocked || rec.collectionLevel < 1) {
      return {
        success: false,
        reason: 'not_unlocked',
        entry: this.toPublicEntry(rec),
      };
    }

    if (rec.collectionLevel >= SKILL_COLLECTION_CONFIG.maxLevel) {
      return {
        success: false,
        reason: 'max_level',
        entry: this.toPublicEntry(rec),
      };
    }

    const cost = SkillCollectionSystem.getUpgradeCostForLevel(
      rec.collectionLevel,
      rec.unlocked
    );
    if (cost === null) {
      return {
        success: false,
        reason: 'max_level',
        entry: this.toPublicEntry(rec),
      };
    }

    if (rec.fragments < cost) {
      return {
        success: false,
        reason: 'insufficient_fragments',
        entry: this.toPublicEntry(rec),
      };
    }

    const previousLevel = rec.collectionLevel;
    rec.fragments = Math.max(0, rec.fragments - cost);
    rec.collectionLevel = Math.min(
      SKILL_COLLECTION_CONFIG.maxLevel,
      previousLevel + 1
    );
    this.lastUpgradeTimestampMs = nowMs;

    return {
      success: true,
      entry: this.toPublicEntry(rec),
      previousLevel,
      newLevel: rec.collectionLevel,
      costPaid: cost,
    };
  }

  getComputedBonuses(
    skillId: SkillId,
    levelOverride?: number
  ): SkillCollectionComputedBonuses {
    const rec = this.records.get(skillId);
    const effectiveLevel =
      levelOverride !== undefined
        ? Math.max(0, Math.min(SKILL_COLLECTION_CONFIG.maxLevel, levelOverride))
        : rec && rec.unlocked
          ? rec.collectionLevel
          : 0;
    const bonusSteps = Math.max(0, effectiveLevel - 1);

    const base: SkillCollectionComputedBonuses = {
      collectionLevel: effectiveLevel,
      damageMultiplier: 1,
      cooldownMultiplier: 1,
      speedMultiplier: 1,
      bonusAoeRadius: 0,
      bonusRange: 0,
      bonusConeAngle: 0,
      bonusPierce: 0,
      bonusChainRadius: 0,
      bonusChainTargets: 0,
      bonusMaxMines: 0,
    };

    if (bonusSteps === 0) {
      return base;
    }

    const cfg = SKILL_COLLECTION_CONFIG.perSkillBonuses;
    switch (skillId) {
      case 'cannon': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.cannon.damagePctPerLevel) / 100;
        base.speedMultiplier =
          1 + (bonusSteps * cfg.cannon.speedPctPerLevel) / 100;
        break;
      }
      case 'machine_gun': {
        base.cooldownMultiplier =
          1 / (1 + (bonusSteps * cfg.machine_gun.fireRatePctPerLevel) / 100);
        base.damageMultiplier =
          1 + (bonusSteps * cfg.machine_gun.damagePctPerLevel) / 100;
        break;
      }
      case 'rocket_barrage': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.rocket_barrage.damagePctPerLevel) / 100;
        base.bonusAoeRadius =
          bonusSteps * cfg.rocket_barrage.aoeRadiusPerLevel;
        break;
      }
      case 'mortar': {
        base.bonusAoeRadius = bonusSteps * cfg.mortar.aoeRadiusPerLevel;
        base.damageMultiplier =
          1 + (bonusSteps * cfg.mortar.damagePctPerLevel) / 100;
        break;
      }
      case 'railgun': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.railgun.damagePctPerLevel) / 100;
        base.bonusPierce = cfg.railgun.bonusPierceAtLevels.filter(
          (lvl) => effectiveLevel >= lvl
        ).length;
        break;
      }
      case 'flame_thrower': {
        base.bonusRange = bonusSteps * cfg.flame_thrower.rangePerLevel;
        base.bonusConeAngle = bonusSteps * cfg.flame_thrower.coneAnglePerLevel;
        base.damageMultiplier =
          1 + (bonusSteps * cfg.flame_thrower.damagePctPerLevel) / 100;
        break;
      }
      case 'tesla': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.tesla.damagePctPerLevel) / 100;
        base.bonusChainRadius = bonusSteps * cfg.tesla.chainRadiusPerLevel;
        base.bonusChainTargets = cfg.tesla.bonusChainAtLevels.filter(
          (lvl) => effectiveLevel >= lvl
        ).length;
        break;
      }
      case 'landmines': {
        base.bonusAoeRadius = bonusSteps * cfg.landmines.aoeRadiusPerLevel;
        base.damageMultiplier =
          1 + (bonusSteps * cfg.landmines.damagePctPerLevel) / 100;
        base.bonusMaxMines = cfg.landmines.bonusMaxMinesAtLevels.filter(
          (lvl) => effectiveLevel >= lvl
        ).length;
        break;
      }
      case 'piercing_shot': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.piercing_shot.damagePctPerLevel) / 100;
        base.bonusPierce = cfg.piercing_shot.bonusPierceAtLevels.filter(
          (lvl) => effectiveLevel >= lvl
        ).length;
        break;
      }
      case 'shockwave': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.shockwave.damagePctPerLevel) / 100;
        base.bonusAoeRadius = bonusSteps * cfg.shockwave.aoeRadiusPerLevel;
        break;
      }
      case 'ricochet': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.ricochet.damagePctPerLevel) / 100;
        base.bonusPierce = cfg.ricochet.bonusBounceAtLevels.filter(
          (lvl) => effectiveLevel >= lvl
        ).length;
        break;
      }
      case 'frost_cannon': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.frost_cannon.damagePctPerLevel) / 100;
        base.bonusAoeRadius = bonusSteps * cfg.frost_cannon.aoeRadiusPerLevel;
        break;
      }
      case 'acid_shells': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.acid_shells.damagePctPerLevel) / 100;
        base.bonusAoeRadius = bonusSteps * cfg.acid_shells.aoeRadiusPerLevel;
        break;
      }
      case 'shrapnel_burst': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.shrapnel_burst.damagePctPerLevel) / 100;
        base.speedMultiplier =
          1 + (bonusSteps * cfg.shrapnel_burst.speedPctPerLevel) / 100;
        break;
      }
      case 'shield_pulse': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.shield_pulse.damagePctPerLevel) / 100;
        base.speedMultiplier =
          1 + (bonusSteps * cfg.shield_pulse.shieldPctPerLevel) / 100;
        break;
      }
      case 'cluster_bombs': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.cluster_bombs.damagePctPerLevel) / 100;
        base.bonusAoeRadius = bonusSteps * cfg.cluster_bombs.aoeRadiusPerLevel;
        break;
      }
      case 'hunter_missiles': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.hunter_missiles.damagePctPerLevel) / 100;
        base.speedMultiplier =
          1 + (bonusSteps * cfg.hunter_missiles.speedPctPerLevel) / 100;
        break;
      }
      case 'gatling_overdrive': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.gatling_overdrive.damagePctPerLevel) / 100;
        base.cooldownMultiplier =
          1 /
          (1 + (bonusSteps * cfg.gatling_overdrive.fireRatePctPerLevel) / 100);
        break;
      }
      case 'laser_array': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.laser_array.damagePctPerLevel) / 100;
        base.bonusRange = bonusSteps * cfg.laser_array.rangePerLevel;
        break;
      }
      case 'plasma_cannon': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.plasma_cannon.damagePctPerLevel) / 100;
        base.bonusAoeRadius = bonusSteps * cfg.plasma_cannon.aoeRadiusPerLevel;
        break;
      }
      case 'sentry_turret': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.sentry_turret.damagePctPerLevel) / 100;
        base.bonusRange = bonusSteps * cfg.sentry_turret.rangePerLevel;
        break;
      }
      case 'drone_squadron': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.drone_squadron.damagePctPerLevel) / 100;
        base.cooldownMultiplier =
          1 /
          (1 + (bonusSteps * cfg.drone_squadron.fireRatePctPerLevel) / 100);
        break;
      }
      case 'orbital_strike': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.orbital_strike.damagePctPerLevel) / 100;
        base.bonusAoeRadius = bonusSteps * cfg.orbital_strike.aoeRadiusPerLevel;
        break;
      }
      case 'thunderstorm': {
        base.damageMultiplier =
          1 + (bonusSteps * cfg.thunderstorm.damagePctPerLevel) / 100;
        base.bonusRange = bonusSteps * cfg.thunderstorm.rangePerLevel;
        break;
      }
    }

    return base;
  }

  getBonusPreviewRows(skillId: SkillId): SkillCollectionPreviewRow[] {
    const rec = this.records.get(skillId);
    const currentLevel = rec && rec.unlocked ? rec.collectionLevel : 1;
    const isMax =
      Boolean(rec?.unlocked) &&
      currentLevel >= SKILL_COLLECTION_CONFIG.maxLevel;
    const nextLevel = isMax ? null : currentLevel + 1;

    const curr = this.getComputedBonuses(skillId, currentLevel);
    const next =
      nextLevel !== null ? this.getComputedBonuses(skillId, nextLevel) : null;

    const pct = (mult: number) => `+${Math.round((mult - 1) * 1000) / 10}%`;
    const fireRatePct = (cdMult: number) =>
      `+${Math.round((1 / cdMult - 1) * 1000) / 10}%`;

    switch (skillId) {
      case 'cannon':
        return [
          {
            label: 'Base Shell Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Shell Velocity',
            currentText: pct(curr.speedMultiplier),
            nextText: next ? pct(next.speedMultiplier) : null,
          },
        ];
      case 'machine_gun':
        return [
          {
            label: 'Firing Speed',
            currentText: fireRatePct(curr.cooldownMultiplier),
            nextText: next ? fireRatePct(next.cooldownMultiplier) : null,
          },
          {
            label: 'Bullet Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
        ];
      case 'rocket_barrage':
        return [
          {
            label: 'Rocket Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Blast Radius',
            currentText: `+${curr.bonusAoeRadius.toFixed(1)} px`,
            nextText: next ? `+${next.bonusAoeRadius.toFixed(1)} px` : null,
          },
        ];
      case 'mortar':
        return [
          {
            label: 'Blast Radius',
            currentText: `+${Math.round(curr.bonusAoeRadius)} px`,
            nextText: next ? `+${Math.round(next.bonusAoeRadius)} px` : null,
          },
          {
            label: 'Shell Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
        ];
      case 'railgun':
        return [
          {
            label: 'Slug Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Bonus Pierce',
            currentText: `+${curr.bonusPierce}`,
            nextText: next ? `+${next.bonusPierce}` : null,
          },
        ];
      case 'flame_thrower':
        return [
          {
            label: 'Flame Reach',
            currentText: `+${Math.round(curr.bonusRange)} px`,
            nextText: next ? `+${Math.round(next.bonusRange)} px` : null,
          },
          {
            label: 'Cone Width',
            currentText: `+${Math.round((curr.bonusConeAngle * 180) / Math.PI)}°`,
            nextText: next
              ? `+${Math.round((next.bonusConeAngle * 180) / Math.PI)}°`
              : null,
          },
          {
            label: 'Flame Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
        ];
      case 'tesla':
        return [
          {
            label: 'Chain Jump Radius',
            currentText: `+${Math.round(curr.bonusChainRadius)} px`,
            nextText: next ? `+${Math.round(next.bonusChainRadius)} px` : null,
          },
          {
            label: 'Bonus Chain Targets',
            currentText: `+${curr.bonusChainTargets}`,
            nextText: next ? `+${next.bonusChainTargets}` : null,
          },
          {
            label: 'Arc Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
        ];
      case 'landmines':
        return [
          {
            label: 'Explosion Radius',
            currentText: `+${curr.bonusAoeRadius.toFixed(1)} px`,
            nextText: next ? `+${next.bonusAoeRadius.toFixed(1)} px` : null,
          },
          {
            label: 'Mine Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Max Active Mines',
            currentText: `+${curr.bonusMaxMines}`,
            nextText: next ? `+${next.bonusMaxMines}` : null,
          },
        ];
      case 'piercing_shot':
        return [
          {
            label: 'Bolt Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Bonus Pierce',
            currentText: `+${curr.bonusPierce}`,
            nextText: next ? `+${next.bonusPierce}` : null,
          },
        ];
      case 'shockwave':
        return [
          {
            label: 'Pulse Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Shockwave Radius',
            currentText: `+${Math.round(curr.bonusAoeRadius)} px`,
            nextText: next ? `+${Math.round(next.bonusAoeRadius)} px` : null,
          },
        ];
      case 'ricochet':
        return [
          {
            label: 'Disc Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Bonus Bounces',
            currentText: `+${curr.bonusPierce}`,
            nextText: next ? `+${next.bonusPierce}` : null,
          },
        ];
      case 'frost_cannon':
        return [
          {
            label: 'Cryo Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Freeze Radius',
            currentText: `+${Math.round(curr.bonusAoeRadius)} px`,
            nextText: next ? `+${Math.round(next.bonusAoeRadius)} px` : null,
          },
        ];
      case 'acid_shells':
        return [
          {
            label: 'Acid & Impact Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Splash Radius',
            currentText: `+${curr.bonusAoeRadius.toFixed(1)} px`,
            nextText: next ? `+${next.bonusAoeRadius.toFixed(1)} px` : null,
          },
        ];
      case 'shrapnel_burst':
        return [
          {
            label: 'Shell & Shard Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Projectile Speed',
            currentText: pct(curr.speedMultiplier),
            nextText: next ? pct(next.speedMultiplier) : null,
          },
        ];
      case 'shield_pulse':
        return [
          {
            label: 'Pulse Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Shield Capacity',
            currentText: pct(curr.speedMultiplier),
            nextText: next ? pct(next.speedMultiplier) : null,
          },
        ];
      case 'cluster_bombs':
        return [
          {
            label: 'Bomb & Bomblet Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Submunition Radius',
            currentText: `+${Math.round(curr.bonusAoeRadius)} px`,
            nextText: next ? `+${Math.round(next.bonusAoeRadius)} px` : null,
          },
        ];
      case 'hunter_missiles':
        return [
          {
            label: 'Missile Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Flight Speed',
            currentText: pct(curr.speedMultiplier),
            nextText: next ? pct(next.speedMultiplier) : null,
          },
        ];
      case 'gatling_overdrive':
        return [
          {
            label: 'Volley Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Overdrive Cycle Rate',
            currentText: fireRatePct(curr.cooldownMultiplier),
            nextText: next ? fireRatePct(next.cooldownMultiplier) : null,
          },
        ];
      case 'laser_array':
        return [
          {
            label: 'Beam Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Beam Reach',
            currentText: `+${Math.round(curr.bonusRange)} px`,
            nextText: next ? `+${Math.round(next.bonusRange)} px` : null,
          },
        ];
      case 'plasma_cannon':
        return [
          {
            label: 'Plasma & Vortex Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Vortex Radius',
            currentText: `+${curr.bonusAoeRadius.toFixed(1)} px`,
            nextText: next ? `+${next.bonusAoeRadius.toFixed(1)} px` : null,
          },
        ];
      case 'sentry_turret':
        return [
          {
            label: 'Turret Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Targeting Range',
            currentText: `+${Math.round(curr.bonusRange)} px`,
            nextText: next ? `+${Math.round(next.bonusRange)} px` : null,
          },
        ];
      case 'drone_squadron':
        return [
          {
            label: 'Drone Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Drone Fire Rate',
            currentText: fireRatePct(curr.cooldownMultiplier),
            nextText: next ? fireRatePct(next.cooldownMultiplier) : null,
          },
        ];
      case 'orbital_strike':
        return [
          {
            label: 'Orbital Blast Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Strike Radius',
            currentText: `+${Math.round(curr.bonusAoeRadius)} px`,
            nextText: next ? `+${Math.round(next.bonusAoeRadius)} px` : null,
          },
        ];
      case 'thunderstorm':
        return [
          {
            label: 'Lightning Damage',
            currentText: pct(curr.damageMultiplier),
            nextText: next ? pct(next.damageMultiplier) : null,
          },
          {
            label: 'Storm Reach',
            currentText: `+${Math.round(curr.bonusRange)} px`,
            nextText: next ? `+${Math.round(next.bonusRange)} px` : null,
          },
        ];
    }
  }

  exportState(): SavedSkillCollectionState {
    const entries: SavedSkillCollectionEntry[] = [];
    for (let i = 0; i < ALL_SKILL_IDS.length; i++) {
      const rec = this.records.get(ALL_SKILL_IDS[i]);
      if (!rec) continue;
      entries.push({
        skillId: rec.skillId,
        unlocked: rec.unlocked,
        collectionLevel: rec.collectionLevel,
        fragments: rec.fragments,
      });
    }
    return { entries };
  }

  loadState(saved?: SavedSkillCollectionState): void {
    this.resetToInitial();
    if (!saved || !Array.isArray(saved.entries)) {
      return;
    }

    for (let i = 0; i < saved.entries.length; i++) {
      const raw = saved.entries[i];
      if (!raw || !VALID_SKILL_ID_SET.has(raw.skillId)) continue;

      const initiallyUnlocked = INITIAL_UNLOCK_SET.has(raw.skillId);
      const unlocked = initiallyUnlocked || Boolean(raw.unlocked);
      const cleanLevel = unlocked
        ? typeof raw.collectionLevel === 'number' &&
          Number.isFinite(raw.collectionLevel)
          ? Math.max(
              1,
              Math.min(
                SKILL_COLLECTION_CONFIG.maxLevel,
                Math.floor(raw.collectionLevel)
              )
            )
          : 1
        : 0;
      const cleanFragments =
        typeof raw.fragments === 'number' && Number.isFinite(raw.fragments)
          ? Math.max(0, Math.floor(raw.fragments))
          : 0;

      this.records.set(raw.skillId, {
        skillId: raw.skillId,
        unlocked,
        collectionLevel: cleanLevel,
        fragments: cleanFragments,
      });
    }
  }
}
