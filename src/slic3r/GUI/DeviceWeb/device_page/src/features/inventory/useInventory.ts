import { useCallback, useEffect, useRef, useState } from 'react';
import { parseReply } from './types';
import type { Command, Inventory, Reply } from './types';
export type SaveState = { kind: 'loading' | 'ready' | 'pending' | 'saved' | 'changed' } | { kind: 'failed'; error: string; operation: 'save' | 'refresh' };
export type InventoryRequest = <P = unknown, R = unknown>(params?: P, timeoutMs?: number) => Promise<{ok: true; value: R} | {ok: false; error: string}>;
export function useInventory(request: InventoryRequest) {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [theme, setTheme] = useState('dark');
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const [status, setStatus] = useState<SaveState>({kind: 'loading'});
  const [undo, setUndo] = useState<string | null>(null);
  const busy = useRef(false);
  const refreshing = useRef<Promise<void> | null>(null);
  const revision = useRef('');
  const retry = useRef<{serialized: string; id: string} | null>(null);
  const exchange = useCallback(async (payload: Record<string, unknown>): Promise<Reply> => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('inventory-demo')) {
      const response = await fetch('http://127.0.0.1:8875/api', { method: 'POST', body: JSON.stringify(payload) });
      return parseReply({error_code: 0, payload: await response.json()});
    }
    const result = await request<Record<string, unknown>, unknown>({module: 'filament', submod: 'inventory', action: payload.command ? 'exchange' : 'init', payload}, 10000);
    if (!result.ok) throw new Error(result.error);
    return parseReply(result.value);
  }, [request]);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    if (refreshing.current) return refreshing.current;
    const task = (async () => {
    try {
      const reply = await exchange({version: 1});
      if (reply.enabled === false) { setEnabled(false); return; }
      if (reply.theme) setTheme(reply.theme);
      if (reply.inventory) {
        const changed = revision.current !== '' && revision.current !== reply.inventory.revision;
        revision.current = reply.inventory.revision;
        setInventory(reply.inventory);
        setStatus(s => s.kind === 'loading' || (s.kind === 'failed' && s.operation === 'refresh') ? {kind: 'ready'} : changed && s.kind !== 'failed' ? {kind: 'changed'} : s);
      }
    } catch (error) {
      setStatus({kind: 'failed', operation: 'refresh', error: error instanceof Error ? error.message : 'Inventory unavailable'});
    } finally { refreshing.current = null; }
    })();
    refreshing.current = task;
    return task;
  }, [exchange]);
  useEffect(() => { void refresh(); const timer = setInterval(() => { void refresh(); }, 3000); return () => clearInterval(timer); }, [refresh]);
  const commit = useCallback(async (command: Command): Promise<Reply | null> => {
    if (busy.current) return null;
    busy.current = true;
    await refreshing.current;
    setStatus({kind: 'pending'});
    const serialized = JSON.stringify(command);
    // Reuse the key after an uncertain acknowledgement, never duplicate a create.
    if (retry.current?.serialized !== serialized) retry.current = {serialized, id: crypto.randomUUID()};
    try {
      const reply = await exchange({version: 1, request_id: retry.current.id, command});
      if (reply.inventory) { revision.current = reply.inventory.revision; setInventory(reply.inventory); }
      setStatus({kind: 'saved'});
      setUndo(command.op === 'undo' ? null : reply.event_id ?? null);
      retry.current = null;
      return reply;
    } catch (error) {
      setStatus({kind: 'failed', operation: 'save', error: error instanceof Error ? error.message : 'Could not save'});
      return null;
    } finally { busy.current = false; }
  }, [exchange]);
  return {inventory, enabled, theme, status, commit, refresh, undo};
}
