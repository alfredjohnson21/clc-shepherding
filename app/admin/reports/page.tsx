import Link from 'next/link';
import Header from '@/components/Header';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { NAV } from '@/lib/nav';
import { branches, nameOf, person, shepherds } from '@/lib/tree';
import { fmtDate } from '@/lib/week';
import { PERFORMANCE, type ReportRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
const PERF: Record<string, string> = Object.fromEntries(PERFORMANCE.map((p) => [p.value, p.label]));

export default async function AllReports({ searchParams }: { searchParams: Promise<{ shepherd?: string; branch?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const shepherd = Number(sp.shepherd) || 0;
  const branch = Number(sp.branch) || 0;
  let rows = await query<ReportRow>('SELECT id, shepherd_id, meeting_date, week_start, data, created_at FROM reports ORDER BY meeting_date DESC, id DESC LIMIT 1000');
  rows = rows.map((r) => ({ ...r, data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data }));
  if (shepherd) rows = rows.filter((r) => r.shepherd_id === shepherd);
  if (branch) rows = rows.filter((r) => person(r.shepherd_id)?.branchId === branch);
  return (
    <>
      <Header title="Head Pastor's Dashboard" who="Head Pastor" nav={NAV} />
      <main className="page wide">
        <div className="page-head"><p className="eyebrow">Archive</p><h1>All reports</h1></div>
        <form className="filters card">
          <label className="field"><span>Branch</span>
            <select name="branch" defaultValue={branch || ''}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></label>
          <label className="field"><span>Shepherd</span>
            <select name="shepherd" defaultValue={shepherd || ''}>
              <option value="">All shepherds</option>
              {shepherds.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
          <button className="btn small">Filter</button>
        </form>
        <section className="card">
          {rows.length === 0 ? <p className="muted">No reports found.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Shepherd</th><th>Branch</th><th>Present</th><th>Went</th><th>Scores</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.meeting_date)}</td>
                      <td><b>{nameOf(r.shepherd_id)}</b></td>
                      <td>{nameOf(person(r.shepherd_id)?.branchId ?? 0)}</td>
                      <td>{r.data.totalPresent} / {r.data.totalPresent + r.data.totalAbsent}</td>
                      <td><span className={`tag t-${r.data.performance}`}>{PERF[r.data.performance]}</span></td>
                      <td>{r.data.participation} · {r.data.vulnerability}</td>
                      <td><Link href={`/admin/reports/${r.id}`}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
