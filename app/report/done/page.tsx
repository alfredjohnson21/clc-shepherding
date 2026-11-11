import Link from 'next/link';
import Header from '@/components/Header';
import { requireShepherd } from '@/lib/auth';
import { getTree, titled } from '@/lib/tree';

export default async function Done() {
  const id = await requireShepherd();
  const me = (await getTree()).person(id)!;
  return (
    <>
      <Header title="Shepherding Assessment" who={titled(me)} />
      <main className="page narrow">
        <section className="card center done">
          <div className="done-mark" aria-hidden>✓</div>
          <h1>Report submitted</h1>
          <p className="muted">Thank you, {me.name.split(' ')[0]}. Your report is now on the Head Pastor&rsquo;s dashboard.</p>
          <Link href="/report" className="btn">Submit another report</Link>
        </section>
      </main>
    </>
  );
}
