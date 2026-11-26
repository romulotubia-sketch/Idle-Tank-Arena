import {
  BOSS_CONFIG,
  ECONOMY_CONFIG,
  SPAWN_CONFIG,
  WAVE_CONFIG,
} from '../constants';
import {
  ArenaBounds,
  EnemyDefinition,
  EnemyInstance,
  EnemyKind,
  Vector2,
} from '../types';
import { WavePlan } from './WaveSystem';

export interface EnemyAttackEvent {
  enemyX: number;
  enemyY: number;
  damage: number;
  isBoss?: boolean;
}

export interface BossSiegeStrikeEvent {
  bossX: number;
  bossY: number;
  targetX: number;
  targetY: number;
  radius: number;
  damage: number;
}

export interface EnemyDestroyedEvent {
  x: number;
  y: number;
  kind: EnemyKind;
  isBoss: boolean;
  rewardGold: number;
}

export interface EnemyUpdateCallbacks {
  onAttackPlayer: (event: EnemyAttackEvent) => void;
  onBossSiegeStrike: (event: BossSiegeStrikeEvent) => void;
  onEnemySpawned: () => void;
  onEnemyDestroyed: (event: EnemyDestroyedEvent) => void;
}

const DEFAULT_ENEMY_DEFINITIONS: EnemyDefinition[] = [
  {
    id: 'scout_buggy',
    name: 'Recon Raider',
    baseHp: 48,
    speed: 62,
    attackDamage: 8,
    attackIntervalSec: 1.15,
    attackRange: 108,
    radius: 14,
    rewardGold: ECONOMY_CONFIG.normalEnemyBaseCoins,
  },
  {
    id: 'heavy_crawler',
    name: 'Assault Crawler',
    baseHp: 96,
    speed: 38,
    attackDamage: 14,
    attackIntervalSec: 1.55,
    attackRange: 128,
    radius: 18,
    rewardGold: ECONOMY_CONFIG.normalEnemyBaseCoins,
  },
  {
    id: BOSS_CONFIG.kind,
    name: BOSS_CONFIG.name,
    baseHp: BOSS_CONFIG.baseHp,
    speed: BOSS_CONFIG.speed,
    attackDamage: BOSS_CONFIG.attackDamage,
    attackIntervalSec: BOSS_CONFIG.attackIntervalSec,
    attackRange: BOSS_CONFIG.attackRange,
    radius: BOSS_CONFIG.radius,
    rewardGold: BOSS_CONFIG.rewardGold,
  },
];

export class EnemySystem {
  private readonly definitions = new Map<EnemyKind, EnemyDefinition>();
  private readonly activeEnemies: EnemyInstance[] = [];
  private nextUid = 1;
  private spawnTimer: number = SPAWN_CONFIG.initialDelaySec;
  private spawnCounter = 0;

  constructor() {
    for (let i = 0; i < DEFAULT_ENEMY_DEFINITIONS.length; i++) {
      this.registerDefinition(DEFAULT_ENEMY_DEFINITIONS[i]);
    }
  }

  registerDefinition(def: EnemyDefinition): void {
    this.definitions.set(def.id, def);
  }

  getDefinition(kind: EnemyKind): EnemyDefinition | undefined {
    return this.definitions.get(kind);
  }

  getActiveEnemies(): readonly EnemyInstance[] {
    return this.activeEnemies;
  }

  getActiveBoss(): EnemyInstance | null {
    for (let i = 0; i < this.activeEnemies.length; i++) {
      const e = this.activeEnemies[i];
      if (e.isBoss && !e.isDying && e.hp > 0) {
        return e;
      }
    }
    return null;
  }

  countAliveEnemies(): number {
    let alive = 0;
    for (let i = 0; i < this.activeEnemies.length; i++) {
      if (!this.activeEnemies[i].isDying && this.activeEnemies[i].hp > 0) {
        alive++;
      }
    }
    return alive;
  }

  resetSpawnTimer(delaySec: number = SPAWN_CONFIG.initialDelaySec): void {
    this.spawnTimer = delaySec;
    this.spawnCounter = 0;
  }

  clear(): void {
    this.activeEnemies.length = 0;
    this.spawnTimer = SPAWN_CONFIG.initialDelaySec;
    this.spawnCounter = 0;
  }

  applyDamage(
    enemy: EnemyInstance,
    damage: number,
    onDestroyed?: (event: EnemyDestroyedEvent) => void
  ): boolean {
    if (enemy.isDying || enemy.hp <= 0) return false;

    const cleanDamage = Math.max(1, Math.round(damage));
    enemy.hp = Math.max(0, enemy.hp - cleanDamage);
    enemy.hitFlashTimer = 0.12;

    if (enemy.hp <= 0) {
      enemy.isDying = true;
      enemy.deathDuration = enemy.isBoss ? 0.55 : 0.34;
      enemy.deathTimer = enemy.deathDuration;
      // Immediately cancel any active boss telegraph so boss cannot attack after defeat
      enemy.telegraphTimer = 0;

      if (!enemy.rewardClaimed) {
        enemy.rewardClaimed = true;
        if (onDestroyed) {
          onDestroyed({
            x: enemy.position.x,
            y: enemy.position.y,
            kind: enemy.definitionId,
            isBoss: enemy.isBoss,
            rewardGold: enemy.rewardGold,
          });
        }
      }
      return true;
    }

    return false;
  }

  update(
    dt: number,
    bounds: ArenaBounds,
    playerPos: Vector2,
    isActive: boolean,
    wavePlan: WavePlan,
    canSpawnFromWave: boolean,
    callbacks: EnemyUpdateCallbacks
  ): void {
    if (!isActive) return;

    // 1. Wave-paced spawning (capped by active-enemy limit for mobile performance)
    if (canSpawnFromWave) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (this.countAliveEnemies() < SPAWN_CONFIG.maxActiveEnemies) {
          const spawned = this.spawnWaveEnemy(bounds, playerPos, wavePlan);
          if (spawned) {
            callbacks.onEnemySpawned();
          }
          this.spawnTimer = wavePlan.spawnIntervalSec;
        } else {
          // Hold timer ready so spawning resumes immediately when an enemy is defeated
          this.spawnTimer = 0;
        }
      }
    }

    // 2. Update active enemies & compact defeated entries in-place
    let writeIndex = 0;
    const count = this.activeEnemies.length;

    for (let i = 0; i < count; i++) {
      const enemy = this.activeEnemies[i];

      if (enemy.hitFlashTimer > 0) {
        enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
      }

      if (enemy.isDying) {
        enemy.deathTimer -= dt;
        if (enemy.deathTimer > 0) {
          this.activeEnemies[writeIndex++] = enemy;
        }
        continue;
      }

      const dx = playerPos.x - enemy.position.x;
      const dy = playerPos.y - enemy.position.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq) || 1;

      enemy.angle = Math.atan2(dy, dx);

      // Handle Boss telegraphed Siege Strike behavior
      if (enemy.isBoss) {
        if (enemy.telegraphTimer && enemy.telegraphTimer > 0) {
          enemy.telegraphTimer -= dt;
          if (enemy.telegraphTimer <= 0) {
            enemy.telegraphTimer = 0;
            if (
              enemy.telegraphX !== undefined &&
              enemy.telegraphY !== undefined &&
              enemy.telegraphRadius !== undefined
            ) {
              callbacks.onBossSiegeStrike({
                bossX: enemy.position.x,
                bossY: enemy.position.y,
                targetX: enemy.telegraphX,
                targetY: enemy.telegraphY,
                radius: enemy.telegraphRadius,
                damage: Math.round(
                  enemy.attackDamage * BOSS_CONFIG.specialDamageMultiplier
                ),
              });
            }
          }
          this.activeEnemies[writeIndex++] = enemy;
          continue;
        }

        if (enemy.specialCooldown !== undefined) {
          enemy.specialCooldown -= dt;
          if (
            enemy.specialCooldown <= 0 &&
            dist <= BOSS_CONFIG.specialTriggerRange
          ) {
            enemy.specialCooldown = BOSS_CONFIG.specialIntervalSec;
            enemy.telegraphDuration = BOSS_CONFIG.specialTelegraphSec;
            enemy.telegraphTimer = BOSS_CONFIG.specialTelegraphSec;
            enemy.telegraphX = playerPos.x;
            enemy.telegraphY = playerPos.y;
            enemy.telegraphRadius = BOSS_CONFIG.specialRadius;
            this.activeEnemies[writeIndex++] = enemy;
            continue;
          }
        }
      }

      if (dist > enemy.attackRange) {
        // Move toward player tank
        const step = enemy.speed * dt;
        enemy.position.x += (dx / dist) * step;
        enemy.position.y += (dy / dist) * step;
      } else {
        // Inside attack range: hold position and attack on interval
        enemy.attackCooldown -= dt;
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = enemy.attackIntervalSec;
          callbacks.onAttackPlayer({
            enemyX: enemy.position.x + (dx / dist) * enemy.radius,
            enemyY: enemy.position.y + (dy / dist) * enemy.radius,
            damage: enemy.attackDamage,
            isBoss: enemy.isBoss,
          });
        }
      }

      // Lightweight pairwise separation so enemies do not stack on the exact same pixel
      for (let j = i + 1; j < count; j++) {
        const other = this.activeEnemies[j];
        if (other.isDying) continue;
        const ox = enemy.position.x - other.position.x;
        const oy = enemy.position.y - other.position.y;
        const minSep = enemy.radius + other.radius + 4;
        const oDistSq = ox * ox + oy * oy;
        if (oDistSq > 0.001 && oDistSq < minSep * minSep) {
          const oDist = Math.sqrt(oDistSq);
          const push = (minSep - oDist) * 0.25;
          const nx = ox / oDist;
          const ny = oy / oDist;
          enemy.position.x += nx * push;
          enemy.position.y += ny * push;
          other.position.x -= nx * push;
          other.position.y -= ny * push;
        }
      }

      this.activeEnemies[writeIndex++] = enemy;
    }

    this.activeEnemies.length = writeIndex;
  }

  private spawnWaveEnemy(
    bounds: ArenaBounds,
    playerPos: Vector2,
    wavePlan: WavePlan
  ): boolean {
    this.spawnCounter++;

    let kind: EnemyKind;
    if (wavePlan.isBossWave) {
      kind = BOSS_CONFIG.kind;
    } else {
      const heavyFreq = wavePlan.wave >= 6 ? 2 : 3;
      kind = this.spawnCounter % heavyFreq === 0 ? 'heavy_crawler' : 'scout_buggy';
    }

    const def = this.definitions.get(kind);
    if (!def) return false;

    const pad = SPAWN_CONFIG.boundaryPadding + (def.id === BOSS_CONFIG.kind ? 16 : 0);
    let sx: number = pad;
    let sy: number = pad;
    let bestDist = -1;

    // Sample perimeter edges and pick a spawn point far from the player tank
    for (let attempt = 0; attempt < 10; attempt++) {
      const edge = Math.floor(Math.random() * 4);
      let cx = pad;
      let cy = pad;
      if (edge === 0) {
        cx = pad + Math.random() * (bounds.width - pad * 2);
        cy = pad;
      } else if (edge === 1) {
        cx = bounds.width - pad;
        cy = pad + Math.random() * (bounds.height - pad * 2);
      } else if (edge === 2) {
        cx = pad + Math.random() * (bounds.width - pad * 2);
        cy = bounds.height - pad;
      } else {
        cx = pad;
        cy = pad + Math.random() * (bounds.height - pad * 2);
      }

      const distToPlayer = Math.hypot(cx - playerPos.x, cy - playerPos.y);
      if (distToPlayer > bestDist) {
        bestDist = distToPlayer;
        sx = cx;
        sy = cy;
      }
      if (distToPlayer >= SPAWN_CONFIG.minDistanceFromTank) {
        break;
      }
    }

    const angleToPlayer = Math.atan2(playerPos.y - sy, playerPos.x - sx);
    const isBoss = kind === BOSS_CONFIG.kind;

    let scaledHp: number;
    let scaledSpeed: number;
    if (isBoss) {
      const bossTier = Math.max(
        1,
        Math.floor(wavePlan.wave / WAVE_CONFIG.bossWaveInterval)
      );
      const tierScale = 1 + (bossTier - 1) * BOSS_CONFIG.hpScalePerBossTier;
      scaledHp = Math.round(
        def.baseHp * tierScale * (1 + Math.max(0, wavePlan.wave - 10) * 0.03)
      );
      scaledSpeed = Math.min(
        BOSS_CONFIG.maxSpeed,
        Math.round(def.speed * wavePlan.speedMultiplier)
      );
    } else {
      scaledHp = Math.round(def.baseHp * wavePlan.hpMultiplier);
      scaledSpeed = Math.round(def.speed * wavePlan.speedMultiplier);
    }

    const scaledDamage = Math.round(def.attackDamage * wavePlan.damageMultiplier);
    const scaledReward = isBoss
      ? wavePlan.bossReward
      : wavePlan.normalEnemyReward;

    this.activeEnemies.push({
      uid: this.nextUid++,
      definitionId: def.id,
      isBoss,
      position: { x: sx, y: sy },
      angle: angleToPlayer,
      hp: scaledHp,
      maxHp: scaledHp,
      speed: scaledSpeed,
      attackDamage: scaledDamage,
      attackIntervalSec: def.attackIntervalSec,
      attackRange: def.attackRange,
      attackCooldown: isBoss ? 0.9 : 0.35,
      radius: def.radius,
      rewardGold: scaledReward,
      rewardClaimed: false,
      hitFlashTimer: 0,
      isDying: false,
      deathTimer: 0,
      deathDuration: isBoss ? 0.55 : 0.34,
      ...(isBoss
        ? {
            specialCooldown: 2.5,
            telegraphTimer: 0,
          }
        : {}),
    });

    return true;
  }
}
