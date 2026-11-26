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
  damageVignetteAlpha?: number;
}

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash01(seed: number, step: number): number {
  const x = Math.sin(seed * 12.9898 + step * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const TERRAIN_EXTENT_X = 1960;
const TERRAIN_EXTENT_Y = 1220;

export class Renderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private camera: Camera;
  private terrainCache: HTMLCanvasElement | null = null;
  private damageVignetteCache: HTMLCanvasElement | null = null;
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
    if (!this.damageVignetteCache) {
      this.buildDamageVignetteCache();
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

    const {
      bounds,
      tank,
      enemies,
      projectiles,
      mines,
      effects,
      showRangeRing,
      damageVignetteAlpha = 0,
    } = scene;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    ctx.fillStyle = '#202B1E';
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    ctx.save();
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

    // Layer 3: Ground mines, Mortar reticles/arcs & Boss Siege Telegraphs
    this.drawMines(ctx, mines);
    this.drawMortarReticles(ctx, projectiles);
    this.drawBossTelegraphs(ctx, enemies);

    // Layer 4: Enemies & Player Tank
    this.drawEnemies(ctx, enemies);
    this.drawPlayerTank(ctx, tank);

    // Layer 5: Projectiles & Combat VFX (explosions, beams, arcs, particles)
    this.drawProjectiles(ctx, projectiles);
    this.drawWorldEffects(ctx, effects);

    // Layer 6: Enemy Health Bars & Floating Damage Numbers (always crisp and readable above VFX)
    this.drawEnemyHealthBars(ctx, enemies);
    this.drawDamageNumbers(ctx, effects);

    ctx.restore();

    // Layer 7 (Screen-space): Restrained edge damage feedback vignette
    if (damageVignetteAlpha > 0.01 && this.damageVignetteCache) {
      ctx.save();
      ctx.globalAlpha = damageVignetteAlpha;
      ctx.drawImage(
        this.damageVignetteCache,
        0,
        0,
        this.viewportWidth,
        this.viewportHeight
      );
      ctx.restore();
    }

    ctx.restore();
  }

  private buildDamageVignetteCache(): void {
    if (typeof document === 'undefined') return;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.34,
      size * 0.5,
      size * 0.5,
      size * 0.72
    );
    grad.addColorStop(0, 'rgba(225, 29, 72, 0)');
    grad.addColorStop(0.65, 'rgba(225, 29, 72, 0.25)');
    grad.addColorStop(1, 'rgba(225, 29, 72, 0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    this.damageVignetteCache = canvas;
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
    const nowSec = performance.now() * 0.001;
    for (let i = 0; i < mines.length; i++) {
      const m = mines[i];
      if (!m.active) continue;

      const isArmed = m.armTimer <= 0;
      const pulse = isArmed ? 0.5 + 0.5 * Math.sin(nowSec * 6 + m.uid) : 0;

      ctx.save();
      ctx.translate(m.x, m.y);

      // Ground shadow
      ctx.fillStyle = 'rgba(8, 10, 12, 0.38)';
      ctx.beginPath();
      ctx.arc(1.5, 2, 10, 0, Math.PI * 2);
      ctx.fill();

      // Trigger zone pulse ring when armed
      if (isArmed) {
        ctx.strokeStyle = `rgba(163, 230, 53, ${0.14 + pulse * 0.16})`;
        ctx.lineWidth = 1.1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, m.triggerRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Octagonal metallic mine casing
      ctx.fillStyle = '#333C36';
      ctx.strokeStyle = '#141916';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let v = 0; v < 8; v++) {
        const a = (v * Math.PI) / 4 + Math.PI / 8;
        const px = Math.cos(a) * 9.5;
        const py = Math.sin(a) * 9.5;
        if (v === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Caution rim prongs
      ctx.fillStyle = isArmed ? '#84CC16' : '#D97706';
      ctx.fillRect(-7, -1, 2.5, 2);
      ctx.fillRect(4.5, -1, 2.5, 2);

      // Pressure plate + armed indicator LED
      ctx.fillStyle = '#4B584E';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isArmed
        ? pulse > 0.5
          ? '#BEF264'
          : '#A3E635'
        : '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, isArmed ? 2.4 + pulse * 0.5 : 2.1, 0, Math.PI * 2);
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

      // Visible parabolic trajectory arc preview
      if (p.startX !== undefined && p.startY !== undefined) {
        const midX = (p.startX + p.targetX) * 0.5;
        const midY = (p.startY + p.targetY) * 0.5 - 116;
        ctx.save();
        ctx.strokeStyle = `rgba(251, 146, 60, ${0.22 + (1 - t) * 0.16})`;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.moveTo(p.startX, p.startY);
        ctx.quadraticCurveTo(midX, midY, p.targetX, p.targetY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(p.targetX, p.targetY);
      ctx.fillStyle = `rgba(249, 115, 22, ${0.06 + t * 0.12})`;
      ctx.beginPath();
      ctx.arc(0, 0, p.aoeRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(249, 115, 22, ${0.4 + t * 0.48})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, p.aoeRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Contracting inner timing bullseye
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(253, 186, 116, ${0.55 + t * 0.4})`;
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

      // Ground hazard zone (exact damage boundary)
      ctx.translate(e.telegraphX, e.telegraphY);
      ctx.fillStyle = `rgba(225, 29, 72, ${0.14 + progress * 0.22})`;
      ctx.beginPath();
      ctx.arc(0, 0, e.telegraphRadius, 0, Math.PI * 2);
      ctx.fill();

      // Expanding timing ring (matches outer edge right on impact)
      ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, e.telegraphRadius * progress, 0, Math.PI * 2);
      ctx.fill();

      // Solid faint rim + dashed warning ring for unambiguous dodge boundary
      ctx.strokeStyle = `rgba(251, 113, 133, ${0.35 + progress * 0.35})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, e.telegraphRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(253, 164, 175, ${0.65 + progress * 0.35})`;
      ctx.lineWidth = 2.4;
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
      ctx.translate(
        enemy.position.x + (enemy.hitReactionX || 0),
        enemy.position.y + (enemy.hitReactionY || 0)
      );

      if (enemy.isDying) {
        const t = Math.max(0, enemy.deathTimer / enemy.deathDuration);
        ctx.globalAlpha = t;
        const shrink = 0.58 + 0.42 * t;
        ctx.scale(shrink, shrink);
        ctx.rotate((1 - t) * (enemy.uid % 2 === 0 ? 0.28 : -0.28));
      }

      if (enemy.definitionId === 'siege_boss') {
        this.drawSiegeBoss(ctx, enemy);
      } else if (enemy.definitionId === 'heavy_tank') {
        this.drawHeavyTank(ctx, enemy);
      } else if (enemy.definitionId === 'artillery') {
        this.drawArtillery(ctx, enemy);
      } else if (enemy.definitionId === 'assault_tank') {
        this.drawAssaultTank(ctx, enemy);
      } else if (enemy.definitionId === 'runner') {
        this.drawRunner(ctx, enemy);
      } else {
        this.drawScout(ctx, enemy);
      }

      ctx.restore();
    }
  }

  private drawEnemyHealthBars(
    ctx: CanvasRenderingContext2D,
    enemies: readonly EnemyInstance[]
  ): void {
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.isDying) continue;

      const xCenter = enemy.position.x + (enemy.hitReactionX || 0);
      const yCenter = enemy.position.y + (enemy.hitReactionY || 0);
      const barW = enemy.isBoss
        ? 54
        : enemy.definitionId === 'heavy_tank'
          ? 40
          : enemy.definitionId === 'assault_tank' || enemy.definitionId === 'artillery'
            ? 32
            : 26;
      const barH = enemy.isBoss ? 5.5 : enemy.definitionId === 'heavy_tank' ? 4.5 : 4;
      const x = xCenter - barW * 0.5;
      const y = yCenter - enemy.radius - 14;
      const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));

      ctx.fillStyle = 'rgba(10, 12, 16, 0.9)';
      ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);

      ctx.fillStyle = enemy.isBoss
        ? '#F43F5E'
        : enemy.definitionId === 'artillery'
          ? '#F59E0B'
          : enemy.definitionId === 'runner'
            ? '#EC4899'
            : '#EF4444';
      ctx.fillRect(x, y, barW * ratio, barH);
    }
  }

  private drawScout(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
    const isHit = enemy.hitFlashTimer > 0;
    ctx.save();
    ctx.rotate(enemy.angle + Math.PI / 2);

    // Compact ground shadow
    ctx.fillStyle = 'rgba(10, 10, 10, 0.38)';
    ctx.beginPath();
    ctx.roundRect(-12, -13, 24, 28, 5);
    ctx.fill();

    // 4 exposed agile off-road tires
    ctx.fillStyle = '#16181D';
    ctx.strokeStyle = '#090A0C';
    ctx.lineWidth = 1;
    const wheels = [
      [-12.5, -10],
      [8.5, -10],
      [-12.5, 4],
      [8.5, 4],
    ];
    for (const [wx, wy] of wheels) {
      ctx.fillRect(wx, wy, 4, 7);
      ctx.strokeRect(wx, wy, 4, 7);
    }

    // Twin whip recon antennas at rear
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-5, 11);
    ctx.lineTo(-8, 19);
    ctx.moveTo(5, 11);
    ctx.lineTo(8, 19);
    ctx.stroke();

    // Narrow tapered buggy chassis
    ctx.fillStyle = isHit ? '#FCA5A5' : '#7C3A32';
    ctx.strokeStyle = '#26100E';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-6.5, -13);
    ctx.lineTo(6.5, -13);
    ctx.lineTo(9, 3);
    ctx.lineTo(7, 13);
    ctx.lineTo(-7, 13);
    ctx.lineTo(-9, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cyan recon optics slit
    ctx.fillStyle = isHit ? '#FEF2F2' : '#38BDF8';
    ctx.fillRect(-4, -10.5, 8, 2.5);

    // Short light autocannon
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.1;
    ctx.fillRect(-1.5, -20, 3, 13);
    ctx.strokeRect(-1.5, -20, 3, 13);

    // Small compact recon turret
    ctx.fillStyle = isHit ? '#FEE2E2' : '#A84A3E';
    ctx.strokeStyle = '#26100E';
    ctx.beginPath();
    ctx.roundRect(-5, -5, 10, 9, 3);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawAssaultTank(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
    const isHit = enemy.hitFlashTimer > 0;
    ctx.save();
    ctx.rotate(enemy.angle + Math.PI / 2);

    // Ground shadow
    ctx.fillStyle = 'rgba(10, 10, 10, 0.44)';
    ctx.beginPath();
    ctx.roundRect(-15, -17, 30, 36, 5);
    ctx.fill();

    // Side armored treads
    ctx.fillStyle = '#181B20';
    ctx.strokeStyle = '#0B0C0E';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(-14.5, -16, 6, 32, 2);
    ctx.roundRect(8.5, -16, 6, 32, 2);
    ctx.fill();
    ctx.stroke();

    // Medium battle tank hull
    ctx.fillStyle = isHit ? '#FCA5A5' : '#8F2E36';
    ctx.strokeStyle = '#280C10';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-10, -15, 20, 31, 3);
    ctx.fill();
    ctx.stroke();

    // Sloped front glacis trim + engine deck vents
    ctx.fillStyle = isHit ? '#FECACA' : '#B53F48';
    ctx.fillRect(-7, -13, 14, 7);
    ctx.fillStyle = '#2D1115';
    ctx.fillRect(-6, 8, 12, 5);

    // Medium main gun barrel + collar
    ctx.fillStyle = '#374151';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-2.4, -27, 4.8, 18, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(-3.5, -28, 7, 3.5);

    // Centered hexagonal combat turret
    ctx.fillStyle = isHit ? '#FEE2E2' : '#A93842';
    ctx.strokeStyle = '#280C10';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(6, -8);
    ctx.lineTo(9, 2);
    ctx.lineTo(6, 9);
    ctx.lineTo(-6, 9);
    ctx.lineTo(-9, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crimson tactical stripe
    ctx.fillStyle = '#F87171';
    ctx.fillRect(-4, 4, 8, 2);

    ctx.restore();
  }

  private drawHeavyTank(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
    const isHit = enemy.hitFlashTimer > 0;
    ctx.save();
    ctx.rotate(enemy.angle + Math.PI / 2);

    // Heavy shadow
    ctx.fillStyle = 'rgba(10, 10, 10, 0.52)';
    ctx.beginPath();
    ctx.roundRect(-21, -22, 42, 46, 6);
    ctx.fill();

    // Thick armored side track skirts
    ctx.fillStyle = '#191C21';
    ctx.strokeStyle = '#090A0C';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-20, -21, 9, 42, 2.5);
    ctx.roundRect(11, -21, 9, 42, 2.5);
    ctx.fill();
    ctx.stroke();

    // Broad armored hull
    ctx.fillStyle = isHit ? '#FCA5A5' : '#5E232B';
    ctx.strokeStyle = '#200B0E';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.roundRect(-14, -19, 28, 39, 3.5);
    ctx.fill();
    ctx.stroke();

    // Front heavy ramming plow / bumper
    ctx.fillStyle = '#374151';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-14, -18);
    ctx.lineTo(0, -23);
    ctx.lineTo(14, -18);
    ctx.lineTo(12, -14);
    ctx.lineTo(-12, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Riveted upper armor plate + rear exhaust vents
    ctx.fillStyle = isHit ? '#FECACA' : '#7C2D37';
    ctx.fillRect(-10, -11, 20, 22);
    ctx.fillStyle = '#1E1B1E';
    ctx.fillRect(-9, 13, 18, 4);

    // Heavy wide cannon barrel
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-3.6, -34, 7.2, 23, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-5, -35.5, 10, 4.5);

    // Reinforced wide juggernaut turret
    ctx.fillStyle = isHit ? '#FEE2E2' : '#9E3743';
    ctx.strokeStyle = '#240C10';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-10, -11);
    ctx.lineTo(10, -11);
    ctx.lineTo(13, 2);
    ctx.lineTo(9, 12);
    ctx.lineTo(-9, 12);
    ctx.lineTo(-13, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hazard trim bar
    ctx.fillStyle = '#FB923C';
    ctx.fillRect(-6, 6, 12, 3);

    ctx.restore();
  }

  private drawArtillery(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
    const isHit = enemy.hitFlashTimer > 0;
    ctx.save();
    ctx.rotate(enemy.angle + Math.PI / 2);

    // Ground shadow
    ctx.fillStyle = 'rgba(10, 10, 10, 0.44)';
    ctx.beginPath();
    ctx.roundRect(-16, -16, 32, 38, 5);
    ctx.fill();

    // Deployed twin rear recoil stabilizer spades (distinct SPG profile)
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-9, 12);
    ctx.lineTo(-16, 20);
    ctx.lineTo(-11, 22);
    ctx.lineTo(-5, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(9, 12);
    ctx.lineTo(16, 20);
    ctx.lineTo(11, 22);
    ctx.lineTo(5, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tracks
    ctx.fillStyle = '#1C1917';
    ctx.strokeStyle = '#0C0A09';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(-15, -15, 6, 30, 2);
    ctx.roundRect(9, -15, 6, 30, 2);
    ctx.fill();
    ctx.stroke();

    // Rectangular SPG hull (desert-ochre / siege amber)
    ctx.fillStyle = isHit ? '#FDE68A' : '#854D27';
    ctx.strokeStyle = '#291709';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-10, -14, 20, 29, 2.5);
    ctx.fill();
    ctx.stroke();

    // Forward driver cab / sighting optics
    ctx.fillStyle = isHit ? '#FEF3C7' : '#A16234';
    ctx.fillRect(-7, -12, 14, 8);
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(-4, -10, 8, 2.5);

    // Extra-long elevated siege gun barrel + prominent muzzle brake
    ctx.fillStyle = '#44403C';
    ctx.strokeStyle = '#1C1917';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(-2.4, -36, 4.8, 34, 1.5);
    ctx.fill();
    ctx.stroke();

    // Slotted artillery muzzle brake
    ctx.fillStyle = '#292524';
    ctx.strokeStyle = '#0C0A09';
    ctx.fillRect(-4.5, -39, 9, 4.5);
    ctx.strokeRect(-4.5, -39, 9, 4.5);

    // Rear-mounted open gun cradle
    ctx.fillStyle = isHit ? '#FEF3C7' : '#B46934';
    ctx.strokeStyle = '#291709';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-7, -1, 14, 13, 2.5);
    ctx.fill();
    ctx.stroke();

    // Siege breech glow accent
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-3, 7, 6, 3);

    ctx.restore();
  }

  private drawRunner(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
    const isHit = enemy.hitFlashTimer > 0;
    ctx.save();
    ctx.rotate(enemy.angle + Math.PI / 2);

    // Fiery rear booster exhaust plume
    ctx.fillStyle = 'rgba(249, 115, 22, 0.72)';
    ctx.beginPath();
    ctx.moveTo(-4, 12);
    ctx.lineTo(0, 22);
    ctx.lineTo(4, 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.moveTo(-2, 12);
    ctx.lineTo(0, 17);
    ctx.lineTo(2, 12);
    ctx.closePath();
    ctx.fill();

    // Sleek shadow
    ctx.fillStyle = 'rgba(10, 10, 10, 0.38)';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 12);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();

    // Flared rear drive wheels
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#09090B';
    ctx.lineWidth = 1.1;
    ctx.fillRect(-11.5, 3, 4.5, 9);
    ctx.strokeRect(-11.5, 3, 4.5, 9);
    ctx.fillRect(7, 3, 4.5, 9);
    ctx.strokeRect(7, 3, 4.5, 9);

    // Forward twin steel ramming blades (melee identity)
    ctx.fillStyle = '#E2E8F0';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-5, -10);
    ctx.lineTo(-7, -20);
    ctx.lineTo(-1.5, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, -10);
    ctx.lineTo(7, -20);
    ctx.lineTo(1.5, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Narrow dart chassis
    ctx.fillStyle = isHit ? '#FBCFE8' : '#9D174D';
    ctx.strokeStyle = '#3B0722';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(9, 4);
    ctx.lineTo(7, 13);
    ctx.lineTo(-7, 13);
    ctx.lineTo(-9, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Magenta racing dorsal spine
    ctx.fillStyle = isHit ? '#FCE7F3' : '#EC4899';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(4, 9);
    ctx.lineTo(-4, 9);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawSiegeBoss(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
    const isChargingSiege = Boolean(enemy.telegraphTimer && enemy.telegraphTimer > 0);
    const isChargingBurst = Boolean(
      (enemy.burstChargeTimer && enemy.burstChargeTimer > 0) ||
        (enemy.burstShotsRemaining && enemy.burstShotsRemaining > 0)
    );
    const isCharging = isChargingSiege || isChargingBurst;
    const isIntro = Boolean(enemy.introTimer && enemy.introTimer > 0 && enemy.introDuration);

    ctx.save();
    ctx.rotate(enemy.angle + Math.PI / 2);

    // Subtle crimson command aura ring so boss is immediately distinct
    ctx.strokeStyle = isChargingBurst
      ? 'rgba(251, 191, 36, 0.48)'
      : 'rgba(244, 63, 94, 0.36)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.stroke();

    // Boss arrival intro ring
    if (isIntro && enemy.introTimer && enemy.introDuration) {
      const introT = Math.max(0, Math.min(1, enemy.introTimer / enemy.introDuration));
      ctx.strokeStyle = `rgba(251, 113, 133, ${0.8 * introT})`;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, 44 + (1 - introT) * 34, 0, Math.PI * 2);
      ctx.stroke();
    }

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

    // Muzzle tips (glow crimson while charging siege strike or gold-orange during burst)
    ctx.fillStyle = isChargingBurst
      ? '#FBBF24'
      : isChargingSiege
        ? '#F43F5E'
        : '#1F242C';
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
    ctx.fillStyle = isChargingBurst
      ? '#FDE047'
      : isChargingSiege
        ? '#FECDD3'
        : '#F43F5E';
    ctx.strokeStyle = '#1E0B10';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 1, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawPlayerTank(ctx: CanvasRenderingContext2D, tank: PlayerTankState): void {
    ctx.save();
    ctx.translate(
      tank.position.x + (tank.bodyRecoilX || 0),
      tank.position.y + (tank.bodyRecoilY || 0)
    );

    ctx.fillStyle = 'rgba(10, 12, 10, 0.46)';
    ctx.beginPath();
    ctx.roundRect(-29, -27, 62, 62, 10);
    ctx.fill();

    this.drawTankHull(
      ctx,
      tank.hullAngle,
      tank.hitFlashTimer > 0,
      tank.isMoving,
      tank.idlePhase
    );
    this.drawTankTurret(
      ctx,
      tank.turretAngle,
      tank.recoilOffset,
      tank.hitFlashTimer > 0
    );

    if (tank.hitFlashTimer > 0) {
      const flashAlpha = Math.min(0.65, (tank.hitFlashTimer / 0.13) * 0.65);
      ctx.strokeStyle = `rgba(251, 113, 133, ${flashAlpha})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.stroke();
    }

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
        // High-speed bright tracer + pointed brass slug
        const trailLen = 15 + tier * 2.2;
        ctx.fillStyle =
          tier >= 4 ? 'rgba(254, 240, 138, 0.36)' : 'rgba(250, 204, 21, 0.28)';
        ctx.fillRect(-trailLen - 4, -1.7, trailLen, 3.4);

        ctx.fillStyle =
          tier >= 4 ? 'rgba(254, 249, 195, 0.88)' : 'rgba(253, 224, 71, 0.78)';
        ctx.fillRect(-trailLen * 0.7, -0.9, trailLen * 0.7, 1.8);

        ctx.fillStyle = '#FEF9C3';
        ctx.beginPath();
        ctx.moveTo(6.5 + tier * 0.4, 0);
        ctx.lineTo(0, -1.9);
        ctx.lineTo(-4, -1.4);
        ctx.lineTo(-4, 1.4);
        ctx.lineTo(0, 1.9);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'rocket') {
        const rocketScale = 1 + (tier - 1) * 0.08;
        ctx.scale(rocketScale, rocketScale);

        // Flickering twin-layer exhaust plume
        ctx.fillStyle =
          tier >= 4 ? 'rgba(251, 113, 133, 0.75)' : 'rgba(249, 115, 22, 0.78)';
        ctx.beginPath();
        ctx.moveTo(-6, -2);
        ctx.lineTo(-20 - tier * 1.8, -3.5);
        ctx.lineTo(-15, 0);
        ctx.lineTo(-20 - tier * 1.8, 3.5);
        ctx.lineTo(-6, 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(-6, -1.1);
        ctx.lineTo(-13, 0);
        ctx.lineTo(-6, 1.1);
        ctx.closePath();
        ctx.fill();

        // Swept stabilizing tail fins
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-4, -2.5);
        ctx.lineTo(-8, -5.2);
        ctx.lineTo(-8, -2.2);
        ctx.moveTo(-4, 2.5);
        ctx.lineTo(-8, 5.2);
        ctx.lineTo(-8, 2.2);
        ctx.closePath();
        ctx.fill();

        // Rocket fuselage
        ctx.fillStyle = '#E2E8F0';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-7, -2.5, 11, 5, 1);
        ctx.fill();
        ctx.stroke();

        // Warhead band + nose cone
        ctx.fillStyle = tier >= 4 ? '#FB7185' : '#F43F5E';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(3, -3.2);
        ctx.lineTo(3, 3.2);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'rail_slug') {
        // Hyper-velocity ionized chevron + streak
        const slugScale = 1 + (tier - 1) * 0.1;
        ctx.scale(slugScale, slugScale);

        ctx.fillStyle = 'rgba(34, 211, 238, 0.34)';
        ctx.fillRect(-32 - tier * 3, -3.4, 32 + tier * 3, 6.8);

        ctx.fillStyle = 'rgba(165, 243, 252, 0.72)';
        ctx.fillRect(-20 - tier * 2, -1.4, 20 + tier * 2, 2.8);

        ctx.fillStyle = '#ECFEFF';
        ctx.strokeStyle = tier >= 4 ? '#22D3EE' : '#06B6D4';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.lineTo(2, -3.4);
        ctx.lineTo(-10, -2.1);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-10, 2.1);
        ctx.lineTo(2, 3.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'enemy_artillery_shell') {
        // Hostile glowing crimson-amber artillery shell with bright readable outline
        ctx.fillStyle = 'rgba(239, 68, 68, 0.34)';
        ctx.beginPath();
        ctx.moveTo(-22, 0);
        ctx.lineTo(-4, -3.5);
        ctx.lineTo(-4, 3.5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(251, 146, 60, 0.78)';
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-3, -1.7);
        ctx.lineTo(-3, 1.7);
        ctx.closePath();
        ctx.fill();

        // Outer hostile crimson aura ring
        ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();

        // Pointed artillery shell body
        ctx.fillStyle = '#EF4444';
        ctx.strokeStyle = '#7F1D1D';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(2, -3.2);
        ctx.lineTo(-6, -2.4);
        ctx.lineTo(-6, 2.4);
        ctx.lineTo(2, 3.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Hot amber core
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(1.5, 0, 2.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'enemy_boss_shell') {
        // Heavy Boss Siege Shell: larger scale, dark crimson-gold armor casing + luminous rose aura
        const scale = tier >= 2 ? 1.24 : 1.04;
        ctx.scale(scale, scale);

        ctx.fillStyle = 'rgba(244, 63, 94, 0.36)';
        ctx.beginPath();
        ctx.moveTo(-26, 0);
        ctx.lineTo(-5, -4.5);
        ctx.lineTo(-5, 4.5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(253, 224, 71, 0.8)';
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(-3, -1.8);
        ctx.lineTo(-3, 1.8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(225, 29, 72, 0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, 8.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#E11D48';
        ctx.strokeStyle = '#4C0519';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(10.5, 0);
        ctx.lineTo(2.5, -3.8);
        ctx.lineTo(-7, -2.8);
        ctx.lineTo(-7, 2.8);
        ctx.lineTo(2.5, 3.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(2, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 'tank_shell' and 'heavy_shell' detailed AP ballistic round + layered wake
        const isHeavy = p.kind === 'heavy_shell';
        const isCrit = Boolean(p.isCrit);
        const scale = isHeavy
          ? 1.18 + (tier - 1) * 0.11
          : isCrit
            ? 1.24
            : 1.04;
        ctx.scale(scale, scale);

        const trailLen = isHeavy ? 22 + (tier - 1) * 3.5 : isCrit ? 28 : 21;

        // Outer wake sheath
        ctx.fillStyle = isCrit
          ? 'rgba(253, 224, 71, 0.32)'
          : isHeavy
            ? 'rgba(249, 115, 22, 0.3)'
            : 'rgba(251, 191, 36, 0.28)';
        ctx.beginPath();
        ctx.moveTo(-trailLen, 0);
        ctx.lineTo(-4, -2.8);
        ctx.lineTo(-4, 2.8);
        ctx.closePath();
        ctx.fill();

        // Inner bright tracer core
        ctx.fillStyle = isCrit
          ? 'rgba(254, 249, 195, 0.85)'
          : 'rgba(253, 224, 71, 0.72)';
        ctx.beginPath();
        ctx.moveTo(-trailLen * 0.65, 0);
        ctx.lineTo(-4, -1.3);
        ctx.lineTo(-4, 1.3);
        ctx.closePath();
        ctx.fill();

        // Tapered brass/steel shell casing
        ctx.fillStyle = isHeavy
          ? tier >= 5
            ? '#EF4444'
            : tier >= 3
              ? '#EA580C'
              : '#F97316'
          : isCrit
            ? '#FDE047'
            : '#F59E0B';
        ctx.strokeStyle = isCrit ? '#92400E' : '#451A03';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(2.5, -3.1);
        ctx.lineTo(-6.5, -2.4);
        ctx.lineTo(-6.5, 2.4);
        ctx.lineTo(2.5, 3.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Metallic driving band & hot nose cap
        ctx.fillStyle = '#334155';
        ctx.fillRect(-3.5, -2.5, 2, 5);

        ctx.fillStyle =
          isCrit || (isHeavy && tier >= 4) ? '#FFFBEB' : '#FEF3C7';
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(3.5, -1.8);
        ctx.lineTo(3.5, 1.8);
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
    const arcHeight = Math.sin(t * Math.PI) * 62;
    const tier = Math.max(1, Math.min(5, p.visualTier ?? 1));

    // Ground shadow beneath arcing shell
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.38 - Math.sin(t * Math.PI) * 0.14})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 6.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Elevated finned artillery bomb pitched gently along arc
    ctx.translate(p.x, p.y - arcHeight);
    ctx.rotate(p.angle + (t - 0.5) * 0.45);
    const scale = (0.9 + Math.sin(t * Math.PI) * 0.48) * (1 + (tier - 1) * 0.08);
    ctx.scale(scale, scale);

    // Tracer glow behind mortar bomb
    ctx.fillStyle = 'rgba(249, 115, 22, 0.52)';
    ctx.beginPath();
    ctx.moveTo(-7, -2.5);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-7, 2.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = tier >= 4 ? '#1E293B' : '#334155';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(1.5, -4.5);
    ctx.lineTo(-7, -3.5);
    ctx.lineTo(-7, 3.5);
    ctx.lineTo(1.5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Orange band & brass fuse nose
    ctx.fillStyle = tier >= 4 ? '#EF4444' : '#F97316';
    ctx.fillRect(-7, -2.6, 3.2, 5.2);
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(5.5, -1.8);
    ctx.lineTo(5.5, 1.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawWorldEffects(
    ctx: CanvasRenderingContext2D,
    effects: readonly VisualEffect[]
  ): void {
    for (let i = 0; i < effects.length; i++) {
      const fx = effects[i];
      if (fx.kind === 'damage_text') continue;

      const ratio = Math.max(0, fx.life / fx.maxLife);
      const progress = 1 - ratio;

      ctx.save();
      ctx.globalAlpha = ratio;

      if (fx.kind === 'muzzle') {
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.angle);
        const stretch = 1 + progress * 0.35;
        // Outer orange/amber star burst
        ctx.fillStyle = fx.secondaryColor ?? '#FB923C';
        ctx.beginPath();
        ctx.moveTo(-2, -3.5);
        ctx.lineTo(fx.size * stretch, -5.5);
        ctx.lineTo(fx.size * 0.72, -1.8);
        ctx.lineTo(fx.size * 1.22 * stretch, 0);
        ctx.lineTo(fx.size * 0.72, 1.8);
        ctx.lineTo(fx.size * stretch, 5.5);
        ctx.lineTo(-2, 3.5);
        ctx.closePath();
        ctx.fill();

        // Bright white-gold core
        ctx.fillStyle = fx.color;
        ctx.beginPath();
        ctx.moveTo(0, -1.8);
        ctx.lineTo(fx.size * 0.82 * stretch, 0);
        ctx.lineTo(0, 1.8);
        ctx.closePath();
        ctx.fill();
      } else if (fx.kind === 'smoke') {
        ctx.translate(fx.x, fx.y);
        const r = fx.size * (0.7 + progress * 0.9);
        ctx.fillStyle = fx.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (fx.kind === 'debris') {
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.angle + progress * 4);
        ctx.fillStyle = fx.color;
        ctx.fillRect(-fx.size, -fx.size * 0.45, fx.size * 2, fx.size * 0.9);
      } else if (fx.kind === 'hit_ring') {
        ctx.translate(fx.x, fx.y);
        const r = fx.size * (0.55 + progress * 0.65);
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = Math.max(1, 2.4 * ratio);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === 'impact') {
        ctx.translate(fx.x, fx.y);
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 2;
        const r = fx.size * (0.35 + progress * 0.9);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 4 + fx.angle;
          ctx.moveTo(Math.cos(a) * -r * 0.35, Math.sin(a) * -r * 0.35);
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();

        if (progress < 0.45) {
          ctx.fillStyle = '#FFFBEB';
          ctx.beginPath();
          ctx.arc(0, 0, fx.size * 0.28 * (1 - progress), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fx.kind === 'tracer') {
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = fx.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.tx, fx.ty);
        ctx.stroke();
      } else if (fx.kind === 'rail_beam') {
        // Outer cyan ionized glow
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = Math.max(1.5, fx.size * 2.2 * ratio);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.tx, fx.ty);
        ctx.stroke();

        // Crisp white-hot beam core
        ctx.strokeStyle = fx.secondaryColor ?? '#ECFEFF';
        ctx.lineWidth = Math.max(1, fx.size * 0.7 * ratio);
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.tx, fx.ty);
        ctx.stroke();

        // Subtle perpendicular capacitor ticks near muzzle
        const nx = -Math.sin(fx.angle);
        const ny = Math.cos(fx.angle);
        const dx = Math.cos(fx.angle);
        const dy = Math.sin(fx.angle);
        ctx.strokeStyle = 'rgba(165, 243, 252, 0.75)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let t = 1; t <= 3; t++) {
          const dist = t * 42;
          const tickHalf = (8 - t * 1.5) * ratio;
          const px = fx.x + dx * dist;
          const py = fx.y + dy * dist;
          ctx.moveTo(px - nx * tickHalf, py - ny * tickHalf);
          ctx.lineTo(px + nx * tickHalf, py + ny * tickHalf);
        }
        ctx.stroke();
      } else if (fx.kind === 'lightning_arc' && fx.points && fx.points.length >= 2) {
        const seed = fx.seed ?? 1;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const drawBolt = (strokeStyle: string, lineWidth: number) => {
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(fx.points![0].x, fx.points![0].y);
          for (let p = 1; p < fx.points!.length; p++) {
            const prev = fx.points![p - 1];
            const curr = fx.points![p];
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const j1 = (hash01(seed, p * 3 + 1) - 0.5) * 20;
            const j2 = (hash01(seed, p * 3 + 2) - 0.5) * 18;
            ctx.lineTo(prev.x + dx * 0.34 + nx * j1, prev.y + dy * 0.34 + ny * j1);
            ctx.lineTo(prev.x + dx * 0.68 + nx * j2, prev.y + dy * 0.68 + ny * j2);
            ctx.lineTo(curr.x, curr.y);
          }
          ctx.stroke();
        };

        drawBolt(fx.color, 3.6);
        drawBolt(fx.secondaryColor ?? '#E0F2FE', 1.4);
      } else if (fx.kind === 'flame_cone') {
        const half = fx.coneHalfAngle ?? 0.45;
        const seed = fx.seed ?? 1;
        const flicker = 0.92 + hash01(seed, Math.floor(progress * 6)) * 0.14;
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.angle);

        const len = fx.size * (0.86 + progress * 0.22) * flicker;
        // Layer 1: Outer crimson-orange wash
        ctx.fillStyle = 'rgba(234, 88, 12, 0.42)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, len, -half, half);
        ctx.closePath();
        ctx.fill();

        // Layer 2: Mid-cone flickering tongues
        ctx.fillStyle = 'rgba(249, 115, 22, 0.58)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, len * 0.82, -half * 0.78, half * 0.78);
        ctx.closePath();
        ctx.fill();

        // Layer 3: Inner bright amber-white core
        ctx.fillStyle = 'rgba(253, 224, 71, 0.78)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, len * 0.54, -half * 0.46, half * 0.46);
        ctx.closePath();
        ctx.fill();
      } else if (fx.kind === 'blast_ring') {
        ctx.translate(fx.x, fx.y);
        const radius = fx.size * (0.4 + progress * 0.66);

        ctx.fillStyle =
          fx.style === 'mine'
            ? 'rgba(163, 230, 53, 0.16)'
            : fx.style === 'boss'
              ? 'rgba(244, 63, 94, 0.2)'
              : 'rgba(249, 115, 22, 0.18)';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = fx.color;
        ctx.lineWidth = Math.max(1.2, 2.8 * ratio);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === 'explosion') {
        ctx.translate(fx.x, fx.y);
        const radius = fx.size * (0.35 + progress * 1.05);

        // Initial bright core flash (first 35% of life)
        if (progress < 0.35) {
          const flashAlpha = (1 - progress / 0.35) * 0.88;
          ctx.fillStyle = `rgba(255, 251, 235, ${flashAlpha})`;
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }

        // Translucent fireball core (stays subtle so enemies/HP stay legible)
        ctx.fillStyle =
          fx.style === 'boss'
            ? 'rgba(244, 63, 94, 0.38)'
            : fx.style === 'mine'
              ? 'rgba(250, 204, 21, 0.38)'
              : 'rgba(249, 115, 22, 0.36)';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
        ctx.fill();

        // Crisp shockwave ring
        ctx.strokeStyle = fx.style === 'boss' ? '#FDA4AF' : '#FBBF24';
        ctx.lineWidth = Math.max(1.2, (fx.style === 'boss' ? 3.2 : 2.3) * ratio);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Radial shrapnel rays
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 1.6;
        const rayCount = fx.style === 'boss' ? 8 : 6;
        ctx.beginPath();
        for (let s = 0; s < rayCount; s++) {
          const a = fx.angle + (s * Math.PI * 2) / rayCount;
          const r1 = radius * 0.45;
          const r2 = radius * (1.05 + (s % 2) * 0.16);
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        }
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawDamageNumbers(
    ctx: CanvasRenderingContext2D,
    effects: readonly VisualEffect[]
  ): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < effects.length; i++) {
      const fx = effects[i];
      if (fx.kind !== 'damage_text' || fx.value === undefined) continue;

      const ratio = Math.max(0, fx.life / fx.maxLife);
      const progress = 1 - ratio;
      const alpha = ratio > 0.25 ? 1 : ratio / 0.25;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (fx.isCrit) {
        const pop = progress < 0.18 ? 1 + (0.18 - progress) * 1.4 : 1;
        ctx.translate(fx.x, fx.y);
        ctx.scale(pop, pop);
        ctx.font = '800 14px "JetBrains Mono", monospace';
        const label = `-${fx.value}!`;
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(10, 12, 16, 0.92)';
        ctx.strokeText(label, 0, 0);
        ctx.fillStyle = fx.color;
        ctx.fillText(label, 0, 0);
      } else {
        ctx.font = '700 11.5px "JetBrains Mono", monospace';
        const label = `-${fx.value}`;
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = 'rgba(10, 12, 16, 0.88)';
        ctx.strokeText(label, fx.x, fx.y);
        ctx.fillStyle = fx.color;
        ctx.fillText(label, fx.x, fx.y);
      }

      ctx.restore();
    }

    ctx.restore();
  }
}
