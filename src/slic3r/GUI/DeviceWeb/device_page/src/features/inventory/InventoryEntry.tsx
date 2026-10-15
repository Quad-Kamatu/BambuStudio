import { FilamentManagerPage } from '../filament-manager/FilamentManagerPage';
import { InventoryWorkspace } from './InventoryWorkspace';
import { useDeviceBridge } from '../../hooks/Bridge';
import { useInventory } from './useInventory';
export function InventoryEntry() {
  const request = useDeviceBridge();
  const client = useInventory(request);
  return client.enabled ? <InventoryWorkspace client={client}/> : <FilamentManagerPage/>;
}
