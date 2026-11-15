import Link from 'next/link';
import Header from '@/components/Header';
import StatusBadge from '@/components/StatusBadge';
import { requireDashboard } from '@/lib/auth';
import { autoStatus, effectiveStatus, lastNoteDates, loadMemberStats, loadProfiles, profilePeople } from '@/lib/members';
import { dashTitle, dashWho, navFor } from '@/lib/nav';
import { CATEGORY_LABEL, getTree, titled } from '@/lib/tree';
import { CARE_STATUS, type CareStatus } from '@/lib/types';
import { fmtDate } from '@/lib/week';

export const dynamic = 'force-dynamic';

const ORDER: CareStatus[] = ['urgent', 'needs_care', 'new', 'stable', 'thriving'];
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

export default async function Members({ searchParams }: { searchParams: Promise<{ status?: string; branch?: string; q?: string }> }) {
  const role = await requireDashboard();
  const sp = await searchParams;
  const tree = await getTree();
  const people = profilePeople(tree);
  const [{ stats }, profiles, notes] = await Promise.all([loadMemberStats(tree, people.map((p) => p.id)), loadProfiles(), lastNoteDates()]);

  const rows = people.map((p) => {
    const s = stats.get(p.id)!;
    const auto = autoStatus(s);
    const eff = effectiveStatus(profiles.get(p.id), auto);
    const contact = [s.lastCare, notes.get(p.id) ?? null].filter(Boolean).sort().pop() ?? null;
    return { p, s, ...eff, contact };
  });
  const counts = Object.fromEntries(ORDER.map((k) => [k, rows.filter((r) => r.status === k).length])) as Record<CareStatus, number>;

  const status = ORDER.includes(sp.status as CareStatus) ? (sp.status as CareStatus) : '';
  const branch = Number(sp.branch) || 0;
  const q = (sp.q ?? '').trim().toLowerCase();
  const shown = rows
    .filter((r) => (!status || r.status === status) && (!branch || r.p.branchId === branch) && (!q || r.p.name.toLowerCase().includes(q)))
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.s.streak - a.s.streak || a.p.name.localeCompare(b.p.name));
  const link = (o: { status?: string; branch?: number }) => {
    const u = new URLSearchParams();
    const st = o.status ?? status, br = o.branch ?? branch;
    if (st) u.set('status', st);
    if (br) u.set('branch', String(br));
    if (q) u.set('q', q);
    const s = u.toString();
    return `/admin/members${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <Header title={dashTitle(role)} who={dashWho(role)} nav={navFor(role)} />
      <main className="page wide">
        <div className="page-head"><p className="eyebrow">Member care</p><h1>Members</h1>
          <p className="muted" style={{ maxWidth: 680 }}>How every member is doing, from their leaders&rsquo; weekly reports over the last 26 weeks{role === 'super' ? ' and your own notes' : ''}. Open a member to see their full profile.</p></div>

        <section className="status-tiles">
          <Link href={link({ status: '' })} className={`status-tile ${!status ? 'on' : ''}`}><b>{rows.length}</b><span>Everyone</span></Link>
          {ORDER.map((k) => (
            <Link key={k} href={link({ status: k })} className={`status-tile t-${k} ${status === k ? 'on' : ''}`}>
              <b>{counts[k]}</b><span>{CARE_STATUS.find((c) => c.value === k)!.label}</span>
            </Link>
          ))}
        </section>

        <section className="card">
          <form className="filters" action="/admin/members">
            {status && <input type="hidden" name="status" value={status} />}
            <input name="q" defaultValue={sp.q ?? ''} placeholder="Search by name" aria-label="Search by name" />
            <select name="branch" defaultValue={branch || ''} aria-label="Branch">
              <option value="">All branches</option>
              {tree.branches.map((b) => <option key={b.id} value={b.id}>{titled(b)}</option>)}
            </select>
            <button className="btn small">Filter</button>
            {(status || branch || q) && <Link className="btn small ghost" href="/admin/members">Clear</Link>}
          </form>
          <p className="muted small mt-s">{shown.length} {shown.length === 1 ? 'person' : 'people'}</p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Status</th><th>Attendance</th><th>Last present</th><th>Last care contact</th><th>Leader</th></tr></thead>
              <tbody>
                {shown.map(({ p, s, status: st, manual, contact }) => (
                  <tr key={p.id}>
                    <td><Link href={`/admin/members/${p.id}`}><b>{p.name}</b></Link><br /><small className="muted">{p.role || CATEGORY_LABEL[p.category]}</small></td>
                    <td><StatusBadge status={st} manual={manual} /></td>
                    <td>{pct(s.att12)}{s.streak >= 2 && <> <span className={`streak s${Math.min(s.streak, 4)}`}>{s.streak} missed</span></>}<br /><small className="muted">last 12 weeks</small></td>
                    <td>{s.lastPresent ? fmtDate(s.lastPresent, { day: 'numeric', month: 'short' }) : <span className="muted">—</span>}</td>
                    <td>{contact ? fmtDate(contact, { day: 'numeric', month: 'short' }) : <span className="muted">—</span>}</td>
                    <td>{p.reportsToId != null ? tree.nameOf(p.reportsToId) : '—'}{p.branchId && p.branchId !== p.id && p.branchId !== p.reportsToId && <><br /><small className="muted">{tree.nameOf(p.branchId)}&rsquo;s branch</small></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && <p className="muted mt-s">Nobody matches these filters.</p>}
        </section>
      </main>
    </>
  );
}
