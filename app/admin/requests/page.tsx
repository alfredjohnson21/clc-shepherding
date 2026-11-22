import Link from 'next/link';
import { applyRequest, grantAccess, rejectRequest } from '@/app/admin/actions';
import ConfirmButton from '@/components/ConfirmButton';
import Flash from '@/components/Flash';
import Header from '@/components/Header';
import { treeOrder } from '@/components/PersonForm';
import { requireSuper } from '@/lib/auth';
import { loadProfiles } from '@/lib/members';
import { dashTitle, dashWho, navFor } from '@/lib/nav';
import { findByPhone, loadRequests, type ProfileRequest } from '@/lib/selfserve';
import { getTree, titled, type Tree } from '@/lib/tree';
import { MILESTONES, PERSONAL_FIELDS, type ProfileDetails } from '@/lib/types';
import { fmtDate } from '@/lib/week';

export const dynamic = 'force-dynamic';

const when = (ts: string) => new Date(ts).toLocaleString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const FIELDS = [...PERSONAL_FIELDS.map((f) => ({ key: f.key, label: f.label, date: 'date' in f })), ...MILESTONES.map((m) => ({ key: m.key, label: m.label, date: true }))];
const show = (v: string | undefined, date: boolean) => (v ? (date ? fmtDate(v) : v) : '');

export default async function Requests({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireSuper();
  const sp = await searchParams;
  const tree = await getTree();
  const [pending, editing, recent, profiles] = await Promise.all([
    loadRequests(['access_pending', 'review_pending']),
    loadRequests(['editing']),
    loadRequests(['applied', 'rejected'], 25),
    loadProfiles(),
  ]);

  return (
    <>
      <Header title={dashTitle('super')} who={dashWho('super')} nav={navFor('super')} />
      <main className="page narrow">
        <div className="row between">
          <div className="page-head"><p className="eyebrow">Self-service</p><h1>Profile requests</h1>
            <p className="muted" style={{ maxWidth: 560 }}>Members scan the church QR code and enter their phone number. Confirm it&rsquo;s really them, then check their changes before they are saved.</p></div>
          <Link className="btn small" href="/admin/qr">Print the QR code</Link>
        </div>
        <Flash ok={sp.ok} err={sp.err} />

        <section className="stack">
          <h2 className="h2">Waiting for you <span className="count">{pending.length}</span></h2>
          {pending.length === 0 && <p className="card muted">No requests are waiting.</p>}
          {pending.map((r) => r.status === 'access_pending'
            ? <AccessCard key={r.id} r={r} tree={tree} />
            : <ReviewCard key={r.id} r={r} tree={tree} current={r.person_id != null ? profiles.get(r.person_id)?.details ?? {} : {}} />)}
        </section>

        {editing.length > 0 && (
          <section className="card">
            <h2 className="h2">Approved, waiting for the member <span className="count">{editing.length}</span></h2>
            <ul className="plain-list">
              {editing.map((r) => (
                <li key={r.id}>
                  <span>{r.person_id != null ? tree.nameOf(r.person_id) : 'New person'} <small className="muted">{r.phone} · since {when(r.updated_at)}</small></span>
                  <form action={rejectRequest}><input type="hidden" name="id" value={r.id} /><button className="link-btn small">Cancel</button></form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recent.length > 0 && (
          <section className="card">
            <h2 className="h2">Recently handled</h2>
            <ul className="plain-list">
              {recent.map((r) => (
                <li key={r.id}>
                  <span>
                    {r.person_id != null ? <Link href={`/admin/members/${r.person_id}`}>{tree.nameOf(r.person_id)}</Link> : (r.proposed?.name ?? r.phone)}
                    <small className="muted"> · {r.kind === 'join' ? 'new person' : 'profile update'} · {r.phone}</small>
                  </span>
                  <span className={`tag ${r.status === 'applied' ? 't-excellent' : 't-difficult'}`}>{r.status === 'applied' ? 'Approved' : 'Declined'} {r.decided_at ? when(r.decided_at) : ''}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function Decline({ id }: { id: number }) {
  return (
    <form action={rejectRequest}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton label="Decline" confirm="Decline this request? The person will be told to see a church admin." />
    </form>
  );
}

function AccessCard({ r, tree }: { r: ProfileRequest; tree: Tree }) {
  const matches = findByPhone(tree, r.phone);
  return (
    <div className="card request">
      <p className="kv-label">Wants to update their profile · {when(r.created_at)}</p>
      <p><b>{r.phone}</b> is asking to open the profile for:</p>
      {matches.length === 0 ? (
        <><p className="error mt-s">Nobody in the system has this number any more.</p><div className="row gap-s mt-s"><Decline id={r.id} /></div></>
      ) : (
        <>
          <form action={grantAccess} className="stack mt-s" id={`grant-${r.id}`}>
            <input type="hidden" name="id" value={r.id} />
            {matches.map((p, i) => (
              <label key={p.id} className="choice">
                <input type="radio" name="personId" value={p.id} defaultChecked={i === 0} required />
                <span><b>{titled(p)}</b> <small className="muted">{p.reportsToId != null ? `in ${tree.nameOf(p.reportsToId)}'s group` : ''}</small></span>
              </label>
            ))}
            {matches.length > 1 && <p className="hint">This number belongs to more than one person. Choose who is asking.</p>}
          </form>
          <p className="hint mt-s">Only approve if you know this number belongs to them. They will see and edit their details on their phone.</p>
          <div className="row gap-s mt-s">
            <button className="btn small primary" form={`grant-${r.id}`}>Yes, let them update</button>
            <Decline id={r.id} />
          </div>
        </>
      )}
    </div>
  );
}

function ReviewCard({ r, tree, current }: { r: ProfileRequest; tree: Tree; current: ProfileDetails }) {
  const p = r.person_id != null ? tree.person(r.person_id) : undefined;
  const n = r.proposed ?? { name: '', phone: '', details: {} };
  const rows = [
    { label: 'Full name', old: p?.name ?? '', now: n.name },
    { label: 'Phone', old: p?.phone ?? '', now: n.phone },
    ...FIELDS.map((f) => ({ label: f.label, old: show(current[f.key], f.date), now: show(n.details[f.key], f.date) })),
  ].filter((x) => x.old || x.now);
  const changed = rows.filter((x) => x.old !== x.now).length;
  const isJoin = r.kind === 'join';
  return (
    <div className="card request">
      <p className="kv-label">{isJoin ? 'New person wants to join the list' : 'Updated profile to check'} · {when(r.updated_at)}</p>
      <p><b>{isJoin ? n.name : p ? titled(p) : 'Removed person'}</b> <small className="muted">{r.phone}{!isJoin && ` · ${changed} change${changed === 1 ? '' : 's'}`}</small></p>
      <div className="table-wrap mt-s">
        <table className="table diff">
          <thead><tr><th></th>{!isJoin && <th>Now</th>}<th>{isJoin ? 'Their details' : 'Their update'}</th></tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.label} className={!isJoin && x.old !== x.now ? 'changed' : ''}>
                <td className="muted">{x.label}</td>
                {!isJoin && <td>{x.old || <span className="muted">—</span>}</td>}
                <td>{x.now || <span className="muted">— (cleared)</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={applyRequest} className="row gap-s mt-s" id={`apply-${r.id}`}>
        <input type="hidden" name="id" value={r.id} />
        {isJoin && (
          <label className="field grow"><span>Add them to the group of</span>
            <select name="reportsTo" required defaultValue="">
              <option value="" disabled>Choose a leader…</option>
              {treeOrder(tree).map((o) => <option key={o.id} value={o.id}>{'  '.repeat(Math.max(0, o.level - 1))}{titled(o)}</option>)}
            </select>
          </label>
        )}
      </form>
      <div className="row gap-s mt-s">
        <button className="btn small primary" form={`apply-${r.id}`}>{isJoin ? 'Approve and add' : 'Approve changes'}</button>
        <Decline id={r.id} />
      </div>
    </div>
  );
}
