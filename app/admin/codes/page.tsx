import Header from '@/components/Header';
import PrintButton from '@/components/PrintButton';
import { accessCode, requireAdmin } from '@/lib/auth';
import { NAV } from '@/lib/nav';
import { branches, CATEGORY_LABEL, groupOf, shepherds } from '@/lib/tree';

export const dynamic = 'force-dynamic';

export default async function Codes() {
  await requireAdmin();
  return (
    <>
      <Header title="Head Pastor's Dashboard" who="Head Pastor" nav={NAV} />
      <main className="page wide">
        <div className="row between">
          <div className="page-head"><p className="eyebrow">Confidential</p><h1>Shepherd access codes</h1>
            <p className="muted">Each shepherd signs in with their name and this code. Share each code privately with its owner.</p></div>
          <PrintButton label="Print list" />
        </div>
        {branches.filter((b) => shepherds.some((s) => s.branchId === b.id)).map((b) => (
          <section className="card" key={b.id}>
            <h2 className="h3">{b.role} {b.name}&rsquo;s branch</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Position</th><th>Phone</th><th>Group size</th><th>Access code</th></tr></thead>
                <tbody>
                  {shepherds.filter((s) => s.branchId === b.id).sort((x, y) => x.level - y.level).map((s) => (
                    <tr key={s.id}>
                      <td><b>{s.name}</b>{s.role && <small className="muted"> · {s.role}</small>}</td>
                      <td>{CATEGORY_LABEL[s.category]}</td>
                      <td>{s.phone || <span className="muted">—</span>}</td>
                      <td>{groupOf(s.id).length}</td>
                      <td><code className="code">{accessCode(s.id)}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
