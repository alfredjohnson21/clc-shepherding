import Link from 'next/link';
import { notFound } from 'next/navigation';
import { saveProfile } from '@/app/admin/actions';
import Flash from '@/components/Flash';
import Header from '@/components/Header';
import { requireSuper } from '@/lib/auth';
import { loadProfile } from '@/lib/members';
import { dashTitle, dashWho, navFor } from '@/lib/nav';
import { getTree, titled } from '@/lib/tree';
import { MILESTONES, PERSONAL_FIELDS } from '@/lib/types';
import { today } from '@/lib/week';

export const dynamic = 'force-dynamic';

export default async function EditProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireSuper();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tree = await getTree();
  const p = tree.person(Number(id));
  if (!p || p.level < 1) notFound();
  const d = (await loadProfile(p.id)).details;
  const max = today();

  return (
    <>
      <Header title={dashTitle('super')} who={dashWho('super')} nav={navFor('super')} />
      <main className="page narrow">
        <Link href={`/admin/members/${p.id}`}>← {p.name}&rsquo;s profile</Link>
        <div className="page-head"><p className="eyebrow">Edit profile</p><h1>{titled(p)}</h1>
          <p className="muted">Leave anything you don&rsquo;t know blank. Name, phone and group are changed under <Link href={`/admin/people/${p.id}`}>person settings</Link>.</p></div>
        <Flash ok={sp.ok} err={sp.err} />
        <form action={saveProfile} className="stack">
          <input type="hidden" name="id" value={p.id} />
          <section className="card">
            <h2 className="h3">Spiritual journey</h2>
            <p className="muted small">The date each step happened. Leave blank if it hasn&rsquo;t happened yet.</p>
            <div className="form-grid mt-s">
              {MILESTONES.map((m) => (
                <label key={m.key} className="field"><span>{m.label}</span>
                  <input type="date" name={m.key} defaultValue={d[m.key] ?? ''} max={max} /></label>
              ))}
            </div>
          </section>
          <section className="card">
            <h2 className="h3">Personal details</h2>
            <div className="form-grid">
              {PERSONAL_FIELDS.map((f) => (
                <label key={f.key} className="field"><span>{f.label}</span>
                  {'options' in f ? (
                    <select name={f.key} defaultValue={d[f.key] ?? ''}>
                      <option value="">—</option>
                      {f.options.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : 'date' in f ? (
                    <input type="date" name={f.key} defaultValue={d[f.key] ?? ''} max={max} />
                  ) : (
                    <input name={f.key} defaultValue={d[f.key] ?? ''} maxLength={120} />
                  )}
                </label>
              ))}
            </div>
          </section>
          <div className="row gap-s"><button className="btn primary">Save profile</button><Link className="btn ghost" href={`/admin/members/${p.id}`}>Cancel</Link></div>
        </form>
      </main>
    </>
  );
}
