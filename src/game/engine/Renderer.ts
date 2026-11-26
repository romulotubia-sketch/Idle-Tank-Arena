import { ARENA_BOUNDS } from '../constants';
import {
  ArenaBounds,
  EnemyInstance,
  LandmineInstance,
  PlayerTankState,
  ProjectileInstance,
  VisualEffect,
} from '../types';
import { Camera } from './Camera';

export interface RenderSceneInput {
  bounds: ArenaBounds;
  tank: PlayerTankState;
  enemies: readonly EnemyInstance[];
  projectiles: readonly ProjectileInstance[];
  mines: readonly LandmineInstance[];
  effects: readonly VisualEffect[];
  showRangeRing: boolean;
  isActive: boolean;
  reducedMotion: boolean;
}

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const TERRAIN_EXTENT_X = 1960;
const TERRAIN_EXTENT_Y = 1220;

export class Renderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private camera: Camera;
  private terrainCache: HTMLCanvasElement | null = null;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private dpr = 1;

  constructor(bounds: ArenaBounds = ARENA_BOUNDS) {
    this.camera = new Camera(bounds);
  }

  getCamera(): Camera {
    return this.camera;
  }

  attach(canvas: HTMLCanvasElement): void {
    const context = canvas.getContext('2d', { alpha: false });
    this.ctx = context;
    if (!this.terrainCache) {
      this.buildTerrainCache(ARENA_BOUNDS);
    }
    this.resize(canvas);
  }

  detach(): void {
    this.ctx = null;
  }

  resize(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    this.viewportWidth = width;
    this.viewportHeight = height;
    this.dpr = dpr;
    this.camera.updateViewport(width, height);

    const targetW = Math.floor(width * dpr);
    const targetH = Math.floor(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
  }

  render(scene: RenderSceneInput): void {
    const ctx = this.ctx;
    if (!ctx || this.viewportWidth === 0 || this.viewportHeight === 0) return;

    const { bounds, tank, enemies, projectiles, mines, effects, showRangeRing } =
      scene;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    ctx.fillStyle = '#202B1E';
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    this.camera.applyTransform(ctx);

    // Layer 1: Pre-baked extended military terrain
    this.drawCachedTerrain(ctx, bounds);

    // Layer 2: Fixed center deployment pad & circular movement boundary
    this.drawDeploymentPad(ctx, tank.movementOrigin.x, tank.movementOrigin.y);
    this.drawMovementBoundary(
      ctx,
      tank.movementOrigin.x,
      tank.movementOrigin.y,
      tank.movementRadius
    );

    if (showRangeRing) {
      this.drawRangeRing(ctx, tank.position.x, tank.position.y, tank.stats.range);
    }

    // Layer 3: Deployed Landmines, Mortar reticles & Boss Siege Telegraphs
    this.drawMines(ctx, mines);
    this.drawMortarReticles(ctx, projectiles);
    this.drawBossTelegraphs(ctx, enemies);

    // Layer 4: Enemies & Player Tank
    this.drawEnemies(ctx, enemies);
    this.drawPlayerTank(ctx, tank);

    // Layer 5: Projectiles & Combat VFX
    this.drawProjectiles(ctx, projectiles);
    this.drawEffects(ctx, effects);

    ctx.restore();
  }

  private drawCachedTerrain(ctx: CanvasRenderingContext2D, bounds: ArenaBounds): void {
    if (!this.terrainCache) return;
    const offsetX = bounds.width * 0.5 - TERRAIN_EXTENT_X * 0.5;
    const offsetY = bounds.height * 0.5 - TERRAIN_EXTENT_Y * 0.5;
    ctx.drawImage(this.terrainCache, offsetX, offsetY);
  }

  private buildTerrainCache(bounds: ArenaBounds): void {
    if (typeof document === 'undefined') return;
    const cache = document.createElement('canvas');
    cache.width = TERRAIN_EXTENT_X;
    cache.height = TERRAIN_EXTENT_Y;
    const ctx = cache.getContext('2d');
    if (!ctx) return;

    const rng = createSeededRng(42077);
    const arenaLeft = (TERRAIN_EXTENT_X - bounds.width) * 0.5;
    const arenaTop = (TERRAIN_EXTENT_Y - bounds.height) * 0.5;
    const centerX = TERRAIN_EXTENT_X * 0.5;
    const centerY = TERRAIN_EXTENT_Y * 0.5;

    const baseGrad = ctx.createRadialGradient(
      centerX,
      centerY,
      80,
      centerX,
      centerY,
      TERRAIN_EXTENT_X * 0.58
    );
    baseGrad.addColorStop(0, '#32432D');
    baseGrad.addColorStop(0.55, '#2A3A27');
    baseGrad.addColorStop(1, '#1E2A1C');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, TERRAIN_EXTENT_X, TERRAIN_EXTENT_Y);

    for (let i = 0; i < 75; i++) {
      const x = rng() * TERRAIN_EXTENT_X;
      const y = rng() * TERRAIN_EXTENT_Y;
      const rx = 50 + rng() * 120;
      const ry = 40 + rng() * 90;
      const rot = rng() * Math.PI;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle =
        i % 2 === 0 ? 'rgba(65, 88, 52, 0.22)' : 'rgba(26, 38, 24, 0.24)';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = 'rgba(84, 71, 52, 0.45)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 540, 66, 0, 0, Math.PI * 2);
    ctx.ellipse(centerX, centerY, 72, 380, 0, 0, Math.PI * 2);
    ctx.fill();

    const dirtGrad = ctx.createRadialGradient(
      centerX,
      centerY,
      40,
      centerX,
      centerY,
      250
    );
    dirtGrad.addColorStop(0, 'rgba(98, 82, 59, 0.68)');
    dirtGrad.addColorStop(0.65, 'rgba(82, 69, 50, 0.42)');
    dirtGrad.addColorStop(1, 'rgba(82, 69, 50, 0)');
    ctx.fillStyle = dirtGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 250, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < 32; i++) {
      const x = rng() * TERRAIN_EXTENT_X;
      const y = rng() * TERRAIN_EXTENT_Y;
      const rx = 22 + rng() * 55;
      const ry = 14 + rng() * 40;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * Math.PI);
      ctx.fillStyle = 'rgba(92, 77, 56, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(42, 35, 26, 0.28)';
    ctx.lineWidth = 5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(arenaLeft - 240, centerY - 16);
    ctx.lineTo(centerX - 110, centerY - 16);
    ctx.moveTo(arenaLeft - 240, centerY + 16);
    ctx.lineTo(centerX - 110, centerY + 16);
    ctx.moveTo(centerX + 110, centerY - 16);
    ctx.lineTo(arenaLeft + bounds.width + 240, centerY - 16);
    ctx.moveTo(centerX + 110, centerY + 16);
    ctx.lineTo(arenaLeft + bounds.width + 240, centerY + 16);
    ctx.stroke();
    ctx.setLineDash([]);

    const grid = bounds.gridSize;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = arenaLeft - grid * 2; gx <= arenaLeft + bounds.width + grid * 2; gx += grid) {
      ctx.moveTo(gx, arenaTop - grid * 2);
      ctx.lineTo(gx, arenaTop + bounds.height + grid * 2);
    }
    for (let gy = arenaTop - grid * 2; gy <= arenaTop + bounds.height + grid * 2; gy += grid) {
      ctx.moveTo(arenaLeft - grid * 2, gy);
      ctx.lineTo(arenaLeft + bounds.width + grid * 2, gy);
    }
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.24)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      arenaLeft + bounds.safeMargin,
      arenaTop + bounds.safeMargin,
      bounds.width - bounds.safeMargin * 2,
      bounds.height - bounds.safeMargin * 2
    );
    ctx.restore();

    const bLeft = arenaLeft + bounds.safeMargin;
    const bTop = arenaTop + bounds.safeMargin;
    const bRight = arenaLeft + bounds.width - bounds.safeMargin;
    const bBottom = arenaTop + bounds.height - bounds.safeMargin;
    const cArm = 22;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bLeft, bTop + cArm);
    ctx.lineTo(bLeft, bTop);
    ctx.lineTo(bLeft + cArm, bTop);
    ctx.moveTo(bRight - cArm, bTop);
    ctx.lineTo(bRight, bTop);
    ctx.lineTo(bRight, bTop + cArm);
    ctx.moveTo(bRight, bBottom - cArm);
    ctx.lineTo(bRight, bBottom);
    ctx.lineTo(bRight - cArm, bBottom);
    ctx.moveTo(bLeft + cArm, bBottom);
    ctx.lineTo(bLeft, bBottom);
    ctx.lineTo(bLeft, bBottom - cArm);
    ctx.stroke();

    for (let i = 0; i < 12; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 180 + rng() * 480;
      const cx = centerX + Math.cos(angle) * dist;
      const cy = centerY + Math.sin(angle) * dist * 0.68;
      const r = 12 + rng() * 16;

      ctx.fillStyle = 'rgba(30, 26, 20, 0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(116, 102, 78, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = 0; i < 105; i++) {
      const px = rng() * TERRAIN_EXTENT_X;
      const py = rng() * TERRAIN_EXTENT_Y;
      const dCenter = Math.hypot(px - centerX, py - centerY);
      if (dCenter < 95) continue;

      const size = 2 + rng() * 4.5;
      ctx.fillStyle = 'rgba(15, 20, 16, 0.35)';
      ctx.beginPath();
      ctx.ellipse(px + 1.5, py + 1.5, size, size * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = rng() > 0.5 ? '#6B675E' : '#53514B';
      ctx.beginPath();
      ctx.ellipse(px, py, size, size * 0.75, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(104, 138, 82, 0.42)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 130; i++) {
      const gx = rng() * TERRAIN_EXTENT_X;
      const gy = rng() * TERRAIN_EXTENT_Y;
      const dCenter = Math.hypot(gx - centerX, gy - centerY);
      if (dCenter < 145) continue;

      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 3, gy - 5);
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 1, gy - 6);
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 4, gy - 4);
    }
    ctx.stroke();

    const sandbagClusters = [
      { x: bLeft - 24, y: bTop - 24, angle: Math.PI / 4 },
      { x: bRight + 24, y: bTop - 24, angle: -Math.PI / 4 },
      { x: bRight + 24, y: bBottom + 24, angle: Math.PI / 4 },
      { x: bLeft - 24, y: bBottom + 24, angle: -Math.PI / 4 },
    ];
    for (const cluster of sandbagClusters) {
      ctx.save();
      ctx.translate(cluster.x, cluster.y);
      ctx.rotate(cluster.angle);
      for (let b = -1; b <= 1; b++) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.roundRect(b * 16 - 7, -4, 15, 10, 4);
        ctx.fill();

        ctx.fillStyle = '#8B795E';
        ctx.strokeStyle = '#534736';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(b * 16 - 8, -6, 15, 10, 4);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    this.terrainCache = cache;
  }

  private drawDeploymentPad(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = '#31373B';
    ctx.strokeStyle = '#1E2326';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const r = 52;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#272C30';
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  private drawMovementBoundary(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    radius: number
  ): void {
    ctx.save();
    ctx.translate(ox, oy);

    // Subtle tinted safe movement floor
    ctx.fillStyle = 'rgba(56, 189, 248, 0.04)';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Fixed circular boundary ring
    ctx.setLineDash([10, 7]);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.36)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Four cardinal perimeter markers
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.moveTo(Math.cos(a) * (radius - 6), Math.sin(a) * (radius - 6));
      ctx.lineTo(Math.cos(a) * (radius + 6), Math.sin(a) * (radius + 6));
    }
    ctx.stroke();

    ctx.restore();
  }

  private drawRangeRing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawMines(
    ctx: CanvasRenderingContext2D,
    mines: readonly LandmineInstance[]
  ): void {
    for (let i = 0; i < mines.length; i++) {
      const m = mines[i];
      if (!m.active) continue;

      ctx.save();
      ctx.translate(m.x, m.y);

      // Subtle trigger zone ring when armed
      if (m.armTimer <= 0) {
        ctx.strokeStyle = 'rgba(163, 230, 53, 0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, m.triggerRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Octagonal metallic mine casing
      ctx.fillStyle = '#333C36';
      ctx.strokeStyle = '#141916';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let v = 0; v < 8; v++) {
        const a = (v * Math.PI) / 4 + Math.PI / 8;
        const px = Math.cos(a) * 9;
        const py = Math.sin(a) * 9;
        if (v === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pressure plate + armed indicator LED
      ctx.fillStyle = '#4B584E';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = m.armTimer > 0 ? '#F59E0B' : '#A3E635';
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private drawMortarReticles(
    ctx: CanvasRenderingContext2D,
    projectiles: readonly ProjectileInstance[]
  ): void {
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (!p.active || p.kind !== 'mortar_shell') continue;
      if (p.targetX === undefined || p.targetY === undefined) continue;

      const t =
        p.flightDuration && p.flightElapsed !== undefined
          ? Math.min(1, p.flightElapsed / p.flightDuration)
          : 0.5;

      ctx.save();
      ctx.translate(p.targetX, p.targetY);
      ctx.strokeStyle = `rgba(249, 115, 22, ${0.35 + t * 0.45})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, p.aoeRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Contracting inner bullseye
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(4, p.aoeRadius * (1 - t)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBossTelegraphs(
    ctx: CanvasRenderingContext2D,
    enemies: readonly EnemyInstance[]
  ): void {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.isBoss || e.isDying || !e.telegraphTimer || e.telegraphTimer <= 0) {
        continue;
      }
      if (
        e.telegraphX === undefined ||
        e.telegraphY === undefined ||
        e.telegraphRadius === undefined ||
        !e.telegraphDuration
      ) {
        continue;
      }

      const progress = Math.max(
        0,
        Math.min(1, 1 - e.telegraphTimer / e.telegraphDuration)
      );

      // Targeting laser sight from boss to strike zone
      ctx.save();
      ctx.strokeStyle = `rgba(244, 63, 94, ${0.3 + progress * 0.45})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(e.position.x, e.position.y);
      ctx.lineTo(e.telegraphX, e.telegraphY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ground hazard zone
      ctx.translate(e.telegraphX, e.telegraphY);
      ctx.fillStyle = `rgba(225, 29, 72, ${0.12 + progress * 0.2})`;
      ctx.beginPath();
      ctx.arc(0, 0, e.telegraphRadius, 0, Math.PI * 2);
      ctx.fill();

      // Expanding timing ring (matches outer edge right on impact)
      ctx.fillStyle = 'rgba(244, 63, 94, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, e.telegraphRadius * progress, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(251, 113, 133, ${0.55 + progress * 0.4})`;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, e.telegraphRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }
  }

  private drawEnemies(
    ctx: CanvasRenderingContext2D,
    enemies: readonly EnemyInstance[]
  ): void {
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      ctx.save();
      ctx.translate(enemy.position.x, enemy.position.y);

      if (enemy.isDying) {
        const t = Math.max(0, enemy.deathTimer / enemy.deathDuration);
        ctx.globalAlpha = t;
        const shrink = 0.65 + 0.35 * t;
        ctx.scale(shrink, shrink);
      }

      if (enemy.definitionId === 'siege_boss') {
        this.drawSiegeBoss(ctx, enemy);
      } else if (enemy.definitionId === 'heavy_crawler') {
        this.drawHeavyCrawler(ctx, enemy);
      } else {
        this.drawScoutBuggy(ctx, enemy);
      }

      if (!enemy.isDying) {
        this.drawEnemyHealthBar(ctx, enemy);
      }

      ctx.restore();
    }
  }

  private drawScoutBuggy(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
    ctx.save();
    ctx.rotate(enemy.angle + Math.PI / 2);

    ctx.fillStyle = 'rgba(10, 10, 10, 0.42)';
    ctx.beginPath();
    ctx.roundRect(-13, -15, 28, 34, 5);
    ctx.fill();

    ctx.fillStyle = '#181A1E';
    ctx.strokeStyle = '#0B0C0E';
    ctx.lineWidth = 1;
    const wheels = [
      [-14, -12],
      [9, -12],
      [-14, 6],
      [9, 6],
    ];
    for (const [wx, wy] of wheels) {
      ctx.fillRect(wx, wy, 5, 8);
      ctx.strokeRect(wx, wy, 5, 8);
    }

    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#FCA5A5' : '#8C3B3B';
    ctx.strokeStyle = '#2A1212';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, -15);
    ctx.lineTo(8, -15);
    ctx.lineTo(11, 4);
    ctx.lineTo(9, 15);
    ctx.lineTo(-9, 15);
    ctx.lineTo(-11, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#FEE2E2' : '#B44B4B';
    ctx.fillRect(-5, -13, 10, 9);

    ctx.fillStyle = '#F87171';
    ctx.fillRect(-3, 9, 6, 3);

    ctx.fillStyle = '#333840';
    ctx.strokeStyle = '#14171A';
    ctx.lineWidth = 1.2;
    ctx.fillRect(-2, -23, 4, 15);
    ctx.strokeRect(-2, -23, 4, 15);

    ctx.fillStyle = '#4B525E';
    ctx.beginPath();
    ctx.roundRect(-6, -6, 12, 11, 3);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawHeavyCrawler(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
    ctx.save();
    ctx.rotate(enemy.angle + Math.PI / 2);

    ctx.fillStyle = 'rgba(10, 10, 10, 0.48)';
    ctx.beginPath();
    ctx.roundRect(-19, -20, 40, 44, 6);
    ctx.fill();

    ctx.fillStyle = '#1B1E22';
    ctx.strokeStyle = '#0D0E10';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-19, -20, 8, 40, 2);
    ctx.roundRect(11, -20, 8, 40, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#FCA5A5' : '#6E2D35';
    ctx.strokeStyle = '#240E11';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-13, -17, 26, 35, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#3B4048';
    ctx.strokeStyle = '#141619';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-3, -31, 6, 20, 1.5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#FEE2E2' : '#9E3E47';
    ctx.strokeStyle = '#2A1013';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(8, -10);
    ctx.lineTo(11, 4);
    ctx.lineTo(7, 11);
    ctx.lineTo(-7, 11);
    ctx.lineTo(-11, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FB7185';
    ctx.fillRect(-4, 5, 8, 2.5);

    ctx.restore();
  }

  private drawSiegeBoss(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
    const isCharging = Boolean(enemy.telegraphTimer && enemy.telegraphTimer > 0);
    ctx.save();
    ctx.rotate(enemy.angle + Math.PI / 2);

    // Heavy ground shadow
    ctx.fillStyle = 'rgba(8, 10, 12, 0.55)';
    ctx.beginPath();
    ctx.roundRect(-31, -32, 62, 68, 9);
    ctx.fill();

    // Heavy armored twin track pods
    ctx.fillStyle = '#181B20';
    ctx.strokeStyle = '#090B0E';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-30, -31, 13, 62, 3);
    ctx.roundRect(17, -31, 13, 62, 3);
    ctx.fill();
    ctx.stroke();

    // Track cleats
    ctx.strokeStyle = '#333A44';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let ty = -26; ty <= 26; ty += 7) {
      ctx.moveTo(-29, ty);
      ctx.lineTo(-18, ty);
      ctx.moveTo(18, ty);
      ctx.lineTo(29, ty);
    }
    ctx.stroke();

    // Armored Dreadnought Chassis
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#FCA5A5' : '#4E1F27';
    ctx.strokeStyle = '#1A0A0D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, -28);
    ctx.lineTo(18, -28);
    ctx.lineTo(22, -16);
    ctx.lineTo(22, 24);
    ctx.lineTo(15, 29);
    ctx.lineTo(-15, 29);
    ctx.lineTo(-22, 24);
    ctx.lineTo(-22, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hazard front trim & glowing rear reactor core
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-13, -27, 26, 3);
    ctx.fillStyle = isCharging ? '#FB7185' : '#F97316';
    ctx.fillRect(-8, 22, 16, 4);

    // Twin Heavy Siege Barrels
    ctx.fillStyle = '#313742';
    ctx.strokeStyle = '#111418';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-10, -45, 6, 28, 1.5);
    ctx.roundRect(4, -45, 6, 28, 1.5);
    ctx.fill();
    ctx.stroke();

    // Muzzle tips (glow crimson while charging siege strike)
    ctx.fillStyle = isCharging ? '#F43F5E' : '#1F242C';
    ctx.fillRect(-11, -46, 8, 4);
    ctx.fillRect(3, -46, 8, 4);

    // Armored Dreadnought Turret
    ctx.fillStyle = enemy.hitFlashTimer > 0 ? '#FEE2E2' : '#882B36';
    ctx.strokeStyle = '#240B10';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-12, -15);
    ctx.lineTo(12, -15);
    ctx.lineTo(17, 2);
    ctx.lineTo(12, 16);
    ctx.lineTo(-12, 16);
    ctx.lineTo(-17, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Commander turret hatch & glowing siege core
    ctx.fillStyle = isCharging ? '#FECDD3' : '#F43F5E';
    ctx.strokeStyle = '#1E0B10';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 1, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawEnemyHealthBar(
    ctx: CanvasRenderingContext2D,
    enemy: EnemyInstance
  ): void {
    const barW = enemy.isBoss
      ? 54
      : enemy.definitionId === 'heavy_crawler'
        ? 34
        : 28;
    const barH = enemy.isBoss ? 5.5 : 4;
    const x = -barW * 0.5;
    const y = -enemy.radius - 14;
    const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));

    ctx.fillStyle = 'rgba(10, 12, 16, 0.88)';
    ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);

    ctx.fillStyle = enemy.isBoss ? '#F43F5E' : '#EF4444';
    ctx.fillRect(x, y, barW * ratio, barH);
  }

  private drawPlayerTank(ctx: CanvasRenderingContext2D, tank: PlayerTankState): void {
    ctx.save();
    ctx.translate(tank.position.x, tank.position.y);

    ctx.fillStyle = 'rgba(10, 12, 10, 0.46)';
    ctx.beginPath();
    ctx.roundRect(-29, -27, 62, 62, 10);
    ctx.fill();

    this.drawTankHull(ctx, tank.hullAngle, tank.hitFlashTimer > 0, tank.isMoving, tank.idlePhase);
    this.drawTankTurret(ctx, tank.turretAngle, tank.recoilOffset, tank.hitFlashTimer > 0);

    ctx.restore();
  }

  private drawTankHull(
    ctx: CanvasRenderingContext2D,
    hullAngle: number,
    isHitFlash: boolean,
    isMoving: boolean,
    idlePhase: number
  ): void {
    ctx.save();
    ctx.rotate(hullAngle + Math.PI / 2);

    ctx.fillStyle = '#1B2025';
    ctx.strokeStyle = '#0D1013';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-27, -29, 12, 58, 3);
    ctx.roundRect(15, -29, 12, 58, 3);
    ctx.fill();
    ctx.stroke();

    // Animated tread cleats when driving
    const treadShift = isMoving ? (idlePhase * 8) % 6 : 0;
    ctx.strokeStyle = '#3B444E';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let ty = -24 + treadShift; ty <= 24; ty += 6) {
      ctx.moveTo(-26, ty);
      ctx.lineTo(-16, ty);
      ctx.moveTo(16, ty);
      ctx.lineTo(26, ty);
    }
    ctx.stroke();

    ctx.fillStyle = isHitFlash ? '#FDA4AF' : '#3E5238';
    ctx.strokeStyle = '#1E281B';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.roundRect(-25, -25, 9, 50, 2);
    ctx.roundRect(16, -25, 9, 50, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isHitFlash ? '#FECDD3' : '#4B6443';
    ctx.strokeStyle = '#1A2417';
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.moveTo(-16, -25);
    ctx.lineTo(16, -25);
    ctx.lineTo(18, 22);
    ctx.lineTo(14, 27);
    ctx.lineTo(-14, 27);
    ctx.lineTo(-18, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isHitFlash ? '#FFE4E6' : '#5D7B53';
    ctx.beginPath();
    ctx.roundRect(-14, -23, 28, 13, 2);
    ctx.fill();

    ctx.fillStyle = '#FDE68A';
    ctx.fillRect(-13, -25, 4, 2);
    ctx.fillRect(9, -25, 4, 2);

    ctx.fillStyle = '#3C5035';
    ctx.strokeStyle = '#243120';
    ctx.lineWidth = 1;
    for (let sy = -8; sy <= 8; sy += 8) {
      ctx.fillRect(-19, sy, 3.5, 6);
      ctx.strokeRect(-19, sy, 3.5, 6);
      ctx.fillRect(15.5, sy, 3.5, 6);
      ctx.strokeRect(15.5, sy, 3.5, 6);
    }

    ctx.fillStyle = '#2A3726';
    ctx.strokeStyle = '#1B2418';
    ctx.beginPath();
    ctx.roundRect(-12, 12, 24, 11, 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#151C13';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let vx = -8; vx <= 8; vx += 4) {
      ctx.moveTo(vx, 14);
      ctx.lineTo(vx, 21);
    }
    ctx.stroke();

    ctx.restore();
  }

  private drawTankTurret(
    ctx: CanvasRenderingContext2D,
    turretAngle: number,
    recoilOffset: number,
    isHitFlash: boolean
  ): void {
    ctx.save();
    ctx.rotate(turretAngle + Math.PI / 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.arc(2, 3, 17, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(0, recoilOffset);

    ctx.fillStyle = '#5C7055';
    ctx.strokeStyle = '#192117';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-3.8, -46, 7.6, 33, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#7A9271';
    ctx.fillRect(-1.2, -45, 2.4, 30);

    ctx.fillStyle = '#4B5E45';
    ctx.strokeStyle = '#1A2218';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.roundRect(-5.5, -31, 11, 8, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2B332C';
    ctx.strokeStyle = '#121713';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-6, -50, 12, 6.5, 1.5);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    ctx.fillStyle = '#3E5138';
    ctx.strokeStyle = '#192217';
    ctx.beginPath();
    ctx.roundRect(-9, -18, 18, 8, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isHitFlash ? '#FECDD3' : '#6A8B5E';
    ctx.strokeStyle = '#1B2518';
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(10, -14);
    ctx.lineTo(16, 2);
    ctx.lineTo(11, 15);
    ctx.lineTo(-11, 15);
    ctx.lineTo(-16, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isHitFlash ? '#FFE4E6' : '#7C9E6E';
    ctx.beginPath();
    ctx.moveTo(-7, -10);
    ctx.lineTo(7, -10);
    ctx.lineTo(11, 2);
    ctx.lineTo(7, 11);
    ctx.lineTo(-7, 11);
    ctx.lineTo(-11, 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#4C6444';
    ctx.strokeStyle = '#1C2619';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(-4, 2, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.roundRect(4, -9, 4, 3, 1);
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-5, 11.5, 10, 2);

    ctx.restore();
  }

  private drawProjectiles(
    ctx: CanvasRenderingContext2D,
    projectiles: readonly ProjectileInstance[]
  ): void {
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (!p.active) continue;

      if (p.kind === 'mortar_shell') {
        this.drawMortarShell(ctx, p);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      const tier = Math.max(1, Math.min(5, p.visualTier ?? 1));

      if (p.kind === 'mg_bullet') {
        // Rapid tracer dart (longer & brighter at higher levels)
        const trailLen = 11 + tier * 2;
        ctx.fillStyle =
          tier >= 4 ? 'rgba(253, 224, 71, 0.85)' : 'rgba(250, 204, 21, 0.6)';
        ctx.fillRect(-trailLen - 2, -1.2, trailLen, 2.4);
        ctx.fillStyle = tier >= 4 ? '#FEF9C3' : '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(6 + tier * 0.5, 0);
        ctx.lineTo(-3, -1.8);
        ctx.lineTo(-3, 1.8);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'rocket') {
        const rocketScale = 1 + (tier - 1) * 0.08;
        ctx.scale(rocketScale, rocketScale);
        // Exhaust flame tail
        ctx.fillStyle = tier >= 4 ? 'rgba(251, 113, 133, 0.92)' : 'rgba(251, 146, 60, 0.85)';
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(-18 - tier * 1.5, -3);
        ctx.lineTo(-15, 0);
        ctx.lineTo(-18 - tier * 1.5, 3);
        ctx.closePath();
        ctx.fill();

        // Finned warhead
        ctx.fillStyle = '#E2E8F0';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-7, -2.5, 11, 5, 1);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = tier >= 4 ? '#FB7185' : '#F43F5E';
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(3, -3.2);
        ctx.lineTo(3, 3.2);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'rail_slug') {
        // Hyper-velocity cyan slug scaled by tier
        const slugScale = 1 + (tier - 1) * 0.1;
        ctx.scale(slugScale, slugScale);
        ctx.fillStyle = tier >= 4 ? 'rgba(103, 232, 249, 0.6)' : 'rgba(34, 211, 238, 0.45)';
        ctx.fillRect(-26 - tier * 2, -3, 26 + tier * 2, 6);
        ctx.fillStyle = '#ECFEFF';
        ctx.strokeStyle = tier >= 4 ? '#22D3EE' : '#06B6D4';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(2, -3);
        ctx.lineTo(-10, -2);
        ctx.lineTo(-10, 2);
        ctx.lineTo(2, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // 'tank_shell' and 'heavy_shell' (Cannon skill scales appearance cleanly with tier)
        const isHeavy = p.kind === 'heavy_shell';
        const isCrit = Boolean(p.isCrit);
        const scale = isHeavy
          ? 1.2 + (tier - 1) * 0.12
          : isCrit
            ? 1.22
            : 1;
        ctx.scale(scale, scale);

        const trailLen = isHeavy ? 22 + (tier - 1) * 4 : isCrit ? 28 : 22;
        const grad = ctx.createLinearGradient(-trailLen, 0, 6, 0);
        grad.addColorStop(0, 'rgba(251, 191, 36, 0)');
        grad.addColorStop(
          1,
          isCrit
            ? 'rgba(253, 224, 71, 0.95)'
            : isHeavy && tier >= 4
              ? 'rgba(249, 115, 22, 0.9)'
              : 'rgba(251, 191, 36, 0.78)'
        );
        ctx.fillStyle = grad;
        ctx.fillRect(-trailLen, -2.2, trailLen + 2, 4.4);

        ctx.fillStyle = isHeavy
          ? tier >= 5
            ? '#EF4444'
            : tier >= 3
              ? '#EA580C'
              : '#F97316'
          : isCrit
            ? '#FDE047'
            : '#F59E0B';
        ctx.strokeStyle = isCrit ? '#B45309' : '#78350F';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(2, -3);
        ctx.lineTo(-6, -2.5);
        ctx.lineTo(-6, 2.5);
        ctx.lineTo(2, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle =
          isCrit || (isHeavy && tier >= 4) ? '#FFFBEB' : '#FEF3C7';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(3, -1.6);
        ctx.lineTo(3, 1.6);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private drawMortarShell(
    ctx: CanvasRenderingContext2D,
    p: ProjectileInstance
  ): void {
    const t =
      p.flightDuration && p.flightElapsed !== undefined
        ? Math.min(1, p.flightElapsed / p.flightDuration)
        : 0.5;
    const arcHeight = Math.sin(t * Math.PI) * 58;
    const tier = Math.max(1, Math.min(5, p.visualTier ?? 1));

    // Ground shadow beneath arcing shell
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Elevated finned artillery bomb
    ctx.translate(p.x, p.y - arcHeight);
    ctx.rotate(p.angle);
    const scale = (0.9 + Math.sin(t * Math.PI) * 0.45) * (1 + (tier - 1) * 0.08);
    ctx.scale(scale, scale);

    ctx.fillStyle = tier >= 4 ? '#1E293B' : '#334155';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(1, -4.5);
    ctx.lineTo(-7, -3.5);
    ctx.lineTo(-7, 3.5);
    ctx.lineTo(1, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = tier >= 4 ? '#EF4444' : '#F97316';
    ctx.fillRect(-7, -2.5, 3, 5);
    ctx.restore();
  }

  private drawEffects(
    ctx: CanvasRenderingContext2D,
    effects: readonly VisualEffect[]
  ): void {
    for (let i = 0; i < effects.length; i++) {
      const fx = effects[i];
      const progress = 1 - Math.max(0, fx.life / fx.maxLife);
      const alpha = Math.max(0, fx.life / fx.maxLife);

      ctx.save();
      ctx.globalAlpha = alpha;

      if (fx.kind === 'muzzle') {
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.angle);
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(fx.size * (1 + progress * 0.4), -5);
        ctx.lineTo(fx.size * 0.8, 0);
        ctx.lineTo(fx.size * (1 + progress * 0.4), 5);
        ctx.closePath();
        ctx.fill();
      } else if (fx.kind === 'impact') {
        ctx.translate(fx.x, fx.y);
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 2;
        const r = fx.size * (0.4 + progress * 0.9);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 4 + fx.angle;
          ctx.moveTo(Math.cos(a) * -r, Math.sin(a) * -r);
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();
      } else if (fx.kind === 'tracer') {
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.tx, fx.ty);
        ctx.stroke();
      } else if (fx.kind === 'rail_beam') {
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = fx.size * 1.8 * alpha;
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.tx, fx.ty);
        ctx.stroke();

        ctx.strokeStyle = '#ECFEFF';
        ctx.lineWidth = Math.max(1, fx.size * 0.65 * alpha);
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.tx, fx.ty);
        ctx.stroke();
      } else if (fx.kind === 'lightning_arc' && fx.points && fx.points.length >= 2) {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3.2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(fx.points[0].x, fx.points[0].y);
        for (let p = 1; p < fx.points.length; p++) {
          const prev = fx.points[p - 1];
          const curr = fx.points[p];
          const mx = (prev.x + curr.x) * 0.5 + (Math.random() - 0.5) * 18;
          const my = (prev.y + curr.y) * 0.5 + (Math.random() - 0.5) * 18;
          ctx.lineTo(mx, my);
          ctx.lineTo(curr.x, curr.y);
        }
        ctx.stroke();

        ctx.strokeStyle = '#E0F2FE';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else if (fx.kind === 'flame_cone') {
        const half = fx.coneHalfAngle ?? 0.45;
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.angle);

        const len = fx.size * (0.85 + progress * 0.25);
        // Outer orange flame cone
        ctx.fillStyle = 'rgba(249, 115, 22, 0.55)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, len, -half, half);
        ctx.closePath();
        ctx.fill();

        // Inner bright amber-white flame core
        ctx.fillStyle = 'rgba(253, 224, 71, 0.72)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, len * 0.62, -half * 0.55, half * 0.55);
        ctx.closePath();
        ctx.fill();
      } else if (fx.kind === 'blast_ring') {
        ctx.translate(fx.x, fx.y);
        const radius = fx.size * (0.45 + progress * 0.65);

        ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === 'explosion') {
        ctx.translate(fx.x, fx.y);
        const radius = fx.size * (0.35 + progress * 1.1);

        ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#FDBA74';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = fx.angle + (s * Math.PI) / 3;
          const r1 = radius * 0.45;
          const r2 = radius * 1.15;
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        }
        ctx.stroke();
      } else if (fx.kind === 'damage_text' && fx.value !== undefined) {
        ctx.font = fx.isCrit
          ? '700 14px "JetBrains Mono", monospace'
          : '700 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const label = fx.isCrit ? `-${fx.value}!` : `-${fx.value}`;
        ctx.lineWidth = fx.isCrit ? 3.5 : 3;
        ctx.strokeStyle = 'rgba(12, 15, 20, 0.9)';
        ctx.strokeText(label, fx.x, fx.y);
        ctx.fillStyle = fx.color;
        ctx.fillText(label, fx.x, fx.y);
      }

      ctx.restore();
    }
  }
}
