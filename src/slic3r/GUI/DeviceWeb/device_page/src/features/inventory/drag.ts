import type { DragEvent, HTMLAttributes } from 'react';
import type { Command, Inventory, Roll } from './types';
export const rollDragType = 'application/x-filament-roll';
export type RollDrag = {roll: Roll; inventory: Inventory};
export type DragControls = {
  source: (roll: Roll) => HTMLAttributes<HTMLElement>;
  target: (slot: number) => HTMLAttributes<HTMLElement>;
  active: boolean;
};
export function dropCommand(drag: RollDrag, slot: number): Command | null {
  if (drag.roll.archived || slot === drag.roll.slot || !Number.isInteger(slot) || slot < 0 || slot > 4) return null;
  const occupant = drag.inventory.rolls.find(r => r.slot === slot && !r.archived);
  return {op: 'move', id: drag.roll.id, expected: drag.roll,
    location: slot ? `AMS 1 slot ${slot}` : 'Storage', occupant: slot ? occupant?.id ?? null : null, swap: true};
}
export function isRollDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes(rollDragType);
}
