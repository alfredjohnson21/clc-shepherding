import Link from 'next/link';
import { savePhones } from '@/app/admin/actions';
import Flash from '@/components/Flash';
import Header from '@/components/Header';
import { treeOrder } from '@/components/PersonForm';
import seed from '@/data/tree.json';
import { requireSuper } from '@/lib/auth';
import { dashTitle, dashWho, navFor } from '@/lib/nav';
import { CATEGORY_LABEL, getTree, titled } from '@/lib/tree';

export const dynamic = 'force-dynamic';

/** Numbers from the latest shepherd tree list, offered when the live record has none. */
const fromList = new Map((seed as { id: number; name: string; phone: string }[]).filter((p) => p.phone).map((p) => [p.id, p]));

export default async function MissingPhones({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireSuper();
  const sp = await searchParams;
  const tree = await getTree();
  const missing = treeOrder(tree).filter((p) => p.level >= 1 && !p.phone.trim());
  const suggested = (id: number, name: string) => {
    const s = fromList.get(id);
    return s && s.name === name ? s.phone : '';
  };
  const withSuggestion = missing.filter((p) => suggested(p.id, p.name)).length;
  const branches = tree.branches.filter((b) => missing.some((p) => p.branchId === b.id || p.id === b.id));

  return (
    <>
      <Header title={dashTitle('super')} who={dashWho('super')} nav={navFor('super')} />
      <main className="page narrow">
        <Link href="/admin/people">← People</Link>
        <div className="page-head"><p className="eyebrow">People</p><h1>Missing phone numbers <span className="count">{missing.length}</span></h1>
          <p className="muted">Without a phone number, a member can&rsquo;t use the QR code to update their profile, and leaders can&rsquo;t sign in with the &ldquo;first 5 digits&rdquo; password.
            {withSuggestion > 0 && <> <b>{withSuggestion}</b> numbers are filled in from the latest shepherd tree list. Check them, then save.</>}</p></div>
        <Flash ok={sp.ok} err={sp.err} />

        {missing.length === 0 ? <p className="card">Everyone has a phone number. 🎉</p> : (
          <form action={savePhones} className="stack">
            {branches.map((b) => (
              <section className="card" key={b.id}>
                <h2 className="h3">{titled(b)}&rsquo;s branch</h2>
                <ul className="phone-list">
                  {missing.filter((p) => p.branchId === b.id || p.id === b.id).map((p) => {
                    const s = suggested(p.id, p.name);
                    return (
                      <li key={p.id}>
                        <label htmlFor={`ph${p.id}`}>
                          <b>{p.name}</b>
                          <small className="muted">{p.role || CATEGORY_LABEL[p.category]}{p.reportsToId != null && p.reportsToId !== b.id ? ` · under ${tree.nameOf(p.reportsToId)}` : ''}</small>
                        </label>
                        <span className="phone-input">
                          <input id={`ph${p.id}`} name={`phone_${p.id}`} type="tel" inputMode="tel" maxLength={20} placeholder="No number yet" defaultValue={s} className={s ? 'suggested' : ''} />
                          {s && <small className="hint">from the shepherd tree list</small>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <div className="save-bar"><button className="btn primary">Save phone numbers</button><span className="muted small">Boxes left empty are skipped.</span></div>
          </form>
        )}
      </main>
    </>
  );
}
