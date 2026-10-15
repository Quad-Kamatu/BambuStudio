import { createFileRoute } from '@tanstack/react-router';
import { InventoryEntry } from '../features/inventory/InventoryEntry';

export const Route = createFileRoute('/filament_manager')({
  component: InventoryEntry,
});
