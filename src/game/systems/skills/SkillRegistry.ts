import { SkillDefinition, SkillId } from '../../types';
import { AcidShellsSkill } from './AcidShellsSkill';
import { CombatSkillModule } from './BaseSkill';
import { CannonSkill } from './CannonSkill';
import { ClusterBombsSkill } from './ClusterBombsSkill';
import { DroneSquadronSkill } from './DroneSquadronSkill';
import { FlameThrowerSkill } from './FlameThrowerSkill';
import { FrostCannonSkill } from './FrostCannonSkill';
import { GatlingOverdriveSkill } from './GatlingOverdriveSkill';
import { HunterMissilesSkill } from './HunterMissilesSkill';
import { LandmineSkill } from './LandmineSkill';
import { LaserArraySkill } from './LaserArraySkill';
import { MachineGunSkill } from './MachineGunSkill';
import { MortarSkill } from './MortarSkill';
import { OrbitalStrikeSkill } from './OrbitalStrikeSkill';
import { PiercingShotSkill } from './PiercingShotSkill';
import { PlasmaCannonSkill } from './PlasmaCannonSkill';
import { RailgunSkill } from './RailgunSkill';
import { RicochetSkill } from './RicochetSkill';
import { RocketBarrageSkill } from './RocketBarrageSkill';
import { SentryTurretSkill } from './SentryTurretSkill';
import { ShieldPulseSkill } from './ShieldPulseSkill';
import { ShockwaveSkill } from './ShockwaveSkill';
import { ShrapnelBurstSkill } from './ShrapnelBurstSkill';
import { TeslaSkill } from './TeslaSkill';
import { ThunderstormSkill } from './ThunderstormSkill';

export class SkillRegistry {
  private readonly modules = new Map<SkillId, CombatSkillModule>();

  constructor() {
    const all: CombatSkillModule[] = [
      // Common
      new CannonSkill(),
      new MachineGunSkill(),
      new LandmineSkill(),
      new PiercingShotSkill(),
      new ShockwaveSkill(),
      // Uncommon
      new RicochetSkill(),
      new FrostCannonSkill(),
      new AcidShellsSkill(),
      new ShrapnelBurstSkill(),
      new ShieldPulseSkill(),
      // Rare
      new RocketBarrageSkill(),
      new MortarSkill(),
      new FlameThrowerSkill(),
      new ClusterBombsSkill(),
      new HunterMissilesSkill(),
      new GatlingOverdriveSkill(),
      // Epic
      new RailgunSkill(),
      new TeslaSkill(),
      new LaserArraySkill(),
      new PlasmaCannonSkill(),
      new SentryTurretSkill(),
      // Legendary
      new DroneSquadronSkill(),
      new OrbitalStrikeSkill(),
      new ThunderstormSkill(),
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
