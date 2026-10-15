import { useState } from 'react';
import type { FormEvent } from 'react';
import type { PrintAttempt, Roll } from './types';
import { mass } from './types';
import type { useInventory } from './useInventory';

type Client = ReturnType<typeof useInventory>;
const labels: Record<PrintAttempt['status'], string> = {
  prepared: 'Awaiting start', tracking: 'Tracking print', review: 'Usage needs review',
  applied: 'Grams deducted', recorded: 'Usage recorded, remaining unknown',
  excluded: 'Previously accounted', dismissed: 'Already in current balance',
};

function Reconcile({job, client}: {job: PrintAttempt; client: Client}) {
  const [base, setBase] = useState<Roll[]>(client.inventory?.rolls ?? []);
  const [usage, setUsage] = useState<Record<string, string>>({});
  const [alreadyIncluded, setAlreadyIncluded] = useState(false);
  const [error, setError] = useState('');
  const pending = client.status.kind === 'pending';
  async function save(event: FormEvent) {
    event.preventDefault(); setError('');
    const entries = Object.entries(usage).filter(([, value]) => value.trim() !== '');
    if (!alreadyIncluded && !entries.length) { setError('Enter consumed grams for each roll used, or confirm usage is already included.'); return; }
    const expected = Object.fromEntries(base.filter(roll => entries.some(([id]) => id === roll.id)).map(roll => [roll.id, roll.evidence]));
    const result = await client.commit({op: 'print_reconcile', attempt: job.attempt, expected_updated_at: job.updated_at,
      already_in_balance: alreadyIncluded, usage: Object.fromEntries(entries), expected_balances: expected});
    if (!result) setError('Usage was not saved. Check the error above; refresh balance checks before retrying a changed roll.');
  }
  return <details className="inventory-print-review"><summary>Record or reconcile this print’s usage</summary>
    <form onSubmit={event => { void save(event); }}>
      <p className="inventory-help">For an interrupted print or Auto-Refill, enter the consumed grams for each physical roll. Leave unused rolls blank. Full-job estimates are not split by print progress.</p>
      {job.planned.length > 0 && <p className="inventory-help">Submitted estimates: {job.planned.map(f => `${f.id ?? 'Unassigned slot'} (${mass(f.grams)})`).join(', ')}.</p>}
      <label className="inventory-print-included"><input type="checkbox" checked={alreadyIncluded} disabled={pending} onChange={event => setAlreadyIncluded(event.target.checked)}/> Usage is already included in the current roll balances. Do not deduct again.</label>
      <fieldset disabled={pending || alreadyIncluded}><legend>Consumed filament by physical roll</legend><div className="inventory-print-inputs">{base.map(roll => <label key={roll.id}>{roll.name} <span className="inventory-id">{roll.id}</span><input inputMode="decimal" aria-label={`Consumed grams for ${roll.id}`} placeholder="Unused" value={usage[roll.id] ?? ''} onChange={event => setUsage({...usage, [roll.id]: event.target.value})}/></label>)}</div></fieldset>
      <div className="inventory-dialog-actions"><button type="button" disabled={pending} onClick={() => { setBase(client.inventory?.rolls ?? []); setError(''); }}>Refresh balance checks</button><button type="submit" className="primary" disabled={pending}>{pending ? 'Saving…' : alreadyIncluded ? 'Confirm already included' : 'Record usage once'}</button></div>
      {error && <p className="inventory-form-error" role="alert">{error}</p>}
    </form>
  </details>;
}

export function PrintUsage({client}: {client: Client}) {
  const jobs = client.inventory?.print_jobs ?? [];
  const current = jobs.filter(job => ['prepared', 'tracking', 'review'].includes(job.status));
  const latest = jobs.find(job => !current.includes(job));
  const visible = latest ? [...current, latest] : current;
  const earlier = jobs.filter(job => !visible.includes(job));
  const entry = (job: PrintAttempt) => <details className={`inventory-print-job ${job.status === 'review' ? 'needs-review' : ''}`} key={job.attempt} open={job.status === 'review' || job.status === 'tracking'}>
      <summary><strong>{labels[job.status]}</strong><span>{job.title.replace(/_u[a-f0-9]{12}$/, '')}{job.job_id ? ` · Job ${job.job_id}` : ''}</span></summary>
      <p className="inventory-help">{job.reason}</p>
      {job.allocations.length > 0 && <ul>{job.allocations.map(a => <li key={a.id}>{a.id}: {mass(a.grams)} recorded; {a.remaining === null ? 'remaining unknown' : `${mass(a.remaining)} remaining`}.</li>)}</ul>}
      {job.status === 'review' && <Reconcile job={job} client={client}/>}
    </details>;
  return <section className="inventory-print-usage" aria-labelledby="inventory-print-heading">
    <h2 id="inventory-print-heading">Automatic print usage</h2>
    <p className="inventory-help">Prints sent from this fork deduct the submitted plate’s filament estimates once the matching job finishes. Keep Studio running to receive printer updates. Supports, brim and sliced flushing are included; extra startup or manual purge is unmeasured.</p>
    {!jobs.length && <p className="inventory-help">Ready for the next print. Earlier jobs will not be charged again.</p>}
    {visible.map(entry)}
    {earlier.length > 0 && <details><summary>Earlier usage records ({earlier.length})</summary>{earlier.map(entry)}</details>}
  </section>;
}
