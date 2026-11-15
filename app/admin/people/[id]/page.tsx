import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { removePerson, restorePerson, savePerson } from '@/app/admin/actions';
import ConfirmButton from '@/components/ConfirmButton';
import Flash from '@/components/Flash';
import Header from '@/components/Header';
import PersonForm from '@/components/PersonForm';
import { accessCode, requireSuper } from '@/lib/auth';
import { query } from '@/lib/db';
import { dashTitle, dashWho, navFor } from '@/lib/nav';
import { getTree, titled } from '@/lib/tree';
import { fmtDate } from '@/lib/week';

export const dynamic = 'force-dynamic';

export default async function EditPerson({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireSuper();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tree = await getTree();
  const p = tree.person(Number(id));
  if (!p) notFound();
  const group = tree.groupOf(p.id);
  const leads = tree.isShepherd(p.id);
  const boss = p.reportsToId != null ? tree.person(p.reportsToId) : null;
  const reports = await query<{ id: number; meeting_date: string }>('SELECT id, meeting_date FROM reports WHERE shepherd_id = $1 ORDER BY meeting_date DESC LIMIT 5', [p.id]);
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'clc-shepherding.vercel.app';
  const base = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;

  return (
    <>
      <Header title={dashTitle('super')} who={dashWho('super')} nav={navFor('super')} />
      <main className="page narrow">
        <div className="row between"><Link href={`/admin/people#p${p.id}`}>← People</Link>{p.level >= 1 && <Link className="btn small" href={`/admin/members/${p.id}`}>View profile</Link>}</div>
        <div className="page-head"><p className="eyebrow">{p.active ? 'Edit person' : 'Removed'}</p><h1>{titled(p)}</h1>
          <p className="muted">{boss ? <>In {titled(boss)}&rsquo;s group</> : 'Top of the church'}{group.length > 0 && <> · leads {group.length} {group.length === 1 ? 'person' : 'people'}</>}</p></div>
        <Flash ok={sp.ok} err={sp.err} />

        {leads && p.active && (
          <section className="card">
            <h2 className="h3">Weekly report sign-in</h2>
            <dl className="login-box">
              <dt>Link</dt><dd><a href={`/s/${p.username}`} target="_blank">{base}/s/{p.username}</a></dd>
              <dt>Username</dt><dd>{p.username}</dd>
              <dt>Password</dt><dd>{accessCode(p)} <span className="hint">{p.password ? '(custom)' : p.phone ? '(first 5 digits of phone)' : '(automatic code)'}</span></dd>
            </dl>
          </section>
        )}

        <PersonForm tree={tree} person={p} action={savePerson} submit="Save changes">
          <label className="field"><span>Username <span className="hint">used in their link</span></span>
            <input name="username" defaultValue={p.username} required pattern="[a-z0-9][a-z0-9.\-]{2,39}" /></label>
          <label className="field"><span>Custom password <span className="hint">4–10 digits; blank = automatic</span></span>
            <input name="password" defaultValue={p.password ?? ''} inputMode="numeric" pattern="\d{4,10}" placeholder={p.phone ? 'First 5 digits of phone' : 'Automatic code'} /></label>
        </PersonForm>

        {group.length > 0 && (
          <section className="card">
            <h2 className="h3">Their group</h2>
            <ul className="plain-list">
              {group.map((m) => <li key={m.id}><Link href={`/admin/people/${m.id}`}>{m.name}</Link><span className="muted small">{m.phone}</span></li>)}
            </ul>
            <p className="mt-s"><Link className="btn small" href={`/admin/people/new?under=${p.id}`}>+ Add to this group</Link></p>
          </section>
        )}
        {group.length === 0 && p.active && <p><Link className="btn small" href={`/admin/people/new?under=${p.id}`}>+ Give {p.name.split(' ')[0]} a group member</Link></p>}

        {reports.length > 0 && (
          <section className="card">
            <h2 className="h3">Recent reports</h2>
            <ul className="plain-list">{reports.map((r) => <li key={r.id}><span>{fmtDate(r.meeting_date)}</span><Link href={`/admin/reports/${r.id}`}>Open</Link></li>)}</ul>
          </section>
        )}

        {p.reportsToId !== null && (
          <section className="card">
            {p.active ? (
              <form action={removePerson} className="row between">
                <input type="hidden" name="id" value={p.id} />
                <p className="muted small" style={{ maxWidth: 440 }}>Removing hides {p.name.split(' ')[0]} from groups and sign-in. Past reports are kept. {group.length > 0 && 'Move their group members to another leader first.'}</p>
                <ConfirmButton label="Remove person" confirm={`Remove ${p.name}? They will no longer appear in groups or be able to sign in. Past reports are kept, and you can restore them later.`} />
              </form>
            ) : (
              <form action={restorePerson} className="row between">
                <input type="hidden" name="id" value={p.id} />
                <p className="muted small">This person was removed. Restore them to bring them back into their group.</p>
                <button className="btn small">Restore</button>
              </form>
            )}
          </section>
        )}
      </main>
    </>
  );
}
