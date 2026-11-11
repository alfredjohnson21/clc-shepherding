import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ShepherdLogin } from '@/components/LoginForms';
import { getSession } from '@/lib/auth';
import { shepherdByUsername, titled, usernameOf } from '@/lib/tree';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Weekly report sign-in — CLC Shepherding' };

/** Personal link (e.g. /s/alfred.johnson): the name is already filled in; only the password is asked for. */
export default async function PersonalLink({ params }: { params: Promise<{ username: string }> }) {
  const me = shepherdByUsername(decodeURIComponent((await params).username));
  if (!me) notFound();
  const s = await getSession();
  if (s?.kind === 'shepherd' && s.id === me.id) redirect('/report'); // already signed in on this phone
  return (
    <main className="landing">
      <section className="landing-card">
        <div className="landing-head">
          <span className="brand-mark lg" aria-hidden>✝</span>
          <p className="eyebrow">Christ&rsquo;s Love Church</p>
          <h1>Shepherding Assessment</h1>
          <p className="welcome">Welcome, <b>{titled(me)}</b>. Enter your password to start this week&rsquo;s report.</p>
        </div>
        <ShepherdLogin fixed={{ id: me.id, username: usernameOf(me) }} />
        <p className="landing-foot">
          <Link href="/">Not {me.name.split(' ')[0]}? Sign in here →</Link>
        </p>
      </section>
    </main>
  );
}
