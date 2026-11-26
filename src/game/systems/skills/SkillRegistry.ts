import { SkillDefinition, SkillId } from '../../types';
import { CombatSkillModule } from './BaseSkill';
import { CannonSkill } from './CannonSkill';
import { FlameThrowerSkill } from './FlameThrowerSkill';
import { LandmineSkill } from './LandmineSkill';
import { MachineGunSkill } from './MachineGunSkill';
import { MortarSkill } from './MortarSkill';
import { RailgunSkill } from './RailgunSkill';
import { RocketBarrageSkill } from './RocketBarrageSkill';
import { TeslaSkill } from './TeslaSkill';

export class SkillRegistry {
  private readonly modules = new Map<SkillId, CombatSkillModule>();

  constructor() {
    const all: CombatSkillModule[] = [
      new CannonSkill(),
      new MachineGunSkill(),
      new RocketBarrageSkill(),
      new MortarSkill(),
      new RailgunSkill(),
      new FlameThrowerSkill(),
      new TeslaSkill(),
      new LandmineSkill(),
    ];

    for (let i = 0; i < all.length; i++) {
      this.modules.set(all[i].definition.id, all[i]);
    }
  }

  getModule(id: SkillId): CombatSkillModule | undefined {
    return this.modules.get(id);
  }

  getDefinition(id: SkillId): SkillDefinition | undefined {
    return this.modules.get(id)?.definition;
  }

  getAllDefinitions(): SkillDefinition[] {
    return Array.from(this.modules.values()).map((m) => m.definition);
  }
}

export const skillRegistry = new SkillRegistry();
