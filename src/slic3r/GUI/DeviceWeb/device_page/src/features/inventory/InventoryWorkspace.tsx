import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { CSSProperties, FormEvent } from 'react';
import { Spool } from './Spool';
import { isLow, mass, percent, sourceLabel } from './types';
import type { Command, Details, Inventory, Roll, Stock } from './types';
import { useInventory } from './useInventory';
import type { SaveState } from './useInventory';
import './inventory.css';

type Client = ReturnType<typeof useInventory>;
type Draft = {kind: 'add'} | {kind: 'details' | 'stock' | 'move' | 'archive'; roll: Roll};
type Filter = 'storage' | 'all' | 'loaded' | 'low' | 'unknown' | 'archived';
const filters = [{id: 'storage', label: 'Storage'}, {id: 'all', label: 'All rolls'}, {id: 'loaded', label: 'Loaded'},
  {id: 'low', label: 'Low stock'}, {id: 'unknown', label: 'Unknown'}, {id: 'archived', label: 'Archived'}] satisfies {id: Filter; label: string}[];
const statusText: Record<Exclude<SaveState['kind'], 'failed'>, string> = {
  loading: 'Opening shared inventory…', ready: 'Shared inventory', pending: 'Saving…', saved: 'Saved locally', changed: 'Changed elsewhere · refreshed',
};
function preference(key: string, fallback: string): string { try { return localStorage.getItem('inventory.' + key) ?? fallback; } catch { return fallback; } }
function remember(key: string, value: string) { try { localStorage.setItem('inventory.' + key, value); } catch { /* Private mode still works. */ } }
function material(roll: Roll) { return [roll.material, roll.finish].filter(Boolean).join(' · ') || 'Material not set'; }
function Bar({roll}: {roll: Roll}) {
  return <div className={`inventory-bar ${roll.remaining === null ? 'unknown' : ''}`} aria-hidden="true" style={{'--roll-color': roll.color, '--fill': `${Math.min(100, Math.max(0, Number(roll.percent ?? 0)))}%`} as CSSProperties}><span/></div>;
}
function SlotRack({inventory, selected, select}: {inventory: Inventory; selected: string; select: (id: string) => void}) {
  return <section aria-labelledby="slots-heading"><div className="inventory-section-heading"><h2 id="slots-heading">AMS 1</h2><span>Inventory assignments</span></div>
    <div className="inventory-slots">{[1,2,3,4].map(slot => {
      const roll = inventory.rolls.find(r => r.slot === slot && !r.archived);
      return roll ? <button key={slot} className={`inventory-slot ${selected === roll.id ? 'selected' : ''}`} onClick={() => select(roll.id)} aria-pressed={selected === roll.id}>
        <div className="inventory-slot-info"><span className="inventory-muted">Slot {slot}</span><strong>{roll.name}</strong><span className="inventory-muted">{material(roll)}</span></div>
        <Spool color={roll.color} empty={roll.remaining !== null && Number(roll.remaining) === 0}/><div className="inventory-slot-balance"><Bar roll={roll}/><div><span>{mass(roll.remaining)}</span><span>{percent(roll)}</span></div></div>
      </button> : <div className="inventory-slot unassigned" key={slot}><div><span className="inventory-muted">Slot {slot}</span><strong>Unassigned</strong><span className="inventory-muted">Choose a roll below to assign</span></div></div>;
    })}</div></section>;
}
function ActivityTimeline({roll, client}: {roll: Roll; client: Client}) {
  return <section className="inventory-detail-section"><h3>Recent activity</h3>{roll.history.length ? <ol className="inventory-timeline">{roll.history.map(event => <li key={event.id}><strong>{event.summary}</strong><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>{(event.before || event.after) && <details><summary>Before and after</summary><p>{event.before || 'Not recorded'}</p><p>→ {event.after || 'Not recorded'}</p></details>}{event.undoable && <button disabled={client.status.kind === 'pending'} onClick={() => { void client.commit({op: 'undo', event_id: event.id}); }}>Undo this change</button>}</li>)}</ol> : <p className="inventory-help">Earlier balance evidence is retained below. New changes appear here.</p>}
    <details className="inventory-evidence"><summary>Balance evidence</summary><p>{roll.evidence}</p></details></section>;
}
function RollDetails({roll, edit, client}: {roll: Roll; edit: (draft: Draft) => void; client: Client}) {
  const disabled = client.status.kind === 'pending';
  return <aside className="inventory-detail" aria-labelledby="roll-heading"><div className="inventory-detail-top"><Spool color={roll.color} empty={roll.remaining !== null && Number(roll.remaining) === 0}/><div><h2 id="roll-heading" tabIndex={-1}>{roll.name}</h2><p className="inventory-muted">{material(roll)}</p><span className="inventory-id">{roll.id}</span></div></div>
    <section className="inventory-detail-section"><p className="inventory-muted">Remaining filament</p><div className="inventory-weight" title={roll.remaining ?? 'Unknown'}>{mass(roll.remaining)} <small>{roll.capacity ? `/ ${mass(roll.capacity)}` : ''}</small></div><Bar roll={roll}/><p className="inventory-help">{sourceLabel[roll.source]}{roll.percent !== null ? ` · ${percent(roll)} of original capacity` : ''}{roll.balance_date ? ` · ${roll.balance_date}` : ''}</p>
      {!roll.archived && <button className="full" disabled={disabled} onClick={() => edit({kind: 'stock', roll})}>Update amount</button>}</section>
    <section className="inventory-detail-section"><h3>Location</h3><p className="inventory-muted">{roll.archived ? 'Archived' : roll.slot ? `AMS 1 · Slot ${roll.slot}` : 'Storage'}</p>
      {roll.archived ? <button className="full" disabled={disabled} onClick={() => { void client.commit({op: 'restore', id: roll.id, expected: roll}); }}>Restore to Storage</button> : <button className="full" disabled={disabled} onClick={() => edit({kind: 'move', roll})}>Assign to slot / Storage</button>}
      <p className="inventory-help">Assignment records where a roll belongs. Physical Load uses the printer’s controls.</p></section>
    <section className="inventory-detail-section"><h3>Roll details</h3><dl><dt>Material</dt><dd>{roll.material || 'Not set'}</dd><dt>Brand</dt><dd>{roll.brand || 'Not set'}</dd><dt>Finish</dt><dd>{roll.finish || 'Not set'}</dd><dt>Original capacity</dt><dd>{mass(roll.capacity)}</dd><dt>Empty-spool tare</dt><dd>{mass(roll.tare)}</dd><dt>Slicing profile ID</dt><dd>{roll.profile || 'Not selected'}</dd></dl>
      <button className="full" disabled={disabled} onClick={() => edit({kind: 'details', roll})}>Edit details</button>
      {roll.purchase_url && <a className="inventory-shop" href={roll.purchase_url} target="_blank" rel="noreferrer">Open purchase link ↗</a>}
      {!roll.archived && <button className="inventory-quiet full" disabled={disabled} onClick={() => edit({kind: 'archive', roll})}>Archive roll</button>}</section><ActivityTimeline roll={roll} client={client}/></aside>;
}
function Editor({draft, close, client, select}: {draft: Draft; close: () => void; client: Client; select: (id: string) => void}) {
  const formRef = useRef<HTMLFormElement>(null);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [base, setBase] = useState(draft.kind === 'add' ? null : draft.roll);
  const [source, setSource] = useState<Stock['source']>(draft.kind === 'add' ? 'nominal' : 'estimate');
  const [destination, setDestination] = useState(base?.slot ? `AMS 1 slot ${base.slot}` : 'Storage');
  const [error, setError] = useState('');
  const current = base ? client.inventory?.rolls.find(r => r.id === base.id) : null;
  const stale = !!base && !!current && base.revision !== current.revision;
  const occupant = client.inventory?.rolls.find(r => r.location === destination && r.id !== base?.id);
  const title = {add: 'Add a physical roll', details: 'Edit roll details', stock: 'Update remaining filament', move: 'Assign inventory location', archive: 'Archive this roll?'}[draft.kind];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? '').trim();
    const stock: Stock = {source, remaining: text('remaining') || null, tare: text('tare') || null};
    let command: Command;
    if (draft.kind === 'add' || draft.kind === 'details') {
      const values: Details = {name: text('name'), material: text('material'), brand: text('brand'), finish: text('finish'), profile: text('profile'), color: text('color'), purchase_url: text('purchase_url')};
      if (draft.kind === 'add') command = {op: 'add', details: values, capacity: text('capacity') || null, stock};
      else {
        if (!base) return;
        const changed: Partial<Details> = {};
        for (const key of ['name','material','brand','finish','profile','color','purchase_url'] as const) if (values[key] !== base[key]) changed[key] = values[key];
        command = {op: 'details', id: base.id, expected: base, details: changed};
      }
    } else {
      if (!base) return;
      command = draft.kind === 'stock' ? {op: 'stock', id: base.id, expected: base, stock}
        : draft.kind === 'archive' ? {op: 'archive', id: base.id, expected: base}
        : {op: 'move', id: base.id, expected: base, location: destination, occupant: occupant?.id ?? null, swap: text('swap') === 'swap'};
    }
    const reply = await client.commit(command);
    if (reply) { if (reply.created_id) select(reply.created_id); close(); }
    else setError('Save was not acknowledged. Your draft is retained. Review the message above, then retry.');
  }
  const stockFields = <><label>Amount source<select value={source} onChange={e => setSource(e.target.value as Stock['source'])}>
    {draft.kind === 'add' && <option value="nominal">New unopened roll · nominal full</option>}<option value="estimate">My estimate in grams</option><option value="percent">My estimate in percent</option><option value="measured">Measured net filament</option><option value="gross">Measured gross spool weight</option><option value="unknown">Unknown amount</option></select></label>
    {source !== 'unknown' && source !== 'nominal' && <label>{source === 'percent' ? 'Percent remaining' : source === 'gross' ? 'Gross spool weight, grams' : 'Net filament, grams'}<input name="remaining" type="number" min="0" max={source === 'percent' ? '100' : '100000'} step="any" required defaultValue={source === 'percent' ? base?.percent ?? '' : source === 'gross' ? '' : base?.remaining ?? ''} key={source}/></label>}
    {source === 'gross' && <label>Known empty-spool tare, grams<input name="tare" type="number" min="0" max="100000" step="any" required defaultValue={base?.tare ?? ''}/></label>}
    <p className="inventory-help">{source === 'nominal' ? 'Uses original net capacity. A new roll is nominal until weighed.' : source === 'gross' ? 'Net filament = gross spool weight − known tare.' : source === 'measured' ? 'Enter filament mass with the empty-spool tare already removed.' : source === 'unknown' ? 'Keeps an unknown amount visibly distinct from an empty roll.' : 'This records an estimate and retains the previous evidence.'}</p></>;
  return <Dialog.Root open onOpenChange={open => { if (!open && client.status.kind !== 'pending') close(); }}><Dialog.Portal><Dialog.Overlay className="inventory-overlay"/><Dialog.Content data-theme={client.theme} className="inventory-modal" aria-describedby="inventory-form-description" onCloseAutoFocus={e => { e.preventDefault(); opener.current?.focus({preventScroll: true}); }} onOpenAutoFocus={e => { e.preventDefault(); formRef.current?.querySelector<HTMLElement>('input,select,button')?.focus(); }}>
    <Dialog.Title>{title}</Dialog.Title><Dialog.Description id="inventory-form-description">{base ? `${base.name} · ${base.id}` : 'Each physical roll receives a separate ID in Storage.'}</Dialog.Description>
    {stale && <div className="inventory-alert"><p>Changed elsewhere. Current amount: {mass(current.remaining)}. Current location: {current.location}.</p><button onClick={() => setBase(current)}>Keep draft and use this current state</button></div>}
    <form ref={formRef} onSubmit={event => { void submit(event); }}>
      {(draft.kind === 'add' || draft.kind === 'details') && <><div className="inventory-form-grid"><label>Roll name<input name="name" required maxLength={60} defaultValue={base?.name ?? ''} placeholder="For example, Bone"/></label><label>Color<input name="color" type="color" defaultValue={base?.color ?? '#d6c9b0'}/></label></div>
        <div className="inventory-form-grid"><label>Material<input name="material" maxLength={80} defaultValue={base?.material ?? ''} placeholder="PLA, PETG, or unknown"/></label><label>Brand<input name="brand" maxLength={80} defaultValue={base?.brand ?? ''} placeholder="Optional"/></label></div>
        <label>Finish<input name="finish" maxLength={80} defaultValue={base?.finish ?? ''} placeholder="Silk, matte, or leave blank"/></label>
        {draft.kind === 'add' && <><label>Original net capacity, grams<input name="capacity" type="number" min="0.001" max="100000" step="any" defaultValue="1000" placeholder="Leave blank if unknown"/></label>{stockFields}</>}
        <details><summary>Profile and purchase link</summary><label>Slicing profile ID<input name="profile" maxLength={200} defaultValue={base?.profile ?? ''} placeholder="Optional; independent of material"/></label><label>Purchase link<input name="purchase_url" type="url" maxLength={200} defaultValue={base?.purchase_url ?? ''} placeholder="https://…"/></label></details></>}
      {draft.kind === 'stock' && stockFields}
      {draft.kind === 'move' && <><label>Destination<select value={destination} onChange={e => setDestination(e.target.value)}><option>Storage</option>{[1,2,3,4].map(i => <option key={i}>AMS 1 slot {i}</option>)}</select></label>
        {occupant && <><p className="inventory-help">{occupant.name} ({occupant.id}) currently occupies this slot.</p><label>When assigning<select name="swap"><option value="storage">Move {occupant.name} to Storage</option>{!!base?.slot && <option value="swap">Swap their inventory slots</option>}</select></label></>}
        <p className="inventory-help">This saves inventory assignments. It does not move filament.</p></>}
      {draft.kind === 'archive' && <p>This roll leaves the active inventory. Its balance, physical ID and history are retained. You can restore it from Archived.</p>}
      {client.status.kind === 'failed' && <p className="inventory-form-error" role="alert">{client.status.error}</p>}{error && <p className="inventory-form-error" role="alert">{error}</p>}
      <div className="inventory-dialog-actions"><button type="button" disabled={client.status.kind === 'pending'} onClick={close}>Cancel</button><button className="primary" disabled={client.status.kind === 'pending'}>{client.status.kind === 'pending' ? 'Saving…' : draft.kind === 'archive' ? 'Archive roll' : 'Save locally'}</button></div>
    </form></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function InventoryWorkspace({client}: {client: Client}) {
  const [selected, setSelected] = useState(() => preference('selected', 'BONE-001'));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(() => { const value = preference('filter', 'storage'); return filters.find(f => f.id === value)?.id ?? 'storage'; });
  const [sort, setSort] = useState(() => preference('sort', 'name'));
  const [density, setDensity] = useState(() => preference('density', 'comfortable'));
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const inventory = client.inventory;
  const chosen = inventory?.rolls.find(r => r.id === selected) ?? inventory?.rolls.find(r => !r.archived);
  useEffect(() => { remember('selected', selected); }, [selected]);
  useEffect(() => { remember('filter', filter); setPage(0); }, [filter]);
  useEffect(() => { remember('sort', sort); setPage(0); }, [sort]);
  useEffect(() => { remember('density', density); }, [density]);
  useEffect(() => { setPage(0); }, [query]);
  const rolls = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return (inventory?.rolls ?? []).filter(r => filter === 'archived' ? r.archived : !r.archived)
      .filter(r => filter === 'storage' ? !r.slot : filter === 'loaded' ? !!r.slot : filter === 'low' ? isLow(r) : filter === 'unknown' ? r.remaining === null : true)
      .filter(r => [r.name, r.id, r.material, r.brand, r.finish].join(' ').toLocaleLowerCase().includes(search))
      .sort((a,b) => sort === 'remaining' ? (a.remaining === null ? Infinity : Number(a.remaining)) - (b.remaining === null ? Infinity : Number(b.remaining)) || a.id.localeCompare(b.id)
        : sort === 'material' ? a.material.localeCompare(b.material) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }, [inventory, filter, query, sort]);
  const actualPage = Math.min(page, Math.max(0, Math.ceil(rolls.length / 50) - 1));
  function select(id: string) { setSelected(id); if (window.innerWidth < 1024) requestAnimationFrame(() => { const heading = document.getElementById('roll-heading'); heading?.focus({preventScroll: true}); heading?.scrollIntoView({block: 'start'}); }); }
  return <main className={`inventory-workspace ${density}`} data-theme={client.theme}>
    <header className="inventory-header"><div><h1>Filament inventory</h1><p className="inventory-muted">Your rolls, shared with the desktop widget.</p></div><div className="inventory-header-actions"><span role="status" className={`inventory-status ${client.status.kind === 'failed' ? 'failed' : ''}`}><i/>{client.status.kind === 'failed' ? client.status.operation === 'save' ? 'Could not save' : 'Could not refresh' : statusText[client.status.kind]}</span><button className="primary" disabled={!inventory || client.status.kind === 'pending'} onClick={() => setDraft({kind: 'add'})}>+ Add roll</button></div></header>
    {client.status.kind === 'failed' && <div className="inventory-alert" role="alert"><span>{client.status.error}</span><button onClick={() => { void client.refresh(); }}>Retry refresh</button></div>}
    {inventory ? <><SlotRack inventory={inventory} selected={chosen?.id ?? ''} select={select}/><div className="inventory-workspace-grid"><section className="inventory-list" aria-labelledby="inventory-list-heading"><div className="inventory-section-heading"><h2 id="inventory-list-heading">{filter === 'storage' ? 'Stored rolls' : filters.find(f => f.id === filter)?.label}</h2><label className="inventory-density"><span className="inventory-sr-only">Row density</span><select value={density} onChange={e => setDensity(e.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></div>
      <div className="inventory-filters" aria-label="Inventory filter">{filters.map(f => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div>
      <div className="inventory-list-tools"><input type="search" aria-label="Search rolls" placeholder="Search name, material, brand or ID" value={query} onChange={e => setQuery(e.target.value)}/><select aria-label="Sort rolls" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name</option><option value="remaining">Remaining amount</option><option value="material">Material</option></select></div>
      <div className="inventory-table-shell"><table><thead><tr><th scope="col">Physical roll</th><th scope="col">Remaining</th><th scope="col" className="inventory-location-col">Location</th></tr></thead><tbody>{rolls.slice(actualPage*50, actualPage*50+50).map(roll => <tr key={roll.id} className={chosen?.id === roll.id ? 'selected' : ''}><td><div className="inventory-row-name"><Spool color={roll.color} empty={roll.remaining !== null && Number(roll.remaining) === 0}/><button className="inventory-roll-button" onClick={() => select(roll.id)} aria-pressed={chosen?.id === roll.id}>{roll.name}<span>{material(roll)}</span><span className="inventory-id">{roll.id}</span></button></div></td><td><strong title={roll.remaining ?? 'Unknown'}>{mass(roll.remaining)}</strong><span className="inventory-row-source">{sourceLabel[roll.source]}{roll.percent !== null ? ` · ${percent(roll)}` : ''}</span><Bar roll={roll}/></td><td className="inventory-location-col"><span className={`inventory-badge ${isLow(roll) ? 'low' : ''}`}>{roll.archived ? 'Archived' : roll.slot ? `AMS 1 · Slot ${roll.slot}` : isLow(roll) ? 'Storage · Low' : 'Storage'}</span></td></tr>)}</tbody></table>
      {!rolls.length && <div className="inventory-empty"><p>No matching rolls.</p><button onClick={() => { setQuery(''); setFilter('all'); }}>Show all active rolls</button></div>}
      <div className="inventory-table-foot"><span>{rolls.length} {rolls.length === 1 ? 'roll' : 'rolls'}{rolls.length > 50 ? ` · ${actualPage*50+1}–${Math.min(rolls.length, actualPage*50+50)} shown` : ''}</span>{rolls.length > 50 && <div><button disabled={actualPage === 0} onClick={() => setPage(actualPage-1)}>Previous</button><button disabled={(actualPage+1)*50 >= rolls.length} onClick={() => setPage(actualPage+1)}>Next</button></div>}</div></div>
      <p className="inventory-help">One row per physical roll. Amounts retain their recorded source and precision.</p></section>
      {chosen && <RollDetails roll={chosen} edit={setDraft} client={client}/>}</div>
      <details className="inventory-connection"><summary>Connections and inventory source</summary><p>Studio and the desktop widget read the same local register. Bambu cloud login is optional for inventory editing. A separate read-only stock reader may report estimates; no cloud write or printer Load is performed here.</p><p>Last read: {new Date(inventory.read_at).toLocaleTimeString()}</p></details></> : <p className="inventory-empty">{client.status.kind === 'failed' ? 'Your saved inventory is retained. Retry when the local backend is available.' : 'Opening inventory…'}</p>}
    {client.undo && <div className="inventory-toast" role="status"><span>Change saved locally.</span><button disabled={client.status.kind === 'pending'} onClick={() => { if (client.undo) void client.commit({op: 'undo', event_id: client.undo}); }}>Undo</button></div>}
    {draft && <Editor draft={draft} close={() => setDraft(null)} client={client} select={select}/>}</main>;
}
