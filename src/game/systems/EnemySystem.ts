import { GAME_BALANCE } from '../balanceConfig';
import {
  BOSS_CONFIG,
  ECONOMY_CONFIG,
  SPAWN_CONFIG,
  WAVE_CONFIG,
} from '../constants';
import {
  ArenaBounds,
  EnemyBehaviorType,
  EnemyDefinition,
  EnemyInstance,
  EnemyKind,
  Vector2,
} from '../types';
import { WavePlan } from './WaveSystem';

export interface EnemyAttackEvent {
  enemyX: number;
  enemyY: number;
  angle: number;
  damage: number;
  kind: EnemyKind;
  behavior: EnemyBehaviorType;
  isBoss?: boolean;
  attackMode?: 'standard' | 'boss_heavy' | 'boss_burst';
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
  onBossSpawned?: (boss: EnemyInstance) => void;
}

const ARCHETYPE_KEYS = [
  'scout',
  'assault_tank',
  'heavy_tank',
  'runner',
  'artillery',
] as const;

const DEFAULT_ENEMY_DEFINITIONS: EnemyDefinition[] = [
  ...ARCHETYPE_KEYS.map((key) => {
    const spec = GAME_BALANCE.enemyDefinitions[key];
    return {
      ...spec,
      rewardGold: Math.max(
        1,
        Math.round(ECONOMY_CONFIG.normalEnemyBaseCoins * spec.rewardMultiplier)
      ),
    };
  }),
  {
    id: BOSS_CONFIG.kind,
    name: BOSS_CONFIG.name,
    behavior: BOSS_CONFIG.behavior,
    baseHp: BOSS_CONFIG.baseHp,
    speed: BOSS_CONFIG.speed,
    maxSpeed: BOSS_CONFIG.maxSpeed,
    attackDamage: BOSS_CONFIG.attackDamage,
    attackIntervalSec: BOSS_CONFIG.attackIntervalSec,
    attackRange: BOSS_CONFIG.attackRange,
    preferredMinRange: BOSS_CONFIG.preferredMinRange,
    radius: BOSS_CONFIG.radius,
    rewardMultiplier: BOSS_CONFIG.rewardMultiplier,
    rewardGold: BOSS_CONFIG.rewardGold,
    unlockWave: BOSS_CONFIG.unlockWave,
  },
];

export class EnemySystem {
  private readonly definitions = new Map<EnemyKind, EnemyDefinition>();
  private readonly activeEnemies: EnemyInstance[] = [];
  private nextUid = 1;
  private spawnTimer: number = SPAWN_CONFIG.initialDelaySec;

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

  getAllDefinitions(): readonly EnemyDefinition[] {
    return Array.from(this.definitions.values());
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
  }

  clear(): void {
    this.activeEnemies.length = 0;
    this.spawnTimer = SPAWN_CONFIG.initialDelaySec;
  }

  selectEnemyKindForWave(waveNumber: number, rngValue: number = Math.random()): EnemyKind {
    const profiles = SPAWN_CONFIG.spawnProfiles;
    let selected: (typeof SPAWN_CONFIG.spawnProfiles)[number] = profiles[0];
    for (let i = 0; i < profiles.length; i++) {
      if (waveNumber >= profiles[i].minWave) {
        selected = profiles[i];
      }
    }

    const weights = selected.weights;
    let totalWeight = 0;
    for (let i = 0; i < ARCHETYPE_KEYS.length; i++) {
      totalWeight += weights[ARCHETYPE_KEYS[i]] ?? 0;
    }

    if (totalWeight <= 0) return 'assault_tank';

    let roll = Math.max(0, Math.min(0.999999, rngValue)) * totalWeight;
    for (let i = 0; i < ARCHETYPE_KEYS.length; i++) {
      const key = ARCHETYPE_KEYS[i];
      const w = weights[key] ?? 0;
      if (w <= 0) continue;
      if (roll < w) return key;
      roll -= w;
    }

    return 'assault_tank';
  }

  applyDamage(
    enemy: EnemyInstance,
    damage: number,
    onDestroyed?: (event: EnemyDestroyedEvent) => void,
    hitDirX = 0,
    hitDirY = 0
  ): boolean {
    if (enemy.isDying || enemy.hp <= 0) return false;

    const cleanDamage = Math.max(1, Math.round(damage));
    enemy.hp = Math.max(0, enemy.hp - cleanDamage);
    enemy.hitFlashTimer = 0.085;
    enemy.hitReactionTimer = 0.095;
    const kickScale = enemy.isBoss ? 1.1 : enemy.behavior === 'juggernaut' ? 1.5 : 2.6;
    if (hitDirX !== 0 || hitDirY !== 0) {
      enemy.hitReactionX = hitDirX * kickScale;
      enemy.hitReactionY = hitDirY * kickScale;
    } else {
      enemy.hitReactionX = -Math.cos(enemy.angle) * (kickScale * 0.75);
      enemy.hitReactionY = -Math.sin(enemy.angle) * (kickScale * 0.75);
    }

    if (enemy.hp <= 0) {
      enemy.isDying = true;
      enemy.deathDuration = enemy.isBoss ? 0.58 : 0.34;
      enemy.deathTimer = enemy.deathDuration;
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

  applySlow(enemy: EnemyInstance, slowFactor: number, durationSec: number): void {
    if (enemy.isDying || enemy.hp <= 0) return;
    const clampedFactor = Math.max(0, Math.min(0.75, slowFactor));
    enemy.slowFactor = Math.max(enemy.slowFactor ?? 0, clampedFactor);
    enemy.slowTimer = Math.max(enemy.slowTimer ?? 0, durationSec);
  }

  applyAcid(enemy: EnemyInstance, acidDps: number, durationSec: number): void {
    if (enemy.isDying || enemy.hp <= 0) return;
    enemy.acidDps = Math.max(enemy.acidDps ?? 0, Math.max(1, acidDps));
    enemy.acidTimer = Math.max(enemy.acidTimer ?? 0, durationSec);
    if (enemy.acidTickTimer === undefined || enemy.acidTickTimer <= 0) {
      enemy.acidTickTimer = 0.45;
    }
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
          const spawned = this.spawnWaveEnemy(bounds, playerPos, wavePlan, callbacks);
          if (spawned) {
            callbacks.onEnemySpawned();
          }
          this.spawnTimer = wavePlan.spawnIntervalSec;
        } else {
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
      if (enemy.hitReactionTimer > 0) {
        enemy.hitReactionTimer = Math.max(0, enemy.hitReactionTimer - dt);
        const decay = Math.exp(-24 * dt);
        enemy.hitReactionX *= decay;
        enemy.hitReactionY *= decay;
      } else if (enemy.hitReactionX !== 0 || enemy.hitReactionY !== 0) {
        enemy.hitReactionX = 0;
        enemy.hitReactionY = 0;
      }

      if (enemy.isDying) {
        enemy.deathTimer -= dt;
        if (enemy.deathTimer > 0) {
          this.activeEnemies[writeIndex++] = enemy;
        }
        continue;
      }

      if (enemy.slowTimer && enemy.slowTimer > 0) {
        enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
        if (enemy.slowTimer <= 0) {
          enemy.slowFactor = 0;
        }
      }

      const dx = playerPos.x - enemy.position.x;
      const dy = playerPos.y - enemy.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      const dirX = dx / dist;
      const dirY = dy / dist;

      enemy.angle = Math.atan2(dy, dx);

      // Handle Boss encounter intro + multi-pattern attacks (Siege Strike, Burst Salvo, Heavy Shell)
      if (enemy.isBoss) {
        if (enemy.introTimer && enemy.introTimer > 0) {
          enemy.introTimer = Math.max(0, enemy.introTimer - dt);
          enemy.position.x += dirX * enemy.speed * 0.45 * dt;
          enemy.position.y += dirY * enemy.speed * 0.45 * dt;
          this.clampEnemyToArena(enemy, bounds);
          this.activeEnemies[writeIndex++] = enemy;
          continue;
        }

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

        if (enemy.burstChargeTimer && enemy.burstChargeTimer > 0) {
          enemy.burstChargeTimer -= dt;
          if (enemy.burstChargeTimer <= 0) {
            enemy.burstChargeTimer = 0;
            enemy.burstShotsRemaining = BOSS_CONFIG.burstShotCount;
            enemy.burstShotTimer = 0;
          }
          this.activeEnemies[writeIndex++] = enemy;
          continue;
        }

        if (enemy.burstShotsRemaining && enemy.burstShotsRemaining > 0) {
          enemy.burstShotTimer = (enemy.burstShotTimer ?? 0) - dt;
          if (enemy.burstShotTimer <= 0) {
            const shotIdx = BOSS_CONFIG.burstShotCount - enemy.burstShotsRemaining;
            const spreadOffset =
              (shotIdx - Math.floor(BOSS_CONFIG.burstShotCount / 2)) *
              BOSS_CONFIG.burstSpreadRad;
            const shotAngle = enemy.angle + spreadOffset;
            const muzzleDist = enemy.radius + 24;
            callbacks.onAttackPlayer({
              enemyX: enemy.position.x + Math.cos(shotAngle) * muzzleDist,
              enemyY: enemy.position.y + Math.sin(shotAngle) * muzzleDist,
              angle: shotAngle,
              damage: Math.max(
                1,
                Math.round(enemy.attackDamage * BOSS_CONFIG.burstDamageMultiplier)
              ),
              kind: enemy.definitionId,
              behavior: enemy.behavior,
              isBoss: true,
              attackMode: 'boss_burst',
            });
            enemy.burstShotsRemaining -= 1;
            enemy.burstShotTimer = BOSS_CONFIG.burstShotIntervalSec;
          }
          this.activeEnemies[writeIndex++] = enemy;
          continue;
        }

        if (enemy.specialCooldown !== undefined) {
          enemy.specialCooldown -= dt;
        }
        if (enemy.burstCooldown !== undefined) {
          enemy.burstCooldown -= dt;
        }

        if (
          enemy.specialCooldown !== undefined &&
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

        if (
          enemy.burstCooldown !== undefined &&
          enemy.burstCooldown <= 0 &&
          dist <= enemy.attackRange + 35
        ) {
          enemy.burstCooldown = BOSS_CONFIG.burstCooldownSec;
          enemy.burstChargeTimer = BOSS_CONFIG.burstChargeSec;
          this.activeEnemies[writeIndex++] = enemy;
          continue;
        }
      }

      // Modular archetype movement & attack logic
      this.stepArchetypeBehavior(dt, enemy, dist, dirX, dirY, bounds, callbacks);

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
          const push = (minSep - oDist) * 0.22;
          const nx = ox / oDist;
          const ny = oy / oDist;
          enemy.position.x += nx * push;
          enemy.position.y += ny * push;
          other.position.x -= nx * push;
          other.position.y -= ny * push;
        }
      }

      this.clampEnemyToArena(enemy, bounds);
      this.activeEnemies[writeIndex++] = enemy;
    }

    this.activeEnemies.length = writeIndex;
  }

  private stepArchetypeBehavior(
    dt: number,
    enemy: EnemyInstance,
    dist: number,
    dirX: number,
    dirY: number,
    bounds: ArenaBounds,
    callbacks: EnemyUpdateCallbacks
  ): void {
    const slowMult =
      enemy.slowTimer && enemy.slowTimer > 0
        ? Math.max(0.25, 1 - (enemy.slowFactor ?? 0))
        : 1;
    const step = enemy.speed * slowMult * dt;

    if (enemy.behavior === 'artillery_ranged') {
      const minComfort = enemy.preferredMinRange;
      const enterHoldDist = enemy.attackRange - 12;
      const exitHoldDist = enemy.attackRange + 14;

      if (dist < minComfort - 10) {
        // Player closed inside preferred range: smoothly back away without getting corner-stuck
        enemy.inAttackHold = false;
        const pad = bounds.safeMargin + enemy.radius + 8;
        let rx = -dirX;
        let ry = -dirY;
        const nearLeftRight =
          (enemy.position.x <= pad && rx < 0) ||
          (enemy.position.x >= bounds.width - pad && rx > 0);
        const nearTopBottom =
          (enemy.position.y <= pad && ry < 0) ||
          (enemy.position.y >= bounds.height - pad && ry > 0);

        if (nearLeftRight) {
          rx = 0;
          ry = enemy.position.y < bounds.height * 0.5 ? 1 : -1;
        } else if (nearTopBottom) {
          ry = 0;
          rx = enemy.position.x < bounds.width * 0.5 ? 1 : -1;
        }

        const rMag = Math.hypot(rx, ry) || 1;
        enemy.position.x += (rx / rMag) * step;
        enemy.position.y += (ry / rMag) * step;
      } else if (dist > (enemy.inAttackHold ? exitHoldDist : enterHoldDist)) {
        enemy.inAttackHold = false;
        enemy.position.x += dirX * step;
        enemy.position.y += dirY * step;
      } else {
        enemy.inAttackHold = true;
      }

      // Artillery fires when within attackRange and not actively scrambling away inside deadzone
      if (dist <= enemy.attackRange + 8 && dist >= minComfort * 0.72) {
        enemy.attackCooldown -= dt;
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = enemy.attackIntervalSec;
          const barrelTip = enemy.radius + 26;
          callbacks.onAttackPlayer({
            enemyX: enemy.position.x + dirX * barrelTip,
            enemyY: enemy.position.y + dirY * barrelTip,
            angle: enemy.angle,
            damage: enemy.attackDamage,
            kind: enemy.definitionId,
            behavior: enemy.behavior,
            isBoss: false,
          });
        }
      }
      return;
    }

    // Standard, Skirmisher, Juggernaut, Rusher, and Boss approach & hold with range hysteresis
    const enterRange = enemy.attackRange;
    const exitRange = enemy.attackRange + 8;

    if (dist > (enemy.inAttackHold ? exitRange : enterRange)) {
      enemy.inAttackHold = false;
      enemy.position.x += dirX * step;
      enemy.position.y += dirY * step;
    } else {
      enemy.inAttackHold = true;
      enemy.attackCooldown -= dt;
      if (enemy.attackCooldown <= 0) {
        enemy.attackCooldown = enemy.attackIntervalSec;
        const muzzleOffset = enemy.isBoss ? enemy.radius + 24 : enemy.radius + 4;
        callbacks.onAttackPlayer({
          enemyX: enemy.position.x + dirX * muzzleOffset,
          enemyY: enemy.position.y + dirY * muzzleOffset,
          angle: enemy.angle,
          damage: enemy.attackDamage,
          kind: enemy.definitionId,
          behavior: enemy.behavior,
          isBoss: enemy.isBoss,
          attackMode: enemy.isBoss ? 'boss_heavy' : 'standard',
        });
      }
    }
  }

  private clampEnemyToArena(enemy: EnemyInstance, bounds: ArenaBounds): void {
    const pad = Math.max(12, SPAWN_CONFIG.boundaryPadding * 0.8 + enemy.radius * 0.4);
    if (enemy.position.x < pad) enemy.position.x = pad;
    else if (enemy.position.x > bounds.width - pad) {
      enemy.position.x = bounds.width - pad;
    }
    if (enemy.position.y < pad) enemy.position.y = pad;
    else if (enemy.position.y > bounds.height - pad) {
      enemy.position.y = bounds.height - pad;
    }
  }

  spawnEnemyAt(
    kind: EnemyKind,
    x: number,
    y: number,
    playerPos: Vector2,
    wavePlan: WavePlan
  ): EnemyInstance | null {
    const def = this.definitions.get(kind);
    if (!def) return null;

    const angleToPlayer = Math.atan2(playerPos.y - y, playerPos.x - x);
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
        def.baseHp *
          tierScale *
          (1 +
            Math.max(0, wavePlan.wave - WAVE_CONFIG.bossWaveInterval) *
              BOSS_CONFIG.hpWaveLinearFactor)
      );
      scaledSpeed = Math.min(
        def.maxSpeed,
        Math.round(def.speed * wavePlan.speedMultiplier)
      );
    } else {
      scaledHp = Math.round(def.baseHp * wavePlan.hpMultiplier);
      scaledSpeed = Math.min(
        def.maxSpeed,
        Math.round(def.speed * wavePlan.speedMultiplier)
      );
    }

    const scaledDamage = Math.max(
      1,
      Math.round(def.attackDamage * wavePlan.damageMultiplier)
    );
    const scaledReward = isBoss
      ? wavePlan.bossReward
      : Math.max(1, Math.round(wavePlan.normalEnemyReward * def.rewardMultiplier));

    const instance: EnemyInstance = {
      uid: this.nextUid++,
      definitionId: def.id,
      behavior: def.behavior,
      isBoss,
      position: { x, y },
      angle: angleToPlayer,
      hp: scaledHp,
      maxHp: scaledHp,
      speed: scaledSpeed,
      attackDamage: scaledDamage,
      attackIntervalSec: def.attackIntervalSec,
      attackRange: def.attackRange,
      preferredMinRange: def.preferredMinRange ?? 0,
      attackCooldown: isBoss
        ? 0.9
        : def.behavior === 'artillery_ranged'
          ? 1.15
          : def.behavior === 'rusher'
            ? 0.15
            : 0.35,
      radius: def.radius,
      rewardGold: scaledReward,
      rewardClaimed: false,
      hitFlashTimer: 0,
      hitReactionTimer: 0,
      hitReactionX: 0,
      hitReactionY: 0,
      isDying: false,
      deathTimer: 0,
      deathDuration: isBoss ? 0.65 : 0.34,
      inAttackHold: false,
      ...(isBoss
        ? {
            introTimer: BOSS_CONFIG.introDurationSec,
            introDuration: BOSS_CONFIG.introDurationSec,
            burstCooldown: 3.4,
            burstChargeTimer: 0,
            burstShotsRemaining: 0,
            burstShotTimer: 0,
            specialCooldown: 2.2,
            telegraphTimer: 0,
          }
        : {}),
    };

    this.activeEnemies.push(instance);
    return instance;
  }

  private spawnWaveEnemy(
    bounds: ArenaBounds,
    playerPos: Vector2,
    wavePlan: WavePlan,
    callbacks?: EnemyUpdateCallbacks
  ): boolean {
    const kind: EnemyKind = wavePlan.isBossWave
      ? BOSS_CONFIG.kind
      : this.selectEnemyKindForWave(wavePlan.wave);

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

    const spawned = this.spawnEnemyAt(kind, sx, sy, playerPos, wavePlan);
    if (spawned && spawned.isBoss) {
      callbacks?.onBossSpawned?.(spawned);
    }
    return spawned !== null;
  }
}
