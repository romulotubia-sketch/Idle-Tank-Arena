import { INVENTORY_CAPACITY } from '../constants';
import { InventorySlot } from '../types';

export class InventorySystem {
  private readonly capacity: number;
  private slots: InventorySlot[];

  constructor(capacity: number = INVENTORY_CAPACITY) {
    this.capacity = capacity;
    this.slots = Array.from({ length: capacity }, (_, index) => ({
      index,
      itemId: null,
      quantity: 0,
    }));
  }

  getCapacity(): number {
    return this.capacity;
  }

  getSlots(): InventorySlot[] {
    return this.slots.map((slot) => ({ ...slot }));
  }
}
