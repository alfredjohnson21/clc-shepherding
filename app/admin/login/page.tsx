import { AdminLogin } from '@/components/LoginForms';
import Link from 'next/link';

export default function AdminLoginPage() {
  return (
    <main className="landing">
      <section className="landing-card">
        <div className="landing-head">
          <img src="/clc-logo.png" alt="Christ’s Love Church logo" className="logo-lg" width={120} height={81} />
          <p className="eyebrow">Christ&rsquo;s Love Church</p>
          <h1>Head Pastor&rsquo;s Dashboard</h1>
          <p className="muted">Shepherding reports from across the church.</p>
        </div>
        <AdminLogin />
        <p className="landing-foot"><Link href="/">← Shepherd sign-in</Link></p>
      </section>
    </main>
  );
}
