import { ARENA_BOUNDS } from '../constants';
import { ArenaBounds, Vector2 } from '../types';

export class BattlefieldSystem {
  private bounds: ArenaBounds;

  constructor(bounds: ArenaBounds = ARENA_BOUNDS) {
    this.bounds = { ...bounds };
  }

  getBounds(): ArenaBounds {
    return this.bounds;
  }

  getCenter(): Vector2 {
    return {
      x: this.bounds.width / 2,
      y: this.bounds.height / 2,
    };
  }

  update(_dt: number): void {
    // Future: environmental hazards, weather effects, or dynamic sector shifts
  }
}
