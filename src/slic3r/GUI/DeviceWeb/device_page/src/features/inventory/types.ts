export type Source = 'unknown' | 'nominal' | 'measured' | 'reported' | 'estimate' | 'confirmed';
export type Activity = { id: string; at: string; summary: string; before: string; after: string; undoable: boolean };
export type Roll = {
  id: string; name: string; material: string; brand: string; finish: string; profile: string; color: string;
  capacity: string | null; tare: string | null; remaining: string | null; percent: string | null;
  source: Source; balance_date: string | null; evidence: string; location: string; slot: number;
  archived: boolean; purchase_url: string; revision: string; history: Activity[];
};
export type Inventory = { version: 1; revision: string; rolls: Roll[]; read_at: string;
  capabilities: { local_edit: boolean; undo: boolean; physical_load: boolean } };
export type Details = Pick<Roll, 'name' | 'material' | 'brand' | 'finish' | 'profile' | 'color' | 'purchase_url'>;
export type Stock = { source: Source | 'gross' | 'percent'; remaining: string | null; tare?: string | null };
export type Command =
  | { op: 'add'; details: Details; capacity: string | null; stock: Stock }
  | { op: 'details'; id: string; expected: Roll; details: Partial<Details> }
  | { op: 'stock'; id: string; expected: Roll; stock: Stock }
  | { op: 'move'; id: string; expected: Roll; location: string; occupant: string | null; swap: boolean }
  | { op: 'archive' | 'restore'; id: string; expected: Roll }
  | { op: 'undo'; event_id: string };
export type Reply = { ok: boolean; enabled?: boolean; theme?: string; error?: string; inventory?: Inventory;
  event_id?: string; created_id?: string | null };
export const sourceLabel: Record<Source, string> = {
  confirmed: 'Confirmed empty', unknown: 'Unknown', nominal: 'Nominal', measured: 'Measured', reported: 'Bambu reported estimate', estimate: 'Estimate',
};
export function mass(value: string | null): string {
  if (value === null) return 'Unknown';
  const number = Number(value);
  if (number > 0 && number < .1) return '<0.1 g';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(number)} g`;
}
export function percent(roll: Roll): string {
  if (roll.percent === null) return 'Unknown';
  const value = Number(roll.percent);
  return value > 0 && value < 1 ? '<1%' : `${Math.round(value)}%`;
}
export function isLow(roll: Roll): boolean {
  return roll.remaining !== null && Number(roll.remaining) > 0 && roll.percent !== null && Number(roll.percent) < 20;
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object'; }
function nullableText(value: unknown): value is string | null { return value === null || typeof value === 'string'; }
function isRoll(value: unknown): value is Roll {
  if (!object(value)) return false;
  return ['id', 'name', 'material', 'brand', 'finish', 'profile', 'color', 'evidence', 'location', 'purchase_url', 'revision'].every(k => typeof value[k] === 'string')
    && ['remaining', 'capacity', 'tare', 'percent', 'balance_date'].every(k => nullableText(value[k]))
    && typeof value.slot === 'number' && typeof value.archived === 'boolean'
    && typeof value.source === 'string' && value.source in sourceLabel
    && Array.isArray(value.history) && value.history.every((e: unknown) => object(e) && typeof e.undoable === 'boolean' && ['id', 'at', 'summary', 'before', 'after'].every(k => typeof e[k] === 'string'));
}
export function parseReply(value: unknown): Reply {
  if (!object(value)) throw new Error('Invalid inventory response');
  if (value.error_code !== 0) throw new Error(typeof value.message === 'string' ? value.message : 'Inventory backend unavailable');
  const payload = value.payload;
  if (!object(payload)) throw new Error('Invalid inventory response');
  if (payload.enabled === false) return { ok: true, enabled: false };
  if (payload.ok !== true) throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not save inventory');
  const inventory = payload.inventory;
  if (!object(inventory) || inventory.version !== 1 || typeof inventory.revision !== 'string'
      || typeof inventory.read_at !== 'string' || !Array.isArray(inventory.rolls) || !inventory.rolls.every(isRoll)
      || !object(inventory.capabilities) || typeof inventory.capabilities.local_edit !== 'boolean'
      || typeof inventory.capabilities.undo !== 'boolean' || typeof inventory.capabilities.physical_load !== 'boolean') {
    throw new Error('Inventory data is incompatible; your stock was retained');
  }
  // Validation above covers all fields of the versioned DTO.
  return { ok: true, enabled: true, inventory: inventory as Inventory,
    ...(typeof payload.theme === 'string' ? { theme: payload.theme } : {}),
    ...(typeof payload.event_id === 'string' ? { event_id: payload.event_id } : {}),
    ...(typeof payload.created_id === 'string' ? { created_id: payload.created_id } : {}) };
}
