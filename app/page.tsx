import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { shepherds } from '@/lib/tree';
import { ShepherdLogin } from '@/components/LoginForms';

export default async function Home() {
  const s = await getSession();
  if (s?.kind === 'shepherd') redirect('/report');
  if (s?.kind === 'admin') redirect('/admin');
  const options = shepherds.map((p) => ({ id: p.id, label: p.role ? `${p.name} (${p.role})` : p.name }));
  return (
    <main className="landing">
      <section className="landing-card">
        <div className="landing-head">
          <img src="/clc-logo.png" alt="Christ’s Love Church logo" className="logo-lg" width={120} height={81} />
          <p className="eyebrow">Christ&rsquo;s Love Church</p>
          <h1>Shepherding Assessment</h1>
          <p className="muted">Weekly group meeting report for council members and shepherds.</p>
        </div>
        <ShepherdLogin options={options} />
        <p className="landing-foot">
          <Link href="/admin/login">Head Pastor &amp; admin sign-in →</Link>
        </p>
      </section>
    </main>
  );
}
