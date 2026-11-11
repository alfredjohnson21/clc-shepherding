import Link from 'next/link';
import Flash from '@/components/Flash';
import Header from '@/components/Header';
import { treeOrder } from '@/components/PersonForm';
import { requireSuper } from '@/lib/auth';
import { dashTitle, dashWho, navFor } from '@/lib/nav';
import { CATEGORY_LABEL, getTree } from '@/lib/tree';

export const dynamic = 'force-dynamic';

export default async function People({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireSuper();
  const sp = await searchParams;
  const tree = await getTree();
  const rows = treeOrder(tree);
  const removed = tree.all.filter((p) => !p.active);
  return (
    <>
      <Header title={dashTitle('super')} who={dashWho('super')} nav={navFor('super')} />
      <main className="page wide">
        <div className="row between">
          <div className="page-head"><p className="eyebrow">Super admin</p><h1>People &amp; groups</h1>
            <p className="muted" style={{ maxWidth: 640 }}>{tree.people.length} people · {tree.shepherds.length} group leaders. Anyone with people under them is a group leader and gets a sign-in link automatically. Use <b>+ Add</b> on a row to add someone to that person&rsquo;s group.</p></div>
          <Link href="/admin/people/new" className="btn primary">Add a person</Link>
        </div>
        <Flash ok={sp.ok} err={sp.err} />
        <section className="card">
          <div className="table-wrap">
            <table className="table people-table">
              <thead><tr><th>Name</th><th>Position</th><th>Phone</th><th>Group</th><th></th></tr></thead>
              <tbody>
                {rows.map((p) => {
                  const g = tree.groupOf(p.id).length;
                  return (
                    <tr key={p.id} id={`p${p.id}`} className={`lvl${p.level}`}>
                      <td>
                        <span className="indent" style={{ paddingLeft: Math.max(0, p.level - 1) * 22 }}>
                          {p.level >= 2 && <span className="tree-line">└</span>}
                          <b>{p.name}</b>{p.role && <small className="muted"> · {p.role}</small>}
                        </span>
                      </td>
                      <td>{CATEGORY_LABEL[p.category]}</td>
                      <td>{p.phone || <span className="muted">—</span>}</td>
                      <td>{g ? <span className="count">{g}</span> : <span className="muted">—</span>}</td>
                      <td><div className="row-actions">
                        <Link className="btn small" href={`/admin/people/new?under=${p.id}`}>+ Add</Link>
                        <Link className="btn small" href={`/admin/people/${p.id}`}>Edit</Link>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {removed.length > 0 && (
          <section className="card">
            <h2 className="h2">Removed <span className="count">{removed.length}</span></h2>
            <ul className="plain-list">
              {removed.map((p) => <li key={p.id}><span>{p.name}</span><Link href={`/admin/people/${p.id}`}>View / restore</Link></li>)}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
