import { ArenaBounds, Vector2, WorldRect } from '../types';

export class Camera {
  private center: Vector2;
  private logicalWidth: number;
  private logicalHeight: number;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private scale = 1;

  constructor(bounds: ArenaBounds) {
    this.logicalWidth = bounds.width;
    this.logicalHeight = bounds.height;
    this.center = {
      x: bounds.width * 0.5,
      y: bounds.height * 0.5,
    };
  }

  updateViewport(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);

    const scaleX = this.viewportWidth / this.logicalWidth;
    const scaleY = this.viewportHeight / this.logicalHeight;
    this.scale = Math.min(scaleX, scaleY);
  }

  getScale(): number {
    return this.scale;
  }

  getCenter(): Vector2 {
    return { ...this.center };
  }

  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.viewportWidth * 0.5, this.viewportHeight * 0.5);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.center.x, -this.center.y);
  }

  getVisibleWorldBounds(): WorldRect {
    const halfW = (this.viewportWidth * 0.5) / this.scale;
    const halfH = (this.viewportHeight * 0.5) / this.scale;
    return {
      left: this.center.x - halfW,
      top: this.center.y - halfH,
      width: halfW * 2,
      height: halfH * 2,
    };
  }

  worldToScreen(wx: number, wy: number): Vector2 {
    return {
      x: (wx - this.center.x) * this.scale + this.viewportWidth * 0.5,
      y: (wy - this.center.y) * this.scale + this.viewportHeight * 0.5,
    };
  }

  screenToWorld(sx: number, sy: number): Vector2 {
    return {
      x: (sx - this.viewportWidth * 0.5) / this.scale + this.center.x,
      y: (sy - this.viewportHeight * 0.5) / this.scale + this.center.y,
    };
  }
}
