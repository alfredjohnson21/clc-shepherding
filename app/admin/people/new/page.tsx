import Link from 'next/link';
import { addPerson } from '@/app/admin/actions';
import Flash from '@/components/Flash';
import Header from '@/components/Header';
import PersonForm from '@/components/PersonForm';
import { requireSuper } from '@/lib/auth';
import { dashTitle, dashWho, navFor } from '@/lib/nav';
import { getTree, titled } from '@/lib/tree';

export const dynamic = 'force-dynamic';

export default async function NewPerson({ searchParams }: { searchParams: Promise<{ under?: string; err?: string }> }) {
  await requireSuper();
  const sp = await searchParams;
  const tree = await getTree();
  const under = tree.person(Number(sp.under));
  return (
    <>
      <Header title={dashTitle('super')} who={dashWho('super')} nav={navFor('super')} />
      <main className="page narrow">
        <Link href="/admin/people">← People</Link>
        <div className="page-head"><p className="eyebrow">Super admin</p>
          <h1>{under?.active ? `Add to ${titled(under)}'s group` : 'Add a person'}</h1>
          <p className="muted">If the leader they report to had no group before, that leader gets a sign-in link straight away.</p></div>
        <Flash err={sp.err} />
        <PersonForm tree={tree} under={under?.active ? under.id : undefined} action={addPerson} submit="Add person" />
      </main>
    </>
  );
}
