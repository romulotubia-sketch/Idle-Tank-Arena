import {
  Cpu,
  Crosshair,
  Gauge,
  GripHorizontal,
  Shield,
  Swords,
  Target,
} from 'lucide-react';
import { EquipmentIconId, EquipmentSlotType } from '../game/types';

interface EquipmentIconProps {
  iconId?: EquipmentIconId;
  slot: EquipmentSlotType;
  className?: string;
}

export function EquipmentIcon({
  iconId,
  slot,
  className = 'w-4 h-4 shrink-0',
}: EquipmentIconProps) {
  if (iconId === 'cannon_heavy') return <Swords className={className} />;
  if (iconId === 'cannon_barrel') return <Crosshair className={className} />;
  if (iconId === 'armor_plate') return <Shield className={className} />;
  if (iconId === 'engine_core') return <Gauge className={className} />;
  if (iconId === 'tracks_tread') return <GripHorizontal className={className} />;
  if (iconId === 'targeting_optic') return <Target className={className} />;
  if (iconId === 'aux_capacitor') return <Cpu className={className} />;

  switch (slot) {
    case 'cannon':
      return <Crosshair className={className} />;
    case 'armor':
      return <Shield className={className} />;
    case 'engine':
      return <Gauge className={className} />;
    case 'tracks':
      return <GripHorizontal className={className} />;
    case 'targeting_system':
      return <Target className={className} />;
    case 'auxiliary_system':
      return <Cpu className={className} />;
  }
}
